/**
 * Notion MCP Client
 * 
 * OAuth-based Model Context Protocol integration for Notion.
 * Uses SSE (Server-Sent Events) transport to connect to https://mcp.notion.com/sse
 * Based on Naz-Qazi/poppy implementation pattern.
 */

import { experimental_createMCPClient as createMCPClient } from 'ai';
import { getValidNotionToken, clearInvalidNotionToken } from './utils/notion-token.js';

/**
 * Creates and configures a Notion MCP client with the provided access token
 * @param {string} notionAccessToken - Valid Notion OAuth access token
 * @returns {Promise<Object>} MCP Client with tools() and close() methods
 */
async function createNotionMCPClient(notionAccessToken) {
  return await createMCPClient({
    transport: {
      type: 'sse',
      url: 'https://mcp.notion.com/sse',
      headers: {
        Authorization: `Bearer ${notionAccessToken}`,
      },
    },
    onUncaughtError: (error) => {
      console.error('Notion MCP client error:', error);
    },
  });
}

/**
 * Fetches and prefixes Notion tools to avoid naming conflicts
 * @param {Object} mcpClient - MCP Client instance
 * @returns {Promise<Object>} Prefixed tool definitions
 */
async function getNotionMCPTools(mcpClient) {
  const notionTools = await mcpClient.tools();

  // Prefix tools with 'notion_' to avoid naming conflicts
  const prefixedNotionTools = Object.entries(notionTools).reduce(
    (acc, [toolName, toolConfig]) => {
      const prefixedName = `notion_${toolName}`;
      acc[prefixedName] = toolConfig;
      return acc;
    },
    {}
  );

  return prefixedNotionTools;
}

/**
 * Sets up Notion MCP integration and returns tools and clients
 * @returns {Promise<Object>} Object with mcpTools and mcpClients arrays
 */
export async function setupNotionMCPIntegration() {
  const mcpClients = [];
  let mcpTools = {};

  // Get access token from environment (with auto-refresh)
  const notionAccessToken = await getValidNotionToken();
  if (!notionAccessToken) {
    console.log('ℹ️ No valid Notion token available in .env');
    return { mcpTools, mcpClients };
  }

  try {
    const mcpClient = await createNotionMCPClient(notionAccessToken);

    try {
      const prefixedNotionTools = await getNotionMCPTools(mcpClient);
      mcpTools = { ...mcpTools, ...prefixedNotionTools };
      mcpClients.push(mcpClient);

      console.log('✅ Notion MCP tools loaded:', Object.keys(prefixedNotionTools));
    } catch (error) {
      console.error('Failed to fetch Notion MCP tools:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // If 401, clear cache and try to refresh token for next request
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        console.log('⚠️ Got 401 when fetching tools, token may be invalid');
        clearInvalidNotionToken();
      }
    }
  } catch (error) {
    console.error('Failed to create Notion MCP client:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Clear invalid token on 401/Unauthorized and force refresh next time
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      console.log('⚠️ Got 401 when creating client, will force token refresh next request');
      clearInvalidNotionToken();
    }
  }

  return { mcpTools, mcpClients };
}

/**
 * Cleanup MCP clients by closing their connections
 * @param {Array<Object>} mcpClients - Array of MCP client instances
 * @returns {Promise<void>}
 */
export async function cleanupMCPClients(mcpClients) {
  try {
    if (!mcpClients || !mcpClients.length) return;

    await Promise.all(mcpClients.map(client => client.close()));
    console.log('🧹 MCP clients cleaned up successfully');
  } catch (error) {
    console.error('❌ Error cleaning up MCP clients:', error);
  }
}
