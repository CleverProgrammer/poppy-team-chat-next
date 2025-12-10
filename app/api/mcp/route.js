import { NextResponse } from 'next/server';
import notionClient from '../../lib/notion-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Notion API Route
 *
 * Endpoint for interacting with Notion directly (Vercel-compatible)
 *
 * Usage:
 * POST /api/mcp
 * Body: {
 *   action: "search" | "get_page" | "query_database" | "list_databases",
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

    console.log(`📡 Notion API: ${action}`);

    let result;

    switch (action) {
      case 'search':
        if (!params.query) {
          return NextResponse.json(
            { error: 'Missing "params.query" for search action' },
            { status: 400 }
          );
        }
        const searchResults = await notionClient.search(params.query);
        result = searchResults.map(page => ({
          id: page.id,
          title: notionClient.extractTextFromProperties(page.properties),
          url: page.url,
          last_edited: page.last_edited_time
        }));
        break;

      case 'get_page':
        if (!params.page_id) {
          return NextResponse.json(
            { error: 'Missing "params.page_id" for get_page action' },
            { status: 400 }
          );
        }
        const page = await notionClient.getPage(params.page_id);
        const blocks = await notionClient.getPageContent(params.page_id);
        result = {
          properties: notionClient.extractTextFromProperties(page.properties),
          content: notionClient.extractTextFromBlocks(blocks),
          url: page.url
        };
        break;

      case 'query_database':
        if (!params.database_id) {
          return NextResponse.json(
            { error: 'Missing "params.database_id" for query_database action' },
            { status: 400 }
          );
        }
        const dbResults = await notionClient.queryDatabase(
          params.database_id,
          params.filter || {}
        );
        result = dbResults.map(item => ({
          id: item.id,
          properties: notionClient.extractTextFromProperties(item.properties),
          url: item.url
        }));
        break;

      case 'list_databases':
        const databases = await notionClient.listDatabases();
        result = databases.map(db => ({
          id: db.id,
          title: notionClient.extractTextFromProperties(db.properties || {}),
          url: db.url
        }));
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Supported: search, get_page, query_database, list_databases` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
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
 * GET endpoint - Info about available Notion API
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    server: 'notion',
    message: 'Notion MCP API available',
    actions: ['search', 'get_page', 'query_database', 'list_databases']
  });
}
