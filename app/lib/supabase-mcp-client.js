import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * Supabase MCP Client
 * 
 * Connects to Supabase's MCP server via stdio for read-only database queries.
 * Uses @supabase/mcp-server-supabase package with --read-only mode.
 * 
 * Enables natural language queries like "What's our revenue today?"
 * 
 * Environment variables required:
 * - SUPABASE_ACCESS_TOKEN: Personal access token from Supabase dashboard
 * - SUPABASE_PROJECT_REF: Your project reference ID (found in project settings)
 */

class SupabaseMCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.isConnected = false;
    this.connectionPromise = null;
    
    // Configuration
    this.projectRef = process.env.SUPABASE_PROJECT_REF;
    this.accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    
    // Validate configuration on init
    if (!this.accessToken || this.accessToken === 'YOUR_SUPABASE_ACCESS_TOKEN_HERE') {
      console.warn('⚠️  SUPABASE_ACCESS_TOKEN not configured');
    }
    if (!this.projectRef || this.projectRef === 'YOUR_PROJECT_REF_HERE') {
      console.warn('⚠️  SUPABASE_PROJECT_REF not configured');
    }
  }

  /**
   * Check if Supabase MCP is properly configured
   */
  isConfigured() {
    return (
      this.accessToken && 
      this.accessToken !== 'YOUR_SUPABASE_ACCESS_TOKEN_HERE' &&
      this.projectRef && 
      this.projectRef !== 'YOUR_PROJECT_REF_HERE'
    );
  }

  /**
   * Connect to the Supabase MCP server via stdio
   * Uses singleton pattern to reuse connections
   */
  async connect() {
    // Return existing client if connected
    if (this.isConnected && this.client) {
      return this.client;
    }

    // Prevent multiple simultaneous connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    
    try {
      const result = await this.connectionPromise;
      return result;
    } finally {
      this.connectionPromise = null;
    }
  }

  async _connect() {
    if (!this.isConfigured()) {
      throw new Error(
        'Supabase MCP not configured. Please set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env.local'
      );
    }

    console.log('🔌 Connecting to Supabase MCP...');
    console.log(`   Project: ${this.projectRef}`);
    console.log('   Mode: READ-ONLY ✓');

    try {
      // Create stdio transport to spawn the Supabase MCP server
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: [
          '-y',
          '@supabase/mcp-server-supabase@latest',
          '--read-only',  // IMPORTANT: Enforces read-only access
          `--project-ref=${this.projectRef}`
        ],
        env: {
          ...process.env,
          SUPABASE_ACCESS_TOKEN: this.accessToken
        }
      });

      // Create MCP client
      this.client = new Client(
        {
          name: 'poppy-supabase-client',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      // Connect to server
      await this.client.connect(this.transport);
      this.isConnected = true;
      
      console.log('✅ Connected to Supabase MCP');
      
      return this.client;
    } catch (error) {
      console.error('❌ Failed to connect to Supabase MCP:', error);
      this.isConnected = false;
      this.client = null;
      throw error;
    }
  }

  /**
   * Disconnect from the Supabase MCP server
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
        console.log('🔌 Disconnected from Supabase MCP');
      } catch (error) {
        console.error('Error disconnecting from Supabase MCP:', error);
      } finally {
        this.client = null;
        this.transport = null;
        this.isConnected = false;
      }
    }
  }

  /**
   * List available tools from Supabase MCP
   */
  async listTools() {
    const client = await this.connect();
    const response = await client.listTools();
    return response.tools;
  }

  /**
   * Call a tool on the Supabase MCP server
   * @param {string} toolName - Name of the tool to call
   * @param {Object} args - Arguments for the tool
   */
  async callTool(toolName, args = {}) {
    const client = await this.connect();
    
    console.log(`📡 Supabase MCP: Calling tool "${toolName}"`);
    
    const response = await client.callTool({
      name: toolName,
      arguments: args
    });
    
    return response;
  }

  /**
   * Execute a SQL query (read-only)
   * This is a convenience method for the execute_sql tool
   * @param {string} query - SQL query to execute (SELECT only due to read_only mode)
   */
  async executeQuery(query) {
    return this.callTool('execute_sql', { query });
  }

  /**
   * List available resources from Supabase MCP
   */
  async listResources() {
    const client = await this.connect();
    const response = await client.listResources();
    return response.resources;
  }

  /**
   * Read a resource from Supabase MCP
   * @param {string} uri - Resource URI to read
   */
  async readResource(uri) {
    const client = await this.connect();
    const response = await client.readResource({ uri });
    return response;
  }

  /**
   * Get database schema information
   * Useful for AI to understand your data structure
   */
  async getSchema() {
    return this.callTool('get_schemas', {});
  }

  /**
   * List all tables in the database
   */
  async listTables() {
    return this.callTool('list_tables', {});
  }
}

// Singleton instance
const supabaseMCP = new SupabaseMCPClient();

export default supabaseMCP;
