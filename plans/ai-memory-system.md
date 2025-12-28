# 🧠 AI Memory System: Architecture & Permissions

> **Status**: ✅ Implemented & Live  
> **Last Updated**: December 28, 2025  
> **Purpose**: Reference documentation for how Poppy's AI memory works

---

## Overview

Poppy's AI memory is powered by **Ragie** (vector database) for semantic search and retrieval. Every message sent in the app is automatically indexed with rich metadata, enabling Poppy to answer questions about past conversations with proper permission scoping.

---

## The Core Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MESSAGE FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   User sends message                                                         │
│         │                                                                    │
│         ▼                                                                    │
│   ┌─────────────┐                                                            │
│   │  Firestore  │  ← Message saved (visible in UI)                          │
│   └──────┬──────┘                                                            │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────┐                                                            │
│   │  /api/tag   │  ← Claude AI classifies & tags the message                │
│   └──────┬──────┘                                                            │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────┐                                                            │
│   │    Ragie    │  ← Message indexed with metadata for semantic search      │
│   └─────────────┘                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## What Gets Indexed to Ragie

Every message is indexed with the following metadata:

### Core Fields (All Messages)
| Field | Description | Example |
|-------|-------------|---------|
| `messageId` | Unique message ID | `"abc123"` |
| `chatId` | Chat identifier | `"general"`, `"group_xyz"`, `"uid1_uid2"` |
| `chatType` | Type of chat | `"channel"`, `"dm"`, `"group"`, `"team_memory"` |
| `chatName` | Human-readable name | `"Dev Gang 💯"`, `"Rafeh, Athena"` |
| `sender` | Display name | `"Rafeh Qazi"` |
| `senderEmail` | Email | `"qazi@cleverprogrammer.com"` |
| `senderId` | User UID | `"uid_abc123"` |
| `timestamp` | ISO timestamp | `"2025-12-28T10:30:00Z"` |

### DM-Specific Fields
| Field | Description |
|-------|-------------|
| `participants` | Array of UIDs in the DM |
| `recipientId` | UID of message recipient |
| `recipientName` | Display name of recipient |
| `recipientEmail` | Email of recipient |

### Group-Specific Fields
| Field | Description |
|-------|-------------|
| `participants` | Array of all group member UIDs |
| `chatName` | Group name or member names |

### AI-Generated Fields (from tagging)
| Field | Description |
|-------|-------------|
| `message_type` | `task`, `feature_request`, `question`, `bug`, `decision`, etc. |
| `canonical_tag` | Normalized topic ID (e.g., `dark_mode`, `mobile_notifications`) |
| `tags` | Array of keywords |
| `summary` | AI-generated summary |
| `queries` | Related search queries |
| `priority` | `critical`, `high`, `medium`, `low` |
| `assignee` | Who should do it |
| `status` | `in_progress`, `complete`, `cancelled` |

---

## Permission Scopes

The magic of Poppy's memory is **context-aware permission filtering**. What you can search depends on WHERE you're chatting.

### Permission Matrix

| Current Context | What You Can Search |
|-----------------|---------------------|
| **AI Chat (@poppy)** | Everything: own messages, DMs received, all channels, all groups you're in, team memory |
| **DM** | This specific DM + all channels + team memory |
| **Group** | This specific group + all channels + team memory |
| **Channel** | All channels + team memory (no DMs or groups) |
| **No context** | Team memory only |

### How It Works (Code Reference)

```javascript
// From app/lib/retrieval-router.js

if (currentChat?.type === 'ai') {
  // AI assistant: full access
  filter = {
    $or: [
      { senderId: { $eq: userId } },      // Messages I sent
      { recipientId: { $eq: userId } },   // DMs sent TO me
      { chatType: { $eq: 'channel' } },   // All channel messages
      // Groups where user is a participant
      { $and: [{ chatType: { $eq: 'group' } }, { participants: { $contains: userId } }] },
      { chatType: { $eq: 'team_memory' } } // Team memory (always)
    ]
  };
} else if (currentChat?.type === 'group') {
  // Group: only this group + channels + team memory
  filter = {
    $or: [
      { chatId: { $eq: groupId } },
      { chatType: { $eq: 'channel' } },
      { chatType: { $eq: 'team_memory' } }
    ]
  };
} else if (currentChat?.type === 'dm') {
  // DM: only this DM + channels + team memory
  filter = {
    $or: [
      { chatId: { $eq: dmId } },
      { chatType: { $eq: 'channel' } },
      { chatType: { $eq: 'team_memory' } }
    ]
  };
}
```

