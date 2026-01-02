import { NextResponse } from 'next/server';
import supabaseMCP from '../../lib/supabase-mcp-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Supabase MCP API Route
 * 
 * Provides read-only access to Supabase database via MCP.
 * Perfect for natural language queries like "What's our revenue today?"
 * 
 * Usage:
 * POST /api/supabase-mcp
 * Body: {
 *   action: "list_tools" | "call_tool" | "execute_query" | "get_schema" | "list_tables",
 *   params: { ... }
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, params = {} } = body;

    // Check if Supabase MCP is configured
    if (!supabaseMCP.isConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Supabase MCP not configured',
          details: 'Please set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env.local'
        },
        { status: 503 }
      );
    }

    // Validate action
    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing "action" field' },
        { status: 400 }
      );
    }

    console.log(`📡 Supabase MCP API: ${action}`);

    let result;

    switch (action) {
      case 'list_tools':
        result = await supabaseMCP.listTools();
        break;

      case 'call_tool':
        if (!params.toolName) {
          return NextResponse.json(
            { success: false, error: 'Missing "params.toolName" for call_tool action' },
            { status: 400 }
          );
        }
        result = await supabaseMCP.callTool(params.toolName, params.args || {});
        break;

      case 'execute_query':
        if (!params.query) {
          return NextResponse.json(
            { success: false, error: 'Missing "params.query" for execute_query action' },
            { status: 400 }
          );
        }
        // Note: read_only mode is enforced at the MCP server level
        result = await supabaseMCP.executeQuery(params.query);
        break;

      case 'get_schema':
        result = await supabaseMCP.getSchema();
        break;

      case 'list_tables':
        result = await supabaseMCP.listTables();
        break;

      case 'list_resources':
        result = await supabaseMCP.listResources();
        break;

      case 'read_resource':
        if (!params.uri) {
          return NextResponse.json(
            { success: false, error: 'Missing "params.uri" for read_resource action' },
            { status: 400 }
          );
        }
        result = await supabaseMCP.readResource(params.uri);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
      readOnly: true // Always indicate this is read-only
    });

  } catch (error) {
    console.error('❌ Supabase MCP API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - Check configuration status
 */
export async function GET() {
  const isConfigured = supabaseMCP.isConfigured();
  
  return NextResponse.json({
    success: true,
    configured: isConfigured,
    readOnly: true,
    message: isConfigured 
      ? 'Supabase MCP is configured and ready (read-only mode)'
      : 'Supabase MCP not configured. Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env.local',
    availableActions: [
      'list_tools',
      'call_tool',
      'execute_query',
      'get_schema',
      'list_tables',
      'list_resources',
      'read_resource'
    ]
  });
}

