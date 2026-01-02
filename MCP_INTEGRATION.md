# MCP (Model Context Protocol) Integration

This project integrates **MCP (Model Context Protocol)** using the official Anthropic SDK, allowing Poppy to connect to multiple MCP servers with a unified, extensible interface.

## What is MCP?

MCP is a standardized protocol that enables AI applications to securely connect to data sources and tools. Think of it as a universal adapter that lets your AI assistant talk to different services (Notion, Slack, GitHub, Supabase, etc.) through a consistent API.

## Architecture

```
┌──────────────────┐
│   Poppy Chat     │
│   (Your App)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  MCP API Route   │  ← /api/mcp (Next.js API)
│   (route.js)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  MCP Manager     │  ← Singleton client manager
│ (mcp-client.js)  │
└────────┬─────────┘
         │
         ├─────────────┬─────────────┬─────────────┐
         ▼             ▼             ▼             ▼
    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
    │ Notion │    │ Slack  │    │ GitHub │    │  ...   │
    │  MCP   │    │  MCP   │    │  MCP   │    │  More  │
    └────────┘    └────────┘    └────────┘    └────────┘
```

## Features

### ✅ Already Configured
- **Official TypeScript SDK** (`@modelcontextprotocol/sdk`) - 3.4M+ weekly downloads
- **Unified API** - Multiple endpoints for different MCP servers
- **Notion MCP** - Pre-configured and ready to use
- **Supabase MCP** - Read-only database queries via natural language
- **Extensible Design** - Add new MCPs easily

### 🎯 Supported Operations
- **Tools**: `list_tools`, `call_tool`
- **Resources**: `list_resources`, `read_resource`
- **Prompts**: `list_prompts`, `get_prompt`

---

## Quick Start

### 1. Get Your Notion API Key

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Name it (e.g., "Poppy Chat")
4. Select your workspace
5. Copy the **Internal Integration Secret**

### 2. Add to Environment Variables

Edit `.env.local`:

```bash
NOTION_API_KEY=secret_your_actual_notion_key_here
```

### 3. Share Notion Pages with Your Integration

**IMPORTANT**: Your Notion integration needs explicit access to pages!

1. Open any Notion page you want Poppy to access
2. Click **"⋯"** (three dots) → **"Add connections"**
3. Search for your integration name (e.g., "Poppy Chat")
4. Click to add it

Repeat for all pages/databases you want accessible.

### 4. Test the Connection

Try the API:

```bash
# List available MCP servers
curl http://localhost:3000/api/mcp

# List Notion tools
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "server": "notion",
    "action": "list_tools"
  }'
```

---

## Usage Examples

### Example 1: List Notion Tools

```javascript
const response = await fetch('/api/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    server: 'notion',
    action: 'list_tools'
  })
});

const { result } = await response.json();
console.log('Available tools:', result);
```

### Example 2: Search Notion

```javascript
const response = await fetch('/api/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    server: 'notion',
    action: 'call_tool',
    params: {
      toolName: 'search',
      args: {
        query: 'project roadmap'
      }
    }
  })
});

const { result } = await response.json();
console.log('Search results:', result);
```

### Example 3: Get Page Content

```javascript
const response = await fetch('/api/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    server: 'notion',
    action: 'call_tool',
    params: {
      toolName: 'get_page',
      args: {
        page_id: '12345678-1234-1234-1234-123456789abc'
      }
    }
  })
});

const { result } = await response.json();
console.log('Page content:', result);
```

### Example 4: List Resources

```javascript
const response = await fetch('/api/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    server: 'notion',
    action: 'list_resources'
  })
});

const { result } = await response.json();
console.log('Available resources:', result);
```

---

## Supabase MCP (Read-Only Database Queries)

The Supabase MCP integration allows you to query your Supabase database using natural language. Perfect for questions like:
- "What's our revenue today?"
- "How many users signed up yesterday?"
- "Show me the top 10 orders by amount"

### ⚠️ Security: READ-ONLY Mode

This integration is configured with `read_only=true`, which means:
- ✅ All SELECT queries work
- ❌ INSERT, UPDATE, DELETE are blocked
- ❌ DDL operations (CREATE, DROP, ALTER) are blocked

This ensures your data is safe from accidental modifications.

### Setup

#### 1. Get Your Supabase Credentials

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Find your **Project Reference ID** (also visible in your project URL: `https://[PROJECT_REF].supabase.co`)
5. Go to **Account** → **Access Tokens** to create a Personal Access Token

#### 2. Add Environment Variables

Edit `.env.local`:

```bash
# Supabase MCP Configuration
SUPABASE_ACCESS_TOKEN=sbp_your_personal_access_token_here
SUPABASE_PROJECT_REF=your_project_ref_here
```

#### 3. Test the Connection

```bash
# Check if Supabase MCP is configured
curl http://localhost:3007/api/supabase-mcp

# List available tools
curl -X POST http://localhost:3007/api/supabase-mcp \
  -H "Content-Type: application/json" \
  -d '{"action": "list_tools"}'
```