---

## Team Memory (Special Type)

Team Memory is a special `chatType` that bypasses ALL permission filters. It's globally accessible to everyone.

### How to Add to Team Memory

Users can ask Poppy to remember things:
- "Remember that our API key format is XYZ"
- "Save to team memory: office WiFi password is ..."
- "Add this to memory: meeting notes from today..."

### Team Memory Metadata
```javascript
{
  chatType: 'team_memory',
  chatId: 'team_memory',
  isTeamMemory: true,
  addedViaAI: true,
  addedBy: 'Rafeh Qazi',
  context: 'Office information',
  // Optional: images
  imageUrls: [...],
  contentType: 'image'
}
```

---

## Searchable Content Structure

Each message indexed to Ragie includes enriched searchable content:

```
[Rafeh Qazi]: Can we add dark mode? My eyes hurt at night.
[Chat: Dev Gang 💯]
[Summary]: User requesting dark mode feature for eye strain
[Keywords]: dark_mode, ui, accessibility, night_mode, eye_strain
[Related queries]: dark mode request, night mode, screen too bright
```

This enables queries like:
- "what did they say in dev gang about dark mode?"
- "who mentioned eye strain?"
- "when was dark mode requested?"

---

## How AI Retrieval Works

When Poppy needs context, it calls the `search_chat_history` tool:

### Tool Definition
```javascript
{
  name: "search_chat_history",
  description: "Search past messages from the team's chat history",
  input_schema: {
    query: "what to search for",
    start_date: "optional ISO date",
    end_date: "optional ISO date"
  }
}
```

### Retrieval Process
1. User asks a question in chat
2. Claude determines if historical context is needed
3. Claude calls `search_chat_history` with a query
4. `retrieval-router.js` builds permission filter based on current context
5. Ragie returns top 50 semantically-matched chunks
6. Results formatted and returned to Claude
7. Claude synthesizes response with context

---

## Date Filtering

Poppy supports time-based queries:

- "What did we discuss yesterday?"
- "Show me messages from last week about the API"
- "What was decided in December about pricing?"

Date filters are applied on top of permission filters:
```javascript
filter = {
  $and: [
    permissionFilter,
    { timestamp: { $gte: startDate } },
    { timestamp: { $lte: endDate } }
  ]
};
```

---

## Chat Name Resolution

For natural language queries like "what did they say in fulfillment gang?", we index human-readable names:

### Channel Names (Hardcoded Mapping)
```javascript
const CHANNEL_NAMES = {
  'general': 'general',
  'dev-gang': 'Dev Gang 💯',
  'test': 'test',
}
```

### Group Names (Dynamic)
```javascript
// From group document
const groupName = groupData?.name || groupData?.memberNames?.join(', ') || 'Group Chat'
// Examples: "Sales Team", "Rafeh, Athena, Amaanath"
```

---

## Files & Functions Reference

### Key Files
| File | Purpose |
|------|---------|
| `app/lib/retrieval-router.js` | Permission filtering & Ragie search |
| `app/api/tag/route.js` | AI tagging & indexing to Ragie |
| `app/api/ai-chat/route.js` | Claude conversation handler with tools |
| `app/lib/ragie-client.js` | Ragie SDK initialization |

### Key Functions
| Function | Purpose |
|----------|---------|
| `searchChatHistory()` | Main retrieval function with permission scoping |
| `addToTeamMemory()` | Add content to team memory |
| `getTopicVotes()` | Get vote counts for topics |
| `syncToRagie()` | Index message to Ragie with metadata |

---

## Testing New Features Against AI Memory

When implementing new features, ensure they work with the AI memory system:

### ✅ Checklist for New Chat Features

1. **Indexing**: Does the feature call `/api/tag` to index messages?
2. **Metadata**: Are all required fields included?
   - `messageId`, `chatId`, `chatType`, `chatName`
   - `sender`, `senderEmail`, `senderId`
   - `timestamp`
   - `participants` (for groups/DMs)
