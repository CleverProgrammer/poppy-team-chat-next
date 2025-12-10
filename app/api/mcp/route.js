import { NextResponse } from 'next/server';
import mcpManager from '../../lib/mcp-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * MCP API Route
 *
 * Unified endpoint for interacting with all configured MCP servers
 *
 * Usage:
 * POST /api/mcp
 * Body: {
 *   server: "notion",
 *   action: "list_tools" | "call_tool" | "list_resources" | "read_resource" | "list_prompts" | "get_prompt",
 *   params: { ... }
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { server, action, params = {} } = body;

    // Validate server name
    if (!server) {
      return NextResponse.json(
        { error: 'Missing "server" field' },
        { status: 400 }
      );
    }

    // Validate action
    if (!action) {
      return NextResponse.json(
        { error: 'Missing "action" field' },
        { status: 400 }
      );
    }

    console.log(`📡 MCP API: ${action} on server "${server}"`);

    let result;

    switch (action) {
      case 'list_tools':
        result = await mcpManager.listTools(server);
        break;

      case 'call_tool':
        if (!params.toolName) {
          return NextResponse.json(
            { error: 'Missing "params.toolName" for call_tool action' },
            { status: 400 }
          );
        }
        result = await mcpManager.callTool(
          server,
          params.toolName,
          params.args || {}
        );
        break;

      case 'list_resources':
        result = await mcpManager.listResources(server);
        break;

      case 'read_resource':
        if (!params.uri) {
          return NextResponse.json(
            { error: 'Missing "params.uri" for read_resource action' },
            { status: 400 }
          );
        }
        result = await mcpManager.readResource(server, params.uri);
        break;

      case 'list_prompts':
        result = await mcpManager.listPrompts(server);
        break;

      case 'get_prompt':
        if (!params.promptName) {
          return NextResponse.json(
            { error: 'Missing "params.promptName" for get_prompt action' },
            { status: 400 }
          );
        }
        result = await mcpManager.getPrompt(
          server,
          params.promptName,
          params.args || {}
        );
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      server,
      action,
      result
    });

  } catch (error) {
    console.error('❌ MCP API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - List configured servers
 */
export async function GET() {
  try {
    // List all configured MCP servers
    const servers = Array.from(mcpManager.serverConfigs.keys());

    return NextResponse.json({
      success: true,
      servers,
      message: 'Available MCP servers'
    });
  } catch (error) {
    console.error('❌ MCP API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
