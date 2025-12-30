import { NextResponse } from 'next/server';
import browserBaseMCPClient from '../../lib/browserbase-mcp-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Browser actions can take longer

/**
 * BrowserBase API Route
 *
 * Endpoint for browser automation using BrowserBase and Stagehand MCP.
 * Enables AI-powered web interactions like form filling, navigation, and scraping.
 *
 * Usage:
 * POST /api/browserbase
 * Body: {
 *   action: "list_tools" | "call_tool" | "navigate" | "fill_form" | "screenshot" | "extract",
 *   params: { ... }
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, params = {} } = body;

    // Validate action
    if (!action) {
      return NextResponse.json(
        { error: 'Missing "action" field' },
        { status: 400 }
      );
    }

    // Check if BrowserBase is configured
    if (!browserBaseMCPClient.isConfigured()) {
      return NextResponse.json(
        {
          error: 'BrowserBase not configured',
          message: 'Please set BROWSER_BASE_API_TOKEN and BROWSER_BASE_PROJECT_ID environment variables',
        },
        { status: 503 }
      );
    }

    console.log(`🌐 BrowserBase API: ${action}`);

    let result;

    switch (action) {
      // ==========================================
      // Core MCP Operations
      // ==========================================
      
      case 'list_tools':
        result = await browserBaseMCPClient.listTools();
        break;

      case 'call_tool':
        if (!params.toolName) {
          return NextResponse.json(
            { error: 'Missing "params.toolName" for call_tool action' },
            { status: 400 }
          );
        }
        result = await browserBaseMCPClient.callTool(
          params.toolName,
          params.args || {}
        );
        break;

      case 'list_resources':
        result = await browserBaseMCPClient.listResources();
        break;

      case 'read_resource':
        if (!params.uri) {
          return NextResponse.json(
            { error: 'Missing "params.uri" for read_resource action' },
            { status: 400 }
          );
        }
        result = await browserBaseMCPClient.readResource(params.uri);
        break;

      // ==========================================
      // High-Level Browser Actions
      // ==========================================

      case 'navigate':
        // Navigate to a URL and perform an action
        if (!params.url) {
          return NextResponse.json(
            { error: 'Missing "params.url" for navigate action' },
            { status: 400 }
          );
        }
        result = await browserBaseMCPClient.navigateAndAct(
          params.url,
          params.instruction || 'Observe the page content'
        );
        break;

      case 'fill_form':
        // Fill out a form on a webpage
        if (!params.url || !params.formData) {
          return NextResponse.json(
            { error: 'Missing "params.url" or "params.formData" for fill_form action' },
            { status: 400 }
          );
        }
        result = await browserBaseMCPClient.fillForm(
          params.url,
          params.formData,
          params.submitInstruction || 'Submit the form'
        );
        break;

      case 'screenshot':
        // Take a screenshot of the current page
        result = await browserBaseMCPClient.takeScreenshot();
        break;

      case 'extract':
        // Extract data from a webpage
        if (!params.url || !params.instruction) {
          return NextResponse.json(
            { error: 'Missing "params.url" or "params.instruction" for extract action' },
            { status: 400 }
          );
        }
        result = await browserBaseMCPClient.extractData(
          params.url,
          params.instruction
        );
        break;

      case 'click':
        // Click an element
        if (!params.selector) {
          return NextResponse.json(
            { error: 'Missing "params.selector" for click action' },
            { status: 400 }
          );
        }
        result = await browserBaseMCPClient.click(params.selector);
        break;

      case 'type':
        // Type text into an input
        if (!params.selector || !params.text) {
          return NextResponse.json(
            { error: 'Missing "params.selector" or "params.text" for type action' },
            { status: 400 }
          );
        }
        result = await browserBaseMCPClient.type(params.selector, params.text);
        break;

      case 'get_content':
        // Get page content
        result = await browserBaseMCPClient.getPageContent();
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
    });
  } catch (error) {
    console.error('❌ BrowserBase API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - Check BrowserBase status and capabilities
 */
export async function GET() {
  try {
    const isConfigured = browserBaseMCPClient.isConfigured();

    if (!isConfigured) {
      return NextResponse.json({
        success: true,
        configured: false,
        message: 'BrowserBase not configured. Set BROWSER_BASE_API_TOKEN and BROWSER_BASE_PROJECT_ID.',
        availableActions: [],
      });
    }

    // Try to list tools to verify connection
    let tools = [];
    let connectionStatus = 'unknown';
    
    try {
      tools = await browserBaseMCPClient.listTools();
      connectionStatus = 'connected';
    } catch {
      connectionStatus = 'disconnected';
    }

    return NextResponse.json({
      success: true,
      configured: true,
      connectionStatus,
      availableActions: [
        'list_tools',
        'call_tool',
        'list_resources',
        'read_resource',
        'navigate',
        'fill_form',
        'screenshot',
        'extract',
        'click',
        'type',
        'get_content',
      ],
      tools: tools.map(t => ({ name: t.name, description: t.description })),
      message: 'BrowserBase MCP server ready for browser automation',
    });
  } catch (error) {
    console.error('❌ BrowserBase API Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
