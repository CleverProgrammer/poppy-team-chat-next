# Notion OAuth MCP Integration

This implementation follows the **Naz-Qazi/poppy** pattern for OAuth-based Notion MCP integration using SSE (Server-Sent Events) transport.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Chat UI)                        │
│                                                                 │
│  - User sends message                                           │
│  - Passes userId to API                                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Route (ai-chat)                          │
│                                                                 │
│  1. Receives message + userId                                   │
│  2. Calls setupNotionMCPIntegration(user)                      │
│  3. Gets Notion tools from MCP client                          │
│  4. Passes tools to Claude API                                  │
│  5. Handles tool use loop                                       │
│  6. Cleans up MCP clients                                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Notion MCP Client (notion-mcp-client.js)           │
│                                                                 │
│  setupNotionMCPIntegration(user):                              │
│    ├─> getValidNotionToken(userId)                            │
│    ├─> createNotionMCPClient(accessToken)                     │
│    ├─> getNotionMCPTools(mcpClient)                           │
│    └─> Returns { mcpTools, mcpClients }                       │
│                                                                 │
│  cleanupMCPClients(mcpClients):                                │
│    └─> Closes all MCP client connections                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│            Token Management (notion-token.js)                   │
│                                                                 │
│  getValidNotionToken(userId):                                  │
│    ├─> Fetches token from Firebase                            │
│    ├─> Checks expiration (2min buffer)                        │
│    ├─> Refreshes if needed                                    │
│    └─> Returns valid access_token                             │
│                                                                 │
│  refreshNotionToken(userId, notionData):                       │
│    ├─> POST https://mcp.notion.com/token                      │
│    ├─> grant_type=refresh_token                               │
│    ├─> Updates Firebase with new token                        │
│    └─> Returns new access_token                               │
│                                                                 │
│  clearInvalidNotionToken(userId):                              │
│    └─> Clears token on 401/Unauthorized errors                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Notion MCP Server (OAuth SSE)                   │
│                                                                 │
│  URL: https://mcp.notion.com/sse                               │
│  Transport: SSE (Server-Sent Events)                           │
│  Auth: Bearer <access_token>                                   │
│                                                                 │
│  Tools returned (prefixed with notion_):                       │
│    - notion_search                                             │
│    - notion_read_page                                          │
│    - notion_create_page                                        │
│    - notion_update_page                                        │
│    - notion_append_blocks                                      │
│    - notion_query_database                                     │
│    - notion_get_database                                       │
│    - ...and more                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

### 1. `/app/lib/notion-mcp-client.js`
**Core MCP integration logic**

Functions:
- `createNotionMCPClient(notionAccessToken)` - Creates SSE MCP client
- `getNotionMCPTools(mcpClient)` - Fetches and prefixes tools with `notion_`
- `setupNotionMCPIntegration(user)` - Main setup function
- `cleanupMCPClients(mcpClients)` - Closes connections

Key features:
- Uses `experimental_createMCPClient` from `ai` package
- SSE transport to `https://mcp.notion.com/sse`
- Bearer token authentication
- Tool prefixing to avoid conflicts
- Error handling with token cleanup on 401

### 2. `/app/lib/utils/notion-token.js`
**Token lifecycle management**

Functions:
- `getValidNotionToken(userId)` - Gets valid token, auto-refreshes if expired
- `refreshNotionToken(userId, notionData)` - Refreshes token via OAuth
- `clearInvalidNotionToken(userId)` - Clears invalid tokens
- `initializeNotionIntegration(userId, credentials)` - One-time setup

Key features:
- 2-minute expiration buffer
- Automatic token refresh
- Firebase Firestore storage
- Error recovery

### 3. `/app/api/ai-chat/route.js`
**Updated AI chat endpoint**

Changes from direct API approach:
- Imports `setupNotionMCPIntegration` and `cleanupMCPClients`
- Requires `userId` in request body
- Dynamically loads Notion tools via MCP
- Updates system prompt with Notion instructions
- Handles tool execution through MCP client
- Cleans up connections after completion

