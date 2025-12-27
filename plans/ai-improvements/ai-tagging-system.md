# AI Message Tagging System

## The Goal

**Make everything easy to find later.**

When someone asks "what was that thing about..." or "didn't someone mention..." — the AI's tagging should make that moment findable. No more requiring users to manually spam keywords.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER SENDS MESSAGE                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STORED IN FIRESTORE (instant)                    │
│              messages/{channelId}/messages/{messageId}              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ (async, non-blocking)
┌─────────────────────────────────────────────────────────────────────┐
│                      POST /api/tag (background)                     │
│                                                                     │
│  1. Fetch last 20 messages for context                              │
│  2. Load existing canonical_tags from in-memory cache               │
│  3. Call Claude Sonnet 4.5 with tagging prompt                      │
│  4. Parse JSON response                                             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     UPDATE IN-MEMORY CACHE    │   │      PERSIST TO FIRESTORE     │
│                               │   │                               │
│  canonicalTagsCache.set(...)  │   │  canonical_tags/{tagId}       │
│  (for deduplication)          │   │  - votes, voters, summary     │
└───────────────────────────────┘   └───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SYNC TO RAGIE (indexed)                        │
│                                                                     │
│  - Message text + AI summary + keywords + queries                   │
│  - Metadata: type, canonical_tag, voter, priority, etc.             │
│  - Powers Poppy AI's search_chat_history tool                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `app/api/tag/route.js` | Main tagging endpoint - calls Claude, persists to Firestore + Ragie |
| `app/lib/retrieval-router.js` | `searchChatHistory()` and `getTopicVotes()` functions |
| `app/lib/firebase-admin.js` | Firebase Admin SDK for server-side Firestore access |
| `app/lib/firestore.js` | Client-side message sending (calls /api/tag) |
| `app/api/ai-chat/route.js` | Poppy AI chat - uses search_chat_history and get_topic_votes tools |
| `app/contexts/DevModeContext.js` | Dev mode toggle for showing costs in UI |

---

## Vote Tracking System

### How It Works

When someone expresses interest/agreement/commitment, the AI outputs a `voter` field:

```
Message: "yo i'm down to go to switzerland"
        ↓
AI outputs: { "voter": "rafeh", "canonical_tag": "switzerland_team_trip", ... }
        ↓
Firestore: canonical_tags/switzerland_team_trip
           { votes: 1, voters: ["rafeh"], ... }
```

### Vote Detection

The AI detects votes from phrases like:
- "I'm down" / "I'd be down" / "I'm in" / "I'm game"
- "count me in" / "sign me up"
- "I agree" / "+1" / "yes please"
- "[Person] is down" / "[Person] wants in" → voter = that person's name

### Firestore Schema

```
Collection: canonical_tags
Document ID: {canonical_tag} (e.g., "switzerland_team_trip")
{
  name: "switzerland_team_trip",
  type: "idea",
  summary: "Team trip to Switzerland",
  count: 5,          // Total messages about this topic
  votes: 2,          // Number of unique voters
  voters: ["rafeh", "naz"],
  createdAt: "2025-12-26T...",
  lastSeen: "2025-12-26T..."
}
```

### Querying Votes (Poppy AI)

Poppy AI has access to `get_topic_votes` tool:

```javascript
// When user asks: "who wants to go to switzerland?"
// AI calls:
get_topic_votes({ query: "switzerland" })

// Returns:
[{
  id: "switzerland_team_trip",
  name: "switzerland_team_trip",
  votes: 2,
  voters: ["rafeh", "naz"],
  summary: "Team trip to Switzerland"
}]
```

The AI is instructed to use this tool when users ask:
- "who wants X?" / "who's down for X?"
- "how many people want X?"
- "who agrees with Y?"

---

## The Tagging Prompt

The full prompt is in `app/api/tag/route.js`. Key sections:

### Message Types
- `feature_request` - Someone wants a feature
- `bug` - Something is broken
- `status_update` - Progress on something
- `task` - Assigned work
- `goal` - Team/personal goal
- `idea` - Brainstorm/proposal
- `metrics` - Numbers/data
- `tip` - Tribal knowledge
- `question` - Someone asking something
- `noise` - Not worth remembering

### Tag Fields

| Field | Description |
|-------|-------------|
| `type` | Message classification |
| `canonical_tag` | Unique ID linking related messages (e.g., "dark_mode") |
| `tags` | Array of keywords |
| `summary` | One-line description |
| `voter` | Person expressing interest (triggers vote count) |
| `priority` | low / medium / high / critical |
| `temperature` | cold / warm / hot (urgency/enthusiasm) |
| `assignee` | Who should do the work |
| `assigner` | Who assigned the work |
| `status` | in_progress / complete / blocked |
| `due_date` | ISO date string |
| `queries` | Natural language search phrases |

### Example Output

```json
{
  "type": "idea",
  "canonical_tag": "switzerland_team_trip",
  "tags": ["switzerland", "trip", "team_travel", "europe"],
  "voter": "rafeh",
  "summary": "Rafeh proposing Switzerland trip and is in",
  "temperature": "warm",
  "queries": ["switzerland trip", "who wants to go to switzerland", "europe team meetup"]
}
```

---

## Deduplication with Canonical Tags

Messages about the same topic share a `canonical_tag`:

