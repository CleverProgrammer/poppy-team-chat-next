/**
 * Lightweight MCP Client Implementation (extracted from vercel/ai)
 * This is a standalone implementation to avoid installing the entire 'ai' package
 * 
 * Based on: https://github.com/vercel/ai/tree/main/packages/mcp/src/tool/mcp-client.ts
 */

const CLIENT_VERSION = '1.0.0';
const LATEST_PROTOCOL_VERSION = '2024-11-05';
const SUPPORTED_PROTOCOL_VERSIONS = ['2024-11-05'];

class MCPClientError extends Error {
  constructor({ message, code, data, cause }) {
    super(message);
    this.name = 'MCPClientError';
    this.code = code;
    this.data = data;
    this.cause = cause;
  }
}

/**
 * Creates and returns an MCP client
 */
export async function createMCPClient(config) {
  const client = new DefaultMCPClient(config);
  await client.init();
  return client;
}

class DefaultMCPClient {
  constructor({
    transport: transportConfig,
    name = 'ai-sdk-mcp-client',
    version = CLIENT_VERSION,
    onUncaughtError,
    capabilities,
  }) {
    this.onUncaughtError = onUncaughtError;
    this.clientCapabilities = capabilities ?? {};
    this.transport = createMcpTransport(transportConfig);
    this.requestMessageId = 0;
    this.responseHandlers = new Map();
    this.serverCapabilities = {};
    this.isClosed = true;
    this.clientInfo = { name, version };

    this.transport.onclose = () => this.onClose();
    this.transport.onerror = (error) => this.onError(error);
    this.transport.onmessage = (message) => {
      if ('method' in message) {
        if ('id' in message) {
          this.onError(new MCPClientError({ message: 'Request messages not supported' }));
        }
        return;
      }
      this.onResponse(message);
    };
  }

  async init() {
    try {
      await this.transport.start();
      this.isClosed = false;

      const result = await this.request({
        request: {
          method: 'initialize',
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: this.clientCapabilities,
            clientInfo: this.clientInfo,
          },
        },
      });

      if (!result) {
        throw new MCPClientError({ message: 'Server sent invalid initialize result' });
      }

      if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
        throw new MCPClientError({
          message: `Server's protocol version is not supported: ${result.protocolVersion}`,
        });
      }

      this.serverCapabilities = result.capabilities;

      await this.notification({ method: 'notifications/initialized' });

      return this;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close() {
    if (this.isClosed) return;
    await this.transport?.close();
    this.onClose();
  }

  async request({ request, options }) {
    return new Promise((resolve, reject) => {
      if (this.isClosed) {
        return reject(new MCPClientError({ message: 'Attempted to send a request from a closed client' }));
      }

      const messageId = this.requestMessageId++;
      const jsonrpcRequest = {
        ...request,
        jsonrpc: '2.0',
        id: messageId,
      };

      this.responseHandlers.set(messageId, (response) => {
        if (response instanceof Error) {
          return reject(response);
        }

        try {
          resolve(response.result);
        } catch (error) {
          reject(new MCPClientError({ message: 'Failed to parse server response', cause: error }));
        }
      });

      this.transport.send(jsonrpcRequest).catch((error) => {
        this.responseHandlers.delete(messageId);
        reject(error);
      });
    });
  }

  async listTools({ params, options } = {}) {
    try {
      return this.request({
        request: { method: 'tools/list', params },
        options,
      });
    } catch (error) {
      throw error;
    }
  }

  async callTool({ name, args, options }) {
    try {
      return this.request({
        request: { method: 'tools/call', params: { name, arguments: args } },
        options: { signal: options?.abortSignal },
      });
    } catch (error) {
      throw error;
    }
  }

  async notification(notification) {
    const jsonrpcNotification = {
      ...notification,
      jsonrpc: '2.0',
    };
    await this.transport.send(jsonrpcNotification);
  }

  async tools({ schemas = 'automatic' } = {}) {
    const tools = {};

    try {
      const listToolsResult = await this.listTools();
      for (const { name, description, inputSchema } of listToolsResult.tools) {
        const self = this;

        const execute = async (args, options) => {
          options?.abortSignal?.throwIfAborted();
          return self.callTool({ name, args, options });
        };

        tools[name] = {
          type: 'dynamic',
          description,
          inputSchema: {
            type: 'object',
            properties: inputSchema.properties ?? {},
            required: inputSchema.required ?? [],
            additionalProperties: false,
          },
          execute,
        };
      }

      return tools;
    } catch (error) {
      throw error;
    }
  }

  onClose() {
    if (this.isClosed) return;
    this.isClosed = true;
    const error = new MCPClientError({ message: 'Connection closed' });
    for (const handler of this.responseHandlers.values()) {
      handler(error);
    }
    this.responseHandlers.clear();
  }