3. **Permissions**: Does retrieval respect the permission matrix?
4. **Names**: Is `chatName` included for semantic search?

### ✅ Testing Queries

After implementing, test these queries in AI chat:

- "What was just said in [new feature area]?"
- "Who mentioned [topic] in [chat name]?"
- "What did [person] say about [topic]?"
- "Summarize today's discussion in [chat name]"

### ✅ Permission Testing

1. Send a message in a DM
2. Ask Poppy about it from a different DM → Should NOT find it
3. Ask Poppy from AI chat → Should find it
4. Send a message in a group
5. Ask Poppy from channel → Should NOT find it
6. Ask Poppy from AI chat (as group member) → Should find it

---

## Common Issues & Solutions

### Issue: Messages not appearing in search
**Causes:**
- `/api/tag` failed silently
- Missing required metadata
- Ragie indexing delay (1-2 seconds)

**Solution:** Check server logs for tagging errors

### Issue: Permission leaks (seeing DMs from other users)
**Causes:**
- Missing `participants` filter
- Wrong `chatType`

**Solution:** Audit `retrieval-router.js` filter logic

### Issue: Can't search by chat name
**Causes:**
- `chatName` not included in metadata
- `chatName` not in searchable content

**Solution:** Ensure both metadata AND content include chat name

---

## Future Enhancements

- [ ] **Image Understanding**: Search by image content (already indexing, needs better queries)
- [ ] **Video Transcripts**: Index video content from Mux
- [ ] **Thread Context**: Include thread replies in parent message context
- [ ] **Sentiment Analysis**: Track team mood over time
- [ ] **Auto-Summarization**: Daily/weekly digest of conversations

---

## 🚨 Critical Known Bug: AI Chat Pollution

### The Problem

When users ask Poppy questions, both the questions AND Poppy's responses get indexed to Ragie with `chatType: 'ai'`. This causes **retrieval pollution** where:

1. **User's own questions score highest** - If you ask "what food did I get today?" and previously asked the same question, your old question scores 1.0 (identical)
2. **Poppy's responses pollute results** - Old responses like "no food found" contain food keywords and rank higher than actual food mentions
3. **Actual answers are buried** - The real content (e.g., acai bowl from group chat) ends up at position 11+

### Real Example

Query: "what food did I get today?"

| Rank | Content | Score | Source |
|------|---------|-------|--------|
| 1 | "what food did i get today?" | 1.0 | AI chat (user question) |
| 2-5 | More "what food" questions | 0.95+ | AI chat (user questions) |
| 6-10 | "No food mentions today!" | 0.65+ | AI chat (Poppy responses) |
| 11 | "thanks i just got the acai bowl!!" | 0.559 | ✅ Group chat (ACTUAL ANSWER) |

The AI sees "no food found" responses ranking higher than the actual food mention.

### Root Cause

In `retrieval-router.js`, the AI chat filter includes:
```javascript
{ senderId: { $eq: userId } }  // Matches AI chat questions too!
```

This captures all messages the user sent, including questions to Poppy.

### Fix Options (Not Yet Implemented)

1. **Exclude AI chat from retrieval:**
   ```javascript
   { $and: [
     { senderId: { $eq: userId } },
     { chatType: { $ne: 'ai' } }  // Exclude AI chat
   ]}
   ```

2. **Don't index AI chat at all:**
   - Modify `app/lib/firestore.js` to skip `/api/tag` for AI chat messages

3. **Index AI chat but exclude from search:**
   - Add `excludeFromSearch: true` metadata
   - Filter it out in retrieval

**Files to modify:**
- `app/lib/retrieval-router.js` (add exclusion filter)
- OR `app/lib/firestore.js` (skip indexing AI chat)

---

## Summary

Poppy's AI memory is:
1. **Comprehensive**: Every message is indexed with rich metadata
2. **Permission-aware**: You only see what you're allowed to see
3. **Semantic**: Natural language queries work
4. **Context-sensitive**: Different access levels based on where you are
5. **Team-friendly**: Team memory is shared across everyone

When building new features, always consider:
- **What gets indexed?** (metadata)
- **Who can search it?** (permissions)
- **How do users query it?** (chat names, semantic content)

---

*This document serves as the source of truth for how AI memory works in Poppy Team Chat.*