### 4. `/app/hooks/useAI.js`
**Client-side AI hook**

Changes:
- Passes `userId` to API endpoint
- Supports both `uid` and `authUserId` properties

## OAuth Credentials Storage

Credentials are stored in Firebase Firestore:

**Path:** `users/{userId}/integrations/notion`

**Structure:**
```javascript
{
  type: 'notion',
  createdAt: <timestamp>,
  updatedAt: <timestamp>,
  data: {
    access_token: "...",
    refresh_token: "...",
    client_id: "...",
    client_secret: "...",
    token_expires_at: <timestamp>,
    connected_at: <timestamp>
  }
}
```

## Setup Instructions

### Step 1: Install Dependencies
```bash
yarn add ai@^4.0.0
```
✅ **DONE** - Package installed successfully

### Step 2: Store OAuth Credentials

**Option A: Using initialization script**
```bash
node app/lib/utils/initialize-notion.js YOUR_USER_ID
```

**Option B: Manual Firebase setup**
Use Firebase Console to create the document at:
`users/{YOUR_USER_ID}/integrations/notion`

With the data structure shown above.

### Step 3: Test Integration

1. Start the development server:
```bash
yarn dev
```

2. Send a message in chat mentioning Notion:
```
"Search my Notion for information about X"
```

3. Check console logs for:
```
🔧 Notion MCP: Checking for integration...
✅ Notion MCP tools loaded: [...list of tools...]
🤖 Poppy AI: Calling Claude API with Sonnet 4.5...
🔧 Notion MCP: Executing tool: notion_search
```

## Provided OAuth Credentials

```javascript
{
  access_token: "101d872b-594c-8132-b0bc-000293705645:EnL3Kg4Jvrvu5hT1:0xCunB2EklSbVBkCb4ZKQJ1YSQr8PoAZ",
  client_id: "BGBP0L7gtJVUH1KV",
  client_secret: "LvA74OnTvBaKJSGwnQbcICouI4Sz2ZAG",
  refresh_token: "101d872b-594c-8132-b0bc-000293705645:EnL3Kg4Jvrvu5hT1:32L51xzA5rK8tonHQOuWt6G94ESYF3tx",
  token_expires_at: 1762810801308,  // Unix timestamp in milliseconds
  connected_at: 1762807201308
}
```

**Token Expiration:** January 10, 2026 (approximately)

## Differences from Naz-Qazi/poppy Implementation

### Similarities ✅
- OAuth-based authentication with Bearer tokens
- SSE transport to `https://mcp.notion.com/sse`
- Tool prefixing pattern (`notion_` prefix)
- Token refresh logic with 2-minute buffer
- MCP client cleanup after completion
- Firebase/Firestore for secure credential storage

### Differences 🔄
1. **Tool Loading:** We load tools upfront, Naz-Qazi uses dynamic loading via `notionDetectorTool`
2. **System Prompt:** We inject Notion instructions immediately, Naz-Qazi does it conditionally
3. **Tool Execution:** Simplified pattern without detector tool
4. **User Context:** We use a mock user object, Naz-Qazi has full user management

### Why Simplified?
The user requested: *"But here's the access token so don't implement the oauth logic"*

So we:
- ✅ Use OAuth MCP (not internal integration token)
- ✅ Skip OAuth flow (credentials provided)
- ✅ Implement token refresh
- ✅ Store credentials securely
- ⚠️ Simplified tool loading (no detector pattern)

## Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  getValidNotionToken(userId)                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
              Is token expired?
              (< 2min buffer)
                       │
            ┌──────────┴──────────┐
            │                     │
          YES                    NO
            │                     │
            ▼                     ▼
   refreshNotionToken()    Return access_token
            │
            ▼
   POST https://mcp.notion.com/token
   {
     grant_type: 'refresh_token',
     refresh_token: '...',
     client_id: '...',
     client_secret: '...'
   }
            │
            ▼
   Update Firebase:
   - new access_token
   - new token_expires_at
   - new refresh_token (if provided)
            │
            ▼
   Return new access_token