  onError(error) {
    if (this.onUncaughtError) {
      this.onUncaughtError(error);
    }
  }

  onResponse(response) {
    const messageId = Number(response.id);
    const handler = this.responseHandlers.get(messageId);

    if (handler === undefined) {
      throw new MCPClientError({
        message: `Protocol error: Received a response for an unknown message ID: ${JSON.stringify(response)}`,
      });
    }

    this.responseHandlers.delete(messageId);

    handler(
      'result' in response
        ? response
        : new MCPClientError({
            message: response.error.message,
            code: response.error.code,
            data: response.error.data,
            cause: response.error,
          })
    );
  }
}

/**
 * Creates MCP transport based on config
 */
function createMcpTransport(config) {
  if (config.type === 'sse') {
    return new SseMCPTransport(config);
  }
  throw new MCPClientError({ message: 'Unsupported transport type' });
}

/**
 * SSE MCP Transport Implementation
 */
class SseMCPTransport {
  constructor({ url, headers }) {
    this.url = new URL(url);
    this.headers = headers;
    this.connected = false;
  }

  async start() {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        return resolve();
      }

      this.abortController = new AbortController();

      const establishConnection = async () => {
        try {
          const headers = {
            ...this.headers,
            'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
            'Accept': 'text/event-stream',
          };

          const response = await fetch(this.url.href, {
            headers,
            signal: this.abortController?.signal,
          });

          if (!response.ok || !response.body) {
            const error = new MCPClientError({
              message: `MCP SSE Transport Error: ${response.status} ${response.statusText}`,
            });
            this.onerror?.(error);
            return reject(error);
          }

          const stream = response.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new EventSourceParserStream());

          const reader = stream.getReader();

          const processEvents = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();

                if (done) {
                  if (this.connected) {
                    this.connected = false;
                    throw new MCPClientError({
                      message: 'MCP SSE Transport Error: Connection closed unexpectedly',
                    });
                  }
                  return;
                }

                const { event, data } = value;

                if (event === 'endpoint') {
                  this.endpoint = new URL(data, this.url);

                  if (this.endpoint.origin !== this.url.origin) {
                    throw new MCPClientError({
                      message: `MCP SSE Transport Error: Endpoint origin does not match connection origin: ${this.endpoint.origin}`,
                    });
                  }

                  this.connected = true;
                  resolve();
                } else if (event === 'message') {
                  try {
                    const message = JSON.parse(data);
                    this.onmessage?.(message);
                  } catch (error) {
                    const e = new MCPClientError({
                      message: 'MCP SSE Transport Error: Failed to parse message',
                      cause: error,
                    });
                    this.onerror?.(e);
                  }
                }
              }
            } catch (error) {
              if (error instanceof Error && error.name === 'AbortError') {
                return;
              }
              this.onerror?.(error);
              reject(error);
            }
          };

          this.sseConnection = {
            close: () => reader.cancel(),
          };

          processEvents();
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          this.onerror?.(error);
          reject(error);
        }
      };

      establishConnection();
    });
  }

  async close() {
    this.connected = false;
    this.sseConnection?.close();
    this.abortController?.abort();
    this.onclose?.();
  }

  async send(message) {
    if (!this.endpoint || !this.connected) {
      throw new MCPClientError({
        message: 'MCP SSE Transport Error: Not connected',
      });
    }

    const headers = {
      ...this.headers,
      'Content-Type': 'application/json',
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => null);
      const error = new MCPClientError({
        message: `MCP SSE Transport Error: POSTing to endpoint (HTTP ${response.status}): ${text}`,
      });
      this.onerror?.(error);
      return;
    }
  }
}

/**
 * EventSourceParserStream - parses SSE events
 */
class EventSourceParserStream extends TransformStream {
  constructor() {
    let buffer = '';
    let event = '';
    let data = '';
    let id = '';

    super({
      transform(chunk, controller) {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line === '') {
            if (data) {
              controller.enqueue({ event: event || 'message', data: data.slice(0, -1), id });
              event = '';
              data = '';
              id = '';
            }
          } else if (line.startsWith(':')) {
            // Comment, ignore
          } else {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) {
              continue;
            }
            const field = line.slice(0, colonIndex);
            const value = line.slice(colonIndex + 1).trimStart();

            if (field === 'event') {
              event = value;
            } else if (field === 'data') {
              data += value + '\n';
            } else if (field === 'id') {
              id = value;
            }
          }
        }
      },
      flush(controller) {
        if (data) {
          controller.enqueue({ event: event || 'message', data: data.slice(0, -1), id });
        }
      },
    });
  }
}
