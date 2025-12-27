# AI Memory via Chat

## The Goal

Users often say "@poppy add this to memory" or "remember this" when they actually want to use the "Add to Team AI Memory" feature but don't want to right-click.

Poppy should be smart enough to:
1. Recognize these requests
2. Look at the last 20-30 messages for context
3. Summarize the conversation (who said what)
4. Save it to Team Memory

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│  User: "we decided on March 15th for the launch"                    │
│  David: "sounds good, I'll prep the marketing"                      │
│  User: "@poppy remember this"                                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      POPPY AI PROCESSING                            │
│                                                                     │
│  1. Recognizes "remember this" trigger                              │
│  2. Looks at chat history (last 50 messages available)              │
│  3. Calls add_to_team_memory tool with:                             │
│     - content: "Launch date set for March 15th. David will prep     │
│                 marketing materials."                               │
│     - source: "Rafeh, David"                                        │
│     - context: "Product launch planning"                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RAGIE (Team Memory)                            │
│                                                                     │
│  Document stored with:                                              │
│  - chatType: 'team_memory' (globally accessible)                    │
│  - addedViaAI: true                                                 │
│  - Searchable by everyone on the team                               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Poppy: "Got it! I've saved that to Team Memory. Everyone can       │
│          now ask me about: 'Launch date set for March 15th...'"     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Trigger Phrases

Poppy recognizes these as "add to memory" requests:

- "remember this"
- "save this"
- "add to memory"
- "add this to memory"
- "@poppy remember"
- "poppy, remember..."
- "make sure we don't forget..."
- "store this for the team"

---

## The Tool: `add_to_team_memory`

### Input Schema

```json
{
  "content": "A clear summary of what to remember. Include WHO said WHAT.",
  "source": "The main person(s) who provided this information",
  "context": "Brief context: what topic is this from?"
}
```

### Example Usage

**Chat History:**
```
[Rafeh]: yo so for the germany trip, I'm thinking end of march
[David]: works for me, I can do march 20-25
[Naz]: same here, late march is good
[Rafeh]: @poppy remember this
```

**Tool Call:**
```json
{
  "content": "Germany trip planned for late March. Rafeh proposed end of March. David available March 20-25. Naz confirmed late March works.",
  "source": "Rafeh, David, Naz",
  "context": "Germany team trip planning"
}
```

**Saved to Ragie:**
```
[Team Memory from Rafeh, David, Naz] (Context: Germany team trip planning): 
Germany trip planned for late March. Rafeh proposed end of March. 
David available March 20-25. Naz confirmed late March works.
```

---

## Content Moderation

The system rejects inappropriate content:

```javascript
const inappropriatePatterns = [
  /\b(porn|xxx|nude|naked|sex|...)\b/i,
  /\b(kill\s*(yourself|myself)|suicide|murder)\b/i,
];
```

If detected, Poppy responds:
> "I can't save that to team memory. Let's keep it professional! 😊"

---

## What Gets Saved vs. Rejected

### ✅ Save These:
- Important decisions: "We decided to use Stripe for payments"
- Dates/deadlines: "Launch is March 15th"
- Action items: "David will handle marketing, Naz is on dev"
- Key info: "The API key is in 1Password under 'Stripe Prod'"
- Team agreements: "We agreed to 2-week sprints starting Monday"

### ❌ Don't Save:
- Casual banter: "lol yeah that's funny"
- Jokes/memes
- Personal info that shouldn't be team-wide
- Obviously trivial messages

---

## Files

| File | Purpose |
|------|---------|
| `app/api/ai-chat/route.js` | Tool definition + system prompt instructions |
| `app/lib/retrieval-router.js` | `addToTeamMemory()` function |
| `app/api/ragie/team-memory/route.js` | Original team memory endpoint (used by right-click) |

---

## How It Differs from Right-Click "Add to Memory"

| Feature | Right-Click | Via Poppy Chat |
|---------|-------------|----------------|
| Trigger | Context menu on a message | Natural language in chat |
| What's saved | That specific message only | AI summary of conversation |
| Context | None (just the message) | Last 20-30 messages analyzed |
| Formatting | Raw message text | Structured: who said what |
| Images | Supports images | Text only (for now) |

---

## Future Improvements

- [ ] Support image memory via chat ("remember this image")
- [ ] Let users specify time range ("remember what we discussed yesterday")
- [ ] Add confirmation before saving large summaries
- [ ] Show what was saved in the UI (not just alert)

