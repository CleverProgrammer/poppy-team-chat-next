/**
 * Notion MCP Client (Vercel-Compatible)
 * 
 * Uses Notion's official MCP server via SSE (Server-Sent Events) transport.
 * This works on Vercel because it uses HTTP requests instead of child processes.
 */
import { createMCPClient } from './mcp/mcp-client.js';

/**
 * Notion MCP Manager for Vercel
 * Handles connection and tool management
 */
class NotionMCPManager {
  constructor() {
    this.mcpClient = null;
    this.tools = null;
  }

  /**
   * Connect to Notion MCP server via SSE
   */
  async connect() {
    if (this.mcpClient) {
      console.log('✅ Notion MCP: Using existing connection');
      return this.mcpClient;
    }

    const notionAccessToken = process.env.NOTION_API_KEY;
    if (!notionAccessToken) {
      throw new Error('NOTION_API_KEY environment variable is not set');
    }

    console.log('🔌 Notion MCP: Connecting to Notion MCP server via SSE...');
    this.mcpClient = await createMCPClient({
      transport: {
        type: 'sse',
        url: 'https://mcp.notion.com/sse',
        headers: {
          Authorization: `Bearer ${notionAccessToken}`,
        },
      },
      onUncaughtError: (error) => {
         
        console.error('Notion MCP client error:', error,notionAccessToken.length);
      },
    });
    console.log('✅ Notion MCP: Connected successfully');

    return this.mcpClient;
  }

  /**
   * List available tools from Notion MCP server
   */
  async listTools() {
    const client = await this.connect();
    
    if (!this.tools) {
      console.log('📋 Notion MCP: Loading tools...');
      this.tools = await client.tools();
      console.log(`📋 Notion MCP: Loaded ${Object.keys(this.tools).length} tools`);
    }
    
    return this.tools;
  }

  /**
   * Call a tool on the Notion MCP server
   */
  async callTool(toolName, args) {
    console.log(`🔧 Notion MCP: Calling tool ${toolName} with args:`, args);
    
    const client = await this.connect();
    const tools = await this.listTools();
    
    // Get the tool function
    const tool = tools[toolName];
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    try {
      // Execute the tool via MCP
      const result = await tool.execute(args, { toolCallId: `${Date.now()}` });
      
      console.log(`✅ Notion MCP: Tool ${toolName} completed successfully`);
      return result;
    } catch (error) {
      console.error(`❌ Notion MCP: Tool ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Close the MCP connection
   */
  async close() {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
      this.tools = null;
      console.log('🔌 Notion MCP: Connection closed');
    }
  }
}

// Singleton instance
const notionMCP = new NotionMCPManager();

export default notionMCP;
