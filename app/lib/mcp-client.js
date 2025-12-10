import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// MCP Client Manager
// Handles connections to multiple MCP servers with a unified interface

class MCPClientManager {
  constructor() {
    this.clients = new Map(); // Store active MCP clients
    this.serverConfigs = new Map(); // Store server configurations
  }

  /**
   * Add a new MCP server configuration
   * @param {string} name - Server identifier (e.g., 'notion', 'slack')
   * @param {Object} config - Server configuration
   * @param {string} config.command - Command to start the server
   * @param {string[]} config.args - Command arguments
   * @param {Object} config.env - Environment variables
   */
  addServer(name, config) {
    this.serverConfigs.set(name, config);
    console.log(`📝 MCP: Registered server "${name}"`);
  }

  /**
   * Connect to a specific MCP server
   * @param {string} name - Server identifier
   * @returns {Promise<Client>} Connected MCP client
   */
  async connect(name) {
    if (this.clients.has(name)) {
      console.log(`✅ MCP: Using existing connection to "${name}"`);
      return this.clients.get(name);
    }

    const config = this.serverConfigs.get(name);
    if (!config) {
      throw new Error(`MCP server "${name}" not configured. Call addServer() first.`);
    }

    console.log(`🔌 MCP: Connecting to "${name}"...`);

    try {
      // Create transport (stdio for Node.js based MCP servers)
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: { ...process.env, ...config.env }
      });

      // Create MCP client
      const client = new Client({
        name: `poppy-${name}-client`,
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Connect to server
      await client.connect(transport);

      this.clients.set(name, client);
      console.log(`✅ MCP: Successfully connected to "${name}"`);

      return client;
    } catch (error) {
      console.error(`❌ MCP: Failed to connect to "${name}":`, error);
      throw error;
    }
  }

  /**
   * Disconnect from a specific MCP server
   * @param {string} name - Server identifier
   */
  async disconnect(name) {
    const client = this.clients.get(name);
    if (client) {
      await client.close();
      this.clients.delete(name);
      console.log(`🔌 MCP: Disconnected from "${name}"`);
    }
  }

  /**
   * Disconnect all MCP clients
   */
  async disconnectAll() {
    console.log('🔌 MCP: Disconnecting all clients...');
    for (const [name, client] of this.clients.entries()) {
      await client.close();
      console.log(`🔌 MCP: Disconnected from "${name}"`);
    }
    this.clients.clear();
  }

  /**
   * List available tools from a specific server
   * @param {string} name - Server identifier
   * @returns {Promise<Array>} List of available tools
   */
  async listTools(name) {
    const client = await this.connect(name);
    const response = await client.listTools();
    return response.tools;
  }

  /**
   * Call a tool on a specific server
   * @param {string} name - Server identifier
   * @param {string} toolName - Tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Tool response
   */
  async callTool(name, toolName, args) {
    const client = await this.connect(name);
    const response = await client.callTool({
      name: toolName,
      arguments: args
    });
    return response;
  }

  /**
   * List available resources from a specific server
   * @param {string} name - Server identifier
   * @returns {Promise<Array>} List of available resources
   */
  async listResources(name) {
    const client = await this.connect(name);
    const response = await client.listResources();
    return response.resources;
  }

  /**
   * Read a resource from a specific server
   * @param {string} name - Server identifier
   * @param {string} uri - Resource URI
   * @returns {Promise<Object>} Resource content
   */
  async readResource(name, uri) {
    const client = await this.connect(name);
    const response = await client.readResource({ uri });
    return response;
  }

  /**
   * List available prompts from a specific server
   * @param {string} name - Server identifier
   * @returns {Promise<Array>} List of available prompts
   */
  async listPrompts(name) {
    const client = await this.connect(name);
    const response = await client.listPrompts();
    return response.prompts;
  }

  /**
   * Get a prompt from a specific server
   * @param {string} name - Server identifier
   * @param {string} promptName - Prompt name
   * @param {Object} args - Prompt arguments
   * @returns {Promise<Object>} Prompt response
   */
  async getPrompt(name, promptName, args) {
    const client = await this.connect(name);
    const response = await client.getPrompt({
      name: promptName,
      arguments: args
    });
    return response;
  }
}

// Singleton instance
const mcpManager = new MCPClientManager();

// Configure Notion MCP Server
// https://github.com/makenotion/notion-mcp-server
// Use the installed binary via npx --no-install to avoid cache directory issues
mcpManager.addServer('notion', {
  command: 'npx',
  args: [
    '--no-install',
    'notion-mcp-server'
  ],
  env: {
    // Notion MCP server expects NOTION_TOKEN env var
    NOTION_TOKEN: process.env.NOTION_API_KEY || ''
  }
});

export default mcpManager;
