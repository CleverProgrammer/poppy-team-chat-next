import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Klavis } from 'klavis';

// MCP Client Manager with Klavis API Integration
// Creates per-user stratas for isolated memory storage

class MCPClientManager {
  constructor() {
    this.clients = new Map(); // Store active MCP clients by userId
    this.strataUrls = new Map(); // Store strata URLs by userId

    // Initialize Klavis client
    const apiKey = process.env.KLAVIS_API_KEY;
    if (apiKey && apiKey !== 'YOUR_KLAVIS_API_KEY_HERE') {
      this.klavis = new Klavis.Client({ apiKey });
      console.log('✅ Klavis API client initialized');
    } else {
      console.warn('⚠️  KLAVIS_API_KEY not configured, falling back to direct URL mode');
      this.klavis = null;
    }
  }

  /**
   * Get or create a strata for a specific user
   * @param {string} userId - Unique user identifier
   * @returns {Promise<string>} Strata server URL
   */
  async getOrCreateStrata(userId) {
    // Check if we already have a strata URL for this user
    if (this.strataUrls.has(userId)) {
      return this.strataUrls.get(userId);
    }

    // If no Klavis API client, fall back to shared strata
    if (!this.klavis) {
      console.warn('⚠️  Using shared strata (no API key configured)');
      const fallbackUrl = process.env.KLAVIS_DIRECT_URL || 'https://strata.klavis.ai/mcp/';
      this.strataUrls.set(userId, fallbackUrl);
      return fallbackUrl;
    }

    console.log(`🔧 Creating Klavis strata for user: ${userId}`);

    try {
      // Create a new strata for this user via Klavis API
      const response = await this.klavis.strata.create({
        userId: userId,
        servers: ['MEM0'] // Only need Mem0 for memory storage
      });

      const strataUrl = response.strataServerUrl;
      console.log(`✅ Created strata for ${userId}: ${strataUrl}`);

      // Cache the URL
      this.strataUrls.set(userId, strataUrl);

      return strataUrl;
    } catch (error) {
      console.error(`❌ Failed to create strata for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Connect to MCP server for a specific user
   * @param {string} userId - User identifier
   * @returns {Promise<Client>} Connected MCP client
   */
  async connect(userId) {
    if (this.clients.has(userId)) {
      console.log(`✅ Using existing MCP connection for user: ${userId}`);
      return this.clients.get(userId);
    }

    console.log(`🔌 Connecting to MCP for user: ${userId}`);

    try {
      // Get or create strata URL for this user
      const strataUrl = await this.getOrCreateStrata(userId);

      // Create transport
      const transport = new StreamableHTTPClientTransport(
        new URL(strataUrl),
        {
          headers: process.env.KLAVIS_DIRECT_URL ? {} : {
            'Authorization': `Bearer ${process.env.KLAVIS_BEARER_TOKEN || ''}`
          }
        }
      );

      // Create MCP client
      const client = new Client({
        name: `poppy-${userId}-client`,
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Connect to server
      await client.connect(transport);

      this.clients.set(userId, client);
      console.log(`✅ Successfully connected MCP for user: ${userId}`);

      return client;
    } catch (error) {
      console.error(`❌ Failed to connect MCP for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from a specific user's MCP server
   * @param {string} userId - User identifier
   */
  async disconnect(userId) {
    const client = this.clients.get(userId);
    if (client) {
      await client.close();
      this.clients.delete(userId);
      console.log(`🔌 Disconnected MCP for user: ${userId}`);
    }
  }

  /**
   * Disconnect all MCP clients
   */
  async disconnectAll() {
    console.log('🔌 Disconnecting all MCP clients...');
    for (const [userId, client] of this.clients.entries()) {
      await client.close();
      console.log(`🔌 Disconnected from user: ${userId}`);
    }
    this.clients.clear();
  }

  /**
   * List available tools for a user
   * @param {string} userId - User identifier
   * @returns {Promise<Array>} List of available tools
   */
  async listTools(userId) {
    const client = await this.connect(userId);
    const response = await client.listTools();
    return response.tools;
  }

  /**
   * Call a tool for a specific user
   * @param {string} userId - User identifier
   * @param {string} toolName - Tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Tool response
   */
  async callTool(userId, toolName, args) {
    const client = await this.connect(userId);
    const response = await client.callTool({
      name: toolName,
      arguments: args
    });
    return response;
  }

  /**
   * List available resources for a user
   * @param {string} userId - User identifier
   * @returns {Promise<Array>} List of available resources
   */
  async listResources(userId) {
    const client = await this.connect(userId);
    const response = await client.listResources();
    return response.resources;
  }

  /**
   * Read a resource for a specific user
   * @param {string} userId - User identifier
   * @param {string} uri - Resource URI
   * @returns {Promise<Object>} Resource content
   */
  async readResource(userId, uri) {
    const client = await this.connect(userId);
    const response = await client.readResource({ uri });
    return response;
  }

  /**
   * List available prompts for a user
   * @param {string} userId - User identifier
   * @returns {Promise<Array>} List of available prompts
   */
  async listPrompts(userId) {
    const client = await this.connect(userId);
    const response = await client.listPrompts();
    return response.prompts;
  }

  /**
   * Get a prompt for a specific user
   * @param {string} userId - User identifier
   * @param {string} promptName - Prompt name
   * @param {Object} args - Prompt arguments
   * @returns {Promise<Object>} Prompt response
   */
  async getPrompt(userId, promptName, args) {
    const client = await this.connect(userId);
    const response = await client.getPrompt({
      name: promptName,
      arguments: args
    });
    return response;
  }
}

// Singleton instance
const mcpManager = new MCPClientManager();

export default mcpManager;
