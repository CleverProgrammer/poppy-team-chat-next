import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

/**
 * BrowserBase MCP Client Manager
 * 
 * Provides browser automation capabilities through BrowserBase and Stagehand
 * for AI-powered web interactions like form filling, navigation, and scraping.
 * 
 * Environment Variables Required:
 * - BROWSER_BASE_API_TOKEN: Your BrowserBase API token
 * - BROWSER_BASE_PROJECT_ID: Your BrowserBase project ID
 */
class BrowserBaseMCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.serverProcess = null;
    this.isConnected = false;
    
    // Validate environment variables
    this.apiToken = process.env.BROWSER_BASE_API_TOKEN;
    this.projectId = process.env.BROWSER_BASE_PROJECT_ID;
    
    if (!this.apiToken) {
      console.warn('⚠️  BROWSER_BASE_API_TOKEN not configured');
    }
    if (!this.projectId) {
      console.warn('⚠️  BROWSER_BASE_PROJECT_ID not configured');
    }
  }

  /**
   * Check if BrowserBase credentials are configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return !!(this.apiToken && this.projectId);
  }

  /**
   * Connect to the BrowserBase MCP server
   * @returns {Promise<Client>} Connected MCP client
   */
  async connect() {
    if (this.isConnected && this.client) {
      console.log('✅ Using existing BrowserBase MCP connection');
      return this.client;
    }

    if (!this.isConfigured()) {
      throw new Error(
        'BrowserBase MCP not configured. Please set BROWSER_BASE_API_TOKEN and BROWSER_BASE_PROJECT_ID environment variables.'
      );
    }

    console.log('🔌 Connecting to BrowserBase MCP server...');

    try {
      // Spawn the BrowserBase MCP server process
      this.serverProcess = spawn('npx', ['-y', '@browserbasehq/mcp-server-browserbase'], {
        env: {
          ...process.env,
          BROWSERBASE_API_KEY: this.apiToken,
          BROWSERBASE_PROJECT_ID: this.projectId,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Handle server errors
      this.serverProcess.stderr.on('data', (data) => {
        const message = data.toString();
        // Filter out noise, only log important messages
        if (message.includes('Error') || message.includes('error')) {
          console.error('BrowserBase MCP stderr:', message);
        }
      });

      this.serverProcess.on('error', (error) => {
        console.error('❌ BrowserBase MCP server error:', error);
        this.isConnected = false;
      });

      this.serverProcess.on('exit', (code) => {
        console.log(`BrowserBase MCP server exited with code ${code}`);
        this.isConnected = false;
        this.client = null;
      });

      // Create stdio transport
      this.transport = new StdioClientTransport({
        reader: this.serverProcess.stdout,
        writer: this.serverProcess.stdin,
      });

      // Create MCP client
      this.client = new Client(
        {
          name: 'poppy-browserbase-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect to server
      await this.client.connect(this.transport);
      this.isConnected = true;

      console.log('✅ Successfully connected to BrowserBase MCP server');
      return this.client;
    } catch (error) {
      console.error('❌ Failed to connect to BrowserBase MCP server:', error);
      await this.disconnect();
      throw error;
    }
  }

  /**
   * Disconnect from the BrowserBase MCP server
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.warn('Warning closing client:', error.message);
      }
      this.client = null;
    }

    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }

    this.isConnected = false;
    console.log('🔌 Disconnected from BrowserBase MCP server');
  }

  /**
   * List available tools from the BrowserBase MCP server
   * @returns {Promise<Array>} List of available tools
   */
  async listTools() {
    const client = await this.connect();
    const response = await client.listTools();
    return response.tools;
  }

  /**
   * Call a tool on the BrowserBase MCP server
   * @param {string} toolName - Name of the tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Tool response
   */
  async callTool(toolName, args = {}) {
    const client = await this.connect();
    const response = await client.callTool({
      name: toolName,
      arguments: args,
    });
    return response;
  }

  /**
   * List available resources from the BrowserBase MCP server
   * @returns {Promise<Array>} List of available resources
   */
  async listResources() {
    const client = await this.connect();
    const response = await client.listResources();
    return response.resources;
  }

  /**
   * Read a resource from the BrowserBase MCP server
   * @param {string} uri - Resource URI
   * @returns {Promise<Object>} Resource content
   */
  async readResource(uri) {
    const client = await this.connect();
    const response = await client.readResource({ uri });
    return response;
  }

  // ==========================================
  // High-Level Browser Automation Methods
  // ==========================================

  /**
   * Navigate to a URL and interact with the page
   * @param {string} url - URL to navigate to
   * @param {string} instruction - What to do on the page (e.g., "fill out the contact form with...")
   * @returns {Promise<Object>} Action result
   */
  async navigateAndAct(url, instruction) {
    return this.callTool('browserbase_navigate', {
      url,
      instruction,
    });
  }

  /**
   * Take a screenshot of the current page
   * @returns {Promise<Object>} Screenshot data
   */
  async takeScreenshot() {
    return this.callTool('browserbase_screenshot', {});
  }

  /**
   * Fill out a form on a web page
   * @param {string} url - URL of the form
   * @param {Object} formData - Form field values
   * @param {string} submitInstruction - Optional instruction for submission
   * @returns {Promise<Object>} Form submission result
   */
  async fillForm(url, formData, submitInstruction = 'Submit the form') {
    const instruction = `Fill out the form with the following data: ${JSON.stringify(formData)}. Then ${submitInstruction}.`;
    return this.navigateAndAct(url, instruction);
  }

  /**
   * Extract data from a web page
   * @param {string} url - URL to scrape
   * @param {string} extractionInstruction - What data to extract
   * @returns {Promise<Object>} Extracted data
   */
  async extractData(url, extractionInstruction) {
    return this.navigateAndAct(url, `Extract the following information: ${extractionInstruction}`);
  }

  /**
   * Click an element on the page
   * @param {string} selector - Element selector or description
   * @returns {Promise<Object>} Click result
   */
  async click(selector) {
    return this.callTool('browserbase_click', {
      selector,
    });
  }

  /**
   * Type text into an input field
   * @param {string} selector - Input selector or description
   * @param {string} text - Text to type
   * @returns {Promise<Object>} Type result
   */
  async type(selector, text) {
    return this.callTool('browserbase_type', {
      selector,
      text,
    });
  }

  /**
   * Get the current page's text content
   * @returns {Promise<Object>} Page content
   */
  async getPageContent() {
    return this.callTool('browserbase_get_content', {});
  }
}

// Singleton instance
const browserBaseMCPClient = new BrowserBaseMCPClient();

export default browserBaseMCPClient;