```
Message 1: "we should add dark mode"     → canonical_tag: "dark_mode"
Message 2: "working on dark mode now"    → canonical_tag: "dark_mode"
Message 3: "dark mode is live!"          → canonical_tag: "dark_mode"
```

This links the full lifecycle: request → in progress → shipped.

### In-Memory Cache

An in-memory `Map` tracks existing tags for the AI to reference:

```javascript
const canonicalTagsCache = new Map()
// { "dark_mode" => { type: "feature_request", count: 3, ... } }
```

The AI receives a list of existing tags so it can reuse them instead of creating duplicates.

**Note:** This cache resets on server restart. Firestore persists the data.

---

## Ragie Integration

Each message syncs to Ragie with enriched content:

```
[Rafeh Qazi]: yo i'm down to go to switzerland
[Summary]: Rafeh proposing Switzerland trip and is in
[Keywords]: switzerland, trip, team_travel, europe
[Related queries]: switzerland trip, who wants to go to switzerland
```

This makes messages findable by:
- Exact text search
- Semantic search (summary)
- Keyword matching
- Natural language queries

---

## Poppy AI Tools

Poppy AI has two main search tools:

### 1. `search_chat_history` (Ragie)
- Searches ALL messages ever sent
- Returns matching text with context
- Use for: finding what someone said, historical context

### 2. `get_topic_votes` (Firestore)
- Queries the `canonical_tags` collection
- Returns vote counts and voter names
- Use for: "who wants X?", "how many votes for Y?"

The system prompt instructs Claude to use both tools together for vote questions.

---

## Dev Mode

Toggle in sidebar shows:
- Cost per message (tagging cost)
- Cost per AI response

```javascript
// DevModeContext.js
const [devMode, setDevMode] = useState(false)
// Cost displayed in MessageItem.js
```

---

## Cost Tracking

Each tagging request logs:

```
💰 Tokens:        3697 in / 111 out
💵 Cost:          $0.012756 ($0.011091 in + $0.001665 out)
```

Pricing (Claude Sonnet 4.5):
- Input: $3/1M tokens
- Output: $15/1M tokens
- Average per message: ~$0.01-0.015

---

## Server Logs

Example log output:

```
══════════════════════════════════════════════════════════════════════
🏷️  AI TAGGING START
══════════════════════════════════════════════════════════════════════
📨 Message ID:  hgZRHP3r8IbMlCpiS6vd
💬 Chat:        dm:e6AqpILFQwVBw6f7gLgtmBWXIo52_sUFbxSMaF6QwhTwURVb9E0LMQiv2
👤 Sender:      Rafeh Qazi
📝 Text:        "i'd be down to go to switzerland"
🤖 Model:       claude-sonnet-4-5-20250929
──────────────────────────────────────────────────────────────────────
📋 Existing Tags: 0 in cache
💬 Recent Context: 20 messages
⏳ Calling Claude...
──────────────────────────────────────────────────────────────────────
✅ CLASSIFICATION RESULT
──────────────────────────────────────────────────────────────────────
📋 Type:          idea
🏷️  Canonical Tag: switzerland_team_trip
🔖 Tags:          switzerland, trip, team_travel, europe
📝 Summary:       Rafeh proposing Switzerland trip and is in
🗳️  Voter:         rafeh
❓ Queries:       switzerland trip, rafeh travel plans, europe team meetup
──────────────────────────────────────────────────────────────────────
💾 Cache Updated:  switzerland_team_trip (1 total tags in cache)
🗳️  FIRESTORE VOTE: Created "switzerland_team_trip" with first vote from "rafeh"
💾 FIRESTORE: Created topic "switzerland_team_trip"
📚 Ragie: Indexing message hgZRHP3r8IbMlCpiS6vd to dm:... [idea]
✅ Ragie: Indexed message hgZRHP3r8IbMlCpiS6vd, doc ID: 35d11919-...
⏱️  Timing:        Claude 3622ms | Ragie 739ms | Total 4662ms
💰 Tokens:        3697 in / 111 out
💵 Cost:          $0.012756 ($0.011091 in + $0.001665 out)
══════════════════════════════════════════════════════════════════════
🏷️  AI TAGGING COMPLETE
══════════════════════════════════════════════════════════════════════
```

---

## Error Handling

```javascript
try {
  const aiTags = await tagMessage(...)
  await persistCanonicalTag(aiTags, sender)
  await syncToRagie(data, aiTags)
} catch (error) {
  console.error('Tagging failed:', error)
  // Fallback: still sync to Ragie with basic metadata
  await syncToRagie(data, null)
}
```

Never block message delivery. Tagging is best-effort.

---

## Success Criteria

The system works if users can find messages by asking in fuzzy human ways:

✅ "what was that thing about dark mode"
✅ "who wants to go to switzerland?"
✅ "camryn's feature requests"
✅ "bugs from last week"
✅ "how many people are down for the germany trip?"
✅ "that revenue update around christmas"
✅ "tasks assigned to amaanath"

If those queries return relevant results, we've succeeded.

---

## Future Improvements

- [ ] Load canonical_tags from Firestore on server startup (currently starts fresh)
- [ ] UI to show tags on messages (dev mode only?)
- [ ] Filter messages by type in sidebar
- [ ] Weekly digest of feature requests / votes
- [ ] Automatic PR creation from high-vote feature requests