```

## Error Handling

### 401 Unauthorized
```javascript
// In notion-mcp-client.js
catch (error) {
  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
    await clearInvalidNotionToken(userId);
  }
}
```

### Token Refresh Failure
```javascript
// In notion-token.js
if (!response.ok) {
  console.error('❌ Token refresh failed:', {
    status: response.status,
    statusText: response.statusText,
  });
  return null;
}
```

### MCP Client Errors
```javascript
// In notion-mcp-client.js
onUncaughtError: (error) => {
  console.error('Notion MCP client error:', error);
}
```

## Tool Execution Example

```javascript
// When Claude calls a tool
{
  type: 'tool_use',
  id: 'toolu_123abc',
  name: 'notion_search',
  input: {
    query: 'project requirements'
  }
}

// We execute it via MCP client
const mcpClient = mcpClients[0];
const allTools = await mcpClient.tools();
const tool = allTools['notion_search'];
const result = await tool.execute({ query: 'project requirements' });

// Return to Claude
{
  type: 'tool_result',
  tool_use_id: 'toolu_123abc',
  content: JSON.stringify(result)
}
```

## System Prompt Integration

When Notion tools are available, the system prompt is enhanced:

```
<notion_integration>
  You have access to Notion MCP tools for interacting with Notion workspaces.

  Available Notion tools: notion_search, notion_read_page, ...

  RULES:
  - Use the available Notion MCP tools instead of providing general advice
  - These tools can directly interact with the user's connected Notion workspace
  - ALWAYS SEARCH NOTION BEFORE GIVING UP
  - If you don't immediately know an answer, search Notion FIRST
  - Try different tools and keywords if needed - be persistent
  - Only say "I don't know" as an ABSOLUTE LAST RESORT
  - Don't ask permission to search - just do it
</notion_integration>
```

## Security Considerations

1. **Credentials Storage:** OAuth credentials stored in Firebase Firestore (secure, server-side)
2. **Token Expiration:** Automatic refresh with 2-minute buffer
3. **Error Cleanup:** Invalid tokens cleared on 401 errors
4. **Connection Cleanup:** MCP clients closed after each request
5. **No Client Exposure:** Tokens never sent to client browser

## Testing Checklist

- [ ] Run initialization script with your user ID
- [ ] Verify Firebase document created at `users/{userId}/integrations/notion`
- [ ] Start dev server and send test message
- [ ] Check console for tool loading logs
- [ ] Verify Claude can call Notion tools
- [ ] Test token refresh (manually expire token and retry)
- [ ] Test error handling (invalid token scenario)
- [ ] Verify MCP client cleanup (no connection leaks)

## Troubleshooting

### "No valid Notion token available"
- Run initialization script
- Check Firebase document exists
- Verify access_token is not empty

### "401 Unauthorized"
- Token may be invalid/expired
- Check token_expires_at timestamp
- Try manual token refresh
- Verify OAuth credentials are correct

### "No MCP client available"
- Check Notion integration exists in Firebase
- Verify `setupNotionMCPIntegration` is called
- Check for errors in MCP client creation

### "Tool not found"
- Check tool name has `notion_` prefix
- Verify MCP client returned tools successfully
- Check Claude is calling correct tool name

## Next Steps

1. **Run initialization script** to store credentials
2. **Test basic search** to verify connection
3. **Monitor token refresh** behavior
4. **Consider adding OAuth flow** for production (optional)
5. **Add user-facing integration UI** (like Naz-Qazi pattern)

## References

- **Naz-Qazi/poppy:** https://github.com/Naz-Qazi/poppy
- **Key file:** `apps/poppyai-web/src/app/api/chat/notionMcpUtils.ts`
- **OAuth flow:** `apps/poppyai-web/src/app/api/auth/notion/`
- **Token utils:** `apps/poppyai-web/src/lib/utils/integrations/notion.ts`