### Usage Examples

#### List Database Tables

```javascript
const response = await fetch('/api/supabase-mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'list_tables'
  })
});

const { result } = await response.json();
console.log('Tables:', result);
```

#### Execute a SQL Query

```javascript
const response = await fetch('/api/supabase-mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'execute_query',
    params: {
      query: "SELECT SUM(amount) as revenue FROM orders WHERE created_at >= CURRENT_DATE"
    }
  })
});

const { result } = await response.json();
console.log('Today\'s revenue:', result);
```

#### Get Database Schema

```javascript
const response = await fetch('/api/supabase-mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'get_schema'
  })
});

const { result } = await response.json();
console.log('Schema:', result);
```

#### Call Any Supabase MCP Tool

```javascript
const response = await fetch('/api/supabase-mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'call_tool',
    params: {
      toolName: 'get_table_info',
      args: { table_name: 'orders' }
    }
  })
});

const { result } = await response.json();
console.log('Table info:', result);
```

### Available Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `list_tools` | List available MCP tools | None |
| `call_tool` | Execute any tool | `toolName`, `args` |
| `execute_query` | Run a SQL SELECT query | `query` |
| `get_schema` | Get database schema info | None |
| `list_tables` | List all tables | None |
| `list_resources` | List available resources | None |
| `read_resource` | Read a specific resource | `uri` |

### Integrating with Poppy AI

You can enhance Poppy's AI to answer database questions:

```javascript
// In your AI chat handler
const tools = [
  {
    name: 'query_database',
    description: 'Query the Supabase database for business metrics like revenue, user counts, orders, etc.',
    input_schema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'SQL SELECT query to execute' 
        }
      },
      required: ['query']
    }
  }
];

// When Claude calls the tool
if (toolCall.name === 'query_database') {
  const result = await fetch('/api/supabase-mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'execute_query',
      params: { query: toolCall.input.query }
    })
  });
  // Return result to Claude for interpretation
}
```

---

## Adding More MCP Servers

Want to add Slack, GitHub, or other MCPs? It's super easy!

### Step 1: Find an MCP Server

- **Official Notion**: `@notionhq/notion-mcp-server` (✅ already added)
- **File System**: `@modelcontextprotocol/server-filesystem`
- **Slack**: Find community MCP servers on GitHub
- **GitHub**: Find community MCP servers on GitHub

Search [GitHub for "mcp-server"](https://github.com/topics/mcp-server) to find more.

### Step 2: Install the Package

```bash
yarn add @some-org/slack-mcp-server
```

### Step 3: Add to MCP Manager

Edit `app/lib/mcp-client.js`:

```javascript
// Add at the bottom, after Notion configuration
mcpManager.addServer('slack', {
  command: 'npx',
  args: ['-y', '@some-org/slack-mcp-server'],
  env: {
    SLACK_TOKEN: process.env.SLACK_TOKEN || ''
  }
});
```

### Step 4: Add Environment Variable

Edit `.env.local`:

```bash
SLACK_TOKEN=xoxb-your-slack-token
```

### Step 5: Use It!

```javascript
const response = await fetch('/api/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    server: 'slack',  // ← Your new server name
    action: 'list_tools'
  })
});
```

**That's it!** No need to modify the API route or create new endpoints. The MCP manager handles everything.

---

## API Reference

### POST `/api/mcp`

**Request Body:**

```typescript
{
  server: string;     // MCP server name (e.g., 'notion')
  action: string;     // Action to perform (see below)
  params?: object;    // Action-specific parameters
}
```

**Actions:**

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `list_tools` | List available tools | None |
| `call_tool` | Execute a tool | `toolName`, `args` |
| `list_resources` | List available resources | None |
| `read_resource` | Read a resource | `uri` |
| `list_prompts` | List available prompts | None |
| `get_prompt` | Get a prompt | `promptName`, `args` |

**Response:**

```typescript
{
  success: boolean;
  server: string;
  action: string;
  result: any;        // Action-specific result
  error?: string;     // Only if success = false
}
```

### GET `/api/mcp`

Lists all configured MCP servers.

**Response:**

```json
{
  "success": true,
  "servers": ["notion"],
  "message": "Available MCP servers"
}
```

---

## Notion-Specific Features

The Notion MCP server provides these tools:

### Core Tools
- **`search`** - Search across all pages
- **`get_page`** - Get page content (markdown format)
- **`get_database`** - Get database schema
- **`query_database`** - Query database with filters
- **`create_page`** - Create a new page
- **`update_page`** - Update existing page
- **`append_blocks`** - Add blocks to a page

### Features
- **Markdown API**: Optimized for LLMs (no complex JSON structures)
- **OAuth Support**: For multi-user applications
- **Rate Limits**: ~180 requests/minute (3 req/sec)
- **Official**: Maintained by Notion team

### Rate Limiting

Notion enforces rate limits:
- **Per integration**: ~180 requests/minute
- **Response**: HTTP 429 with `Retry-After` header

The MCP client automatically handles this, but be mindful when building high-frequency features.

---

## Troubleshooting

### Error: "MCP server 'notion' not configured"
Make sure you've added the server in `mcp-client.js`:
```javascript
mcpManager.addServer('notion', { ... });
```

### Error: "Missing NOTION_API_KEY"
Add it to `.env.local`:
```bash
NOTION_API_KEY=secret_your_key_here
```

### Error: "Object not found" (Notion)
Your integration doesn't have access to that page:
1. Open the page in Notion
2. Click **"⋯"** → **"Add connections"**
3. Select your integration

### Error: "Failed to connect to 'notion'"
Check logs for details:
- Verify `@notionhq/notion-mcp-server` is installed
- Ensure Node.js can find `npx` command
- Check environment variables are loaded

### Server Won't Start
The MCP client uses `npx` to start servers. Make sure:
- Node.js is installed
- `npx` is available in PATH
- Package is installed via `yarn add`

---

## Performance Considerations

### Connection Pooling
The MCP manager uses a singleton pattern and reuses connections:
```javascript
// First call: creates connection
await mcpManager.connect('notion');

// Subsequent calls: reuses existing connection
await mcpManager.connect('notion');
```

### Cleanup
Connections are kept alive for performance. To manually disconnect:
```javascript
await mcpManager.disconnect('notion');     // Disconnect one
await mcpManager.disconnectAll();          // Disconnect all
```

### Caching
Consider caching MCP responses for frequently-accessed data:
```javascript
// Cache Notion page content for 5 minutes
const cached = cache.get(`notion:page:${pageId}`);
if (cached) return cached;

const result = await fetch('/api/mcp', { /* ... */ });
cache.set(`notion:page:${pageId}`, result, 300);
```

---

## Security Best Practices

### 1. Never Expose API Keys
- ✅ Store in `.env.local`
- ❌ Never commit to git
- ❌ Never expose in client-side code

### 2. Validate User Access
Add authentication to `/api/mcp`:
```javascript
export async function POST(request) {
  // Get user session
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Continue with MCP logic...
}
```

### 3. Rate Limiting
Consider adding rate limiting per user:
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 30,                 // 30 requests per minute per user
  keyGenerator: (req) => req.session.userId
});
```

### 4. Input Validation
Always validate user input:
```javascript
import { z } from 'zod';

