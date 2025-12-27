# AI Usage Tracking System

## Overview

Track all AI usage (tagging, chat, memory) to Firestore for analytics, cost monitoring, and building internal dashboards.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI REQUESTS                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  /api/tag       │  /api/ai-chat   │  (future endpoints)         │
│  (tagging)      │  (Poppy chat)   │                             │
└────────┬────────┴────────┬────────┴─────────────────────────────┘
         │                 │
         ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    trackAIUsage()                                │
│  - Calculates cost from token usage                             │
│  - Creates fun readable doc ID (rafeh_qazi_red_panda_abc12)     │
│  - Writes to Firestore (non-blocking)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Firestore: ai_usage collection                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ rafeh_qazi_red_panda_abc12                                  ││
│  │ ├─ timestamp: "2025-12-26T..."                              ││
│  │ ├─ type: "tagging" | "ai_chat" | "memory"                   ││
│  │ ├─ model: "claude-sonnet-4-5-20250929"                      ││
│  │ ├─ inputTokens: 3621                                        ││
│  │ ├─ outputTokens: 119                                        ││
│  │ ├─ inputCost: 0.010863                                      ││
│  │ ├─ outputCost: 0.001785                                     ││
│  │ ├─ totalCost: 0.012648                                      ││
│  │ ├─ userId: "e6AqpI..."                                      ││
│  │ ├─ userEmail: "qazi@getpoppy.ai"                            ││
│  │ ├─ userName: "Rafeh Qazi"                                   ││
│  │ ├─ chatId: "dm:..." | "channel:..."                         ││
│  │ ├─ chatType: "dm" | "channel" | "ai"                        ││
│  │ ├─ messageId: "abc123" (for tagging)                        ││
│  │ └─ toolsUsed: ["search_chat_history", "get_topic_votes"]    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Document Schema

### Collection: `ai_usage`

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string (ISO) | When the AI call happened |
| `type` | string | `"tagging"`, `"ai_chat"`, or `"memory"` |
| `model` | string | Model used (e.g., `"claude-sonnet-4-5-20250929"`) |
| `inputTokens` | number | Tokens sent to Claude |
| `outputTokens` | number | Tokens received from Claude |
| `inputCost` | number | Cost for input tokens ($) |
| `outputCost` | number | Cost for output tokens ($) |
| `totalCost` | number | Total cost ($) |
| `userId` | string | Firebase UID of the user |
| `userEmail` | string | User's email |
| `userName` | string | User's display name |
| `chatId` | string | Chat ID (for tagging) |
| `chatType` | string | `"dm"`, `"channel"`, or `"ai"` |
| `messageId` | string | Message ID (for tagging only) |
| `toolsUsed` | array | Tools used during AI chat (for ai_chat only) |

### Document ID Format

Fun, memorable IDs for easy debugging:

```
{userName}_{color}_{animal}_{shortId}
```

Examples:
- `rafeh_qazi_red_panda_abc12`
- `david_rakosi_blue_tiger_xyz99`
- `unknown_gold_shark_mno34`

## Cost Calculation

Using Claude Sonnet 4 pricing:
- **Input**: $3 per 1M tokens
- **Output**: $15 per 1M tokens

```javascript
const inputCost = (inputTokens / 1_000_000) * 3
const outputCost = (outputTokens / 1_000_000) * 15
const totalCost = inputCost + outputCost
```

## Implementation

### `/api/tag/route.js`

Tracks every message tagging:

```javascript
trackAIUsage({
  type: 'tagging',
  model: MODEL,
  inputTokens,
  outputTokens,
  inputCost,
  outputCost,
  totalCost,
  userId: senderId,
  userEmail: senderEmail,
  userName: sender,
  messageId,
  chatId,
  chatType,
})
```

### `/api/ai-chat/route.js`

Tracks every Poppy conversation (including tool use):

```javascript
trackAIUsage({
  type: 'ai_chat',
  model: 'claude-sonnet-4-5-20250929',
  inputTokens: totalInputTokens,  // Cumulative across tool loop
  outputTokens: totalOutputTokens,
  inputCost,
  outputCost,
  totalCost,
  userId: user?.id,
  userEmail: user?.email,
  userName: user?.name,
  chatId: currentChat?.id,
  chatType: currentChat?.type,
  toolsUsed: toolsUsedList,
})
```

## Non-Blocking Writes

Tracking is fire-and-forget to avoid slowing down responses:

```javascript
// Don't await - let it run in background
trackAIUsage({...})
```

Errors are caught and logged but don't fail the request:

```javascript
} catch (error) {
  console.error('⚠️ Failed to track AI usage:', error.message)
}
```

## Future Dashboard Ideas

With this data, you can build internal dashboards showing:

### Cost Analytics
- 📊 Daily/weekly/monthly spend
- 📈 Spend trends over time
- 💰 Average cost per request

### User Analytics
- 👥 Cost per user leaderboard
- 🏆 Most active AI users
- 📉 User activity trends

### Feature Analytics
- 🏷️ Tagging vs Chat breakdown
- 🔧 Most used tools
- ⏱️ Token usage patterns

### Alerts & Budgets
- ⚠️ Daily spend alerts
- 🚨 Unusual usage detection
- 💵 Budget tracking

## Querying Examples

### Get today's total spend

```javascript
const today = new Date().toISOString().split('T')[0]
const snapshot = await adminDb.collection('ai_usage')
  .where('timestamp', '>=', today)
  .get()

const totalSpend = snapshot.docs.reduce((sum, doc) => 
  sum + doc.data().totalCost, 0)
```

### Get spend by user

```javascript
const snapshot = await adminDb.collection('ai_usage')
  .where('userName', '==', 'Rafeh Qazi')
  .get()
```

### Get AI chat requests with tools

```javascript
const snapshot = await adminDb.collection('ai_usage')
  .where('type', '==', 'ai_chat')
  .where('toolsUsed', '!=', [])
  .get()
```

## Files Modified

- `app/api/tag/route.js` - Added `trackAIUsage()` function and call
- `app/api/ai-chat/route.js` - Added `trackAIUsage()` function and call
- `app/lib/firebase-admin.js` - Updated to support env var for Vercel

## Environment Variables

For Vercel deployment, add:

- `FIREBASE_SERVICE_ACCOUNT_KEY` - JSON string of service account credentials