const mcpRequestSchema = z.object({
  server: z.enum(['notion']),  // Whitelist servers
  action: z.enum(['list_tools', 'call_tool', /* ... */]),
  params: z.object({}).optional()
});

const body = mcpRequestSchema.parse(await request.json());
```

---

## Integrating with Poppy AI

You can enhance Poppy's AI responses with Notion data:

### Option 1: Tool Calling

Give Poppy access to MCP tools via the Anthropic API:

```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    tools: [
      {
        name: 'search_notion',
        description: 'Search Notion pages',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
          },
          required: ['query']
        }
      }
    ],
    messages: [{ role: 'user', content: 'Find my project roadmap' }]
  })
});
```

Then handle tool calls:

```javascript
if (response.stop_reason === 'tool_use') {
  const toolUse = response.content.find(c => c.type === 'tool_use');

  const mcpResult = await fetch('/api/mcp', {
    method: 'POST',
    body: JSON.stringify({
      server: 'notion',
      action: 'call_tool',
      params: {
        toolName: 'search',
        args: toolUse.input
      }
    })
  });

  // Send result back to Claude...
}
```

### Option 2: Context Injection

Fetch Notion data and inject into prompts:

```javascript
// Fetch relevant Notion pages
const notionData = await fetch('/api/mcp', {
  method: 'POST',
  body: JSON.stringify({
    server: 'notion',
    action: 'call_tool',
    params: {
      toolName: 'search',
      args: { query: userQuestion }
    }
  })
});

// Include in AI prompt
const prompt = `
Context from Notion:
${JSON.stringify(notionData)}

User question: ${userQuestion}
`;
```

---

## Resources

- **MCP Documentation**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **TypeScript SDK**: [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- **Notion MCP**: [github.com/makenotion/notion-mcp-server](https://github.com/makenotion/notion-mcp-server)
- **Notion API Docs**: [developers.notion.com](https://developers.notion.com)
- **Supabase MCP**: [github.com/supabase-community/supabase-mcp](https://github.com/supabase-community/supabase-mcp)
- **Supabase MCP Docs**: [supabase.com/mcp](https://supabase.com/mcp)
- **Find MCP Servers**: [github.com/topics/mcp-server](https://github.com/topics/mcp-server)

---

## Contributing

Want to add more MCP servers? PRs welcome!

1. Add server configuration to `app/lib/mcp-client.js`
2. Add environment variable to `.env.local`
3. Update this README with usage examples
4. Test thoroughly

---

**Built with ❤️ using the Official MCP TypeScript SDK**
