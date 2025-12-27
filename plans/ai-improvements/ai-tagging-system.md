# AI Message Tagging System

## The Goal

**Make everything easy to find later.**

When someone asks "what was that thing about..." or "didn't someone mention..." — the AI's tagging should make that moment findable. No more requiring users to manually spam keywords.

---

## How It Works

```
1. User sends message
    ↓
2. Stored in Firestore (instant, non-blocking)
    ↓
3. Async: POST /api/tag (AI tagging runs in background)
    ↓
4. Fetch last 20 messages for context
    ↓
5. Claude returns tags JSON
    ↓
┌─────────────────────────────────────────────┐
│                                             │
▼                                             ▼
UPDATE FIRESTORE                        SYNC TO RAGIE
(message.tags field)                  (tags become searchable
                                       metadata)
```

**Firestore** → Stores tags on message doc. Powers UI (show tags, filter by type)

**Ragie** → Gets tags as metadata. Powers AI search ("that feature camryn wanted")

---

## The Tagging Prompt

```
You're the memory layer for a team chat. Your one job:

**Make everything easy to find later.**

When someone asks "what was that thing about..." or "didn't someone mention..." — your tagging should make that moment findable.

## THE GOAL

Humans remember things in fuzzy, associative ways:
- "that feature camryn was hyped about"
- "the bug with reactions"
- "when did we ship notifications"
- "what's abhi working on"
- "that crazy revenue day around christmas"

Your job is to tag messages so these fuzzy human queries actually work.

## HOW TO THINK

For every message, ask yourself:
- What might someone search to find this later?
- What's this actually about beneath the surface?
- Who was involved?
- Is this something people will want to remember?

Then tag generously. Multiple angles. The way a human brain would connect it.

## REAL EXAMPLES

**Message:** "we don't have command k on the phone so we need a way to start a new thread on the phone"
```json
{
  "type": "feature_request",
  "canonical_tag": "mobile_new_thread",
  "tags": ["mobile", "keyboard_shortcuts", "thread", "navigation", "cmd_k", "phone"],
  "priority": "medium",
  "temperature": "warm",
  "summary": "Need way to start new thread on mobile (no cmd+k)"
}
```

**Message:** "add native MACOS notifications on the desktop app! important"
```json
{
  "type": "feature_request",
  "canonical_tag": "macos_notifications",
  "tags": ["macos", "desktop", "notifications", "native", "alerts"],
  "priority": "high",
  "temperature": "hot",
  "summary": "Add native macOS notifications to desktop app"
}
```

**Message:** "working on adding notifications for desktop"
```json
{
  "type": "status_update",
  "canonical_tag": "macos_notifications",
  "tags": ["macos", "desktop", "notifications", "in_progress"],
  "status": "in_progress",
  "summary": "Working on desktop notifications feature"
}
```
*Notice: Same canonical_tag as the request above. They're now linked.*

**Message:** "desktop notifications are now live"
```json
{
  "type": "status_update",
  "canonical_tag": "macos_notifications",
  "tags": ["macos", "desktop", "notifications", "shipped", "release"],
  "status": "complete",
  "summary": "Desktop notifications shipped"
}
```
*Full lifecycle linked: request → in progress → shipped*

**Message:** "you just have to accept them when you refresh"
```json
{
  "type": "tip",
  "canonical_tag": "macos_notifications",
  "tags": ["macos", "desktop", "notifications", "how_to", "onboarding", "permissions"],
  "summary": "Accept notification permissions on refresh to enable"
}
```
*Tribal knowledge, still linked to same feature*

**Message:** "my eyes hurt at night from the bright screen"
```json
{
  "type": "feature_request",
  "canonical_tag": "dark_mode",
  "tags": ["dark_mode", "ui", "accessibility", "night_mode", "eye_strain", "brightness"],
  "priority": "medium",
  "temperature": "warm",
  "summary": "User wants dark mode (eyes hurt at night)"
}
```
*They never said "dark mode" but that's what it is*

**Message:** "‼️When I'm trying to react to ur message and u send something, it closes out of reaction bubble"
```json
{
  "type": "bug",
  "canonical_tag": "reaction_bubble_closes",
  "tags": ["reactions", "ui", "mobile", "messaging", "race_condition", "emoji"],
  "priority": "medium",
  "temperature": "warm",
  "summary": "Reaction bubble closes when new message arrives"
}
```

**Message:** "GIFS" (hearted by sawwa, athena, and olivia)
```json
{
  "type": "feature_request",
  "canonical_tag": "gif_support",
  "tags": ["gifs", "media", "messaging", "fun", "emoji"],
  "priority": "medium",
  "temperature": "hot",
  "votes": 3,
  "voters": ["sawwa", "athena", "olivia"],
  "summary": "Add GIF support"
}
```
*Hearts = votes. Captured.*

**Message:** "amaanath bro i really need you to fucking lock in on the affiliates & start tracking them in notion please bro"
```json
{
  "type": "task",
  "canonical_tag": "affiliate_tracking",
  "tags": ["affiliates", "notion", "tracking", "operations"],
  "priority": "high",
  "temperature": "hot",
  "assignee": "amaanath",
  "assigner": "qazi",
  "summary": "Track affiliates in Notion"
}
```
*CEO → employee task. High priority. Assignee extracted.*

**Message:** "Qazi's GOAL: Officially move to Poppy Team Chat this week by DEC Wednesday 24th 2025!!"
```json
{
  "type": "goal",
  "canonical_tag": "poppy_team_chat_migration",
  "tags": ["migration", "poppy_team_chat", "deadline", "team_goal", "internal_tools"],
  "priority": "critical",
  "temperature": "hot",
  "due_date": "2025-12-24",
  "summary": "Migrate team to Poppy Team Chat by Dec 24"
}
```

**Message:** "50k builds... THAT would be fucking insane... $50k would be totally worth it for the right company"
```json
{
  "type": "idea",
  "canonical_tag": "messaging_app_builds_service",
  "tags": ["business_idea", "revenue", "productized_service", "b2b", "enterprise"],
  "priority": "medium",
  "temperature": "hot",
  "participants": ["qazi", "camryn"],
  "summary": "Sell custom internal messaging app builds to companies for $50k"
}
```
*Business brainstorm. Captured so it doesn't disappear.*

**Message:** "Today's EPV & Stuff 12/25 - Revenue: $3156, EPV: $4.89, Total Purchases: 4, AOV: $789"
```json
{
  "type": "metrics",
  "canonical_tag": "daily_revenue_report",
  "tags": ["revenue", "epv", "aov", "daily_metrics", "finance", "christmas"],
  "date": "2024-12-25",
  "summary": "Daily metrics: $3156 revenue, $4.89 EPV, 4 purchases",
  "data": {
    "revenue": 3156,
    "checkout_visits": 646,
    "epv": 4.89,
    "total_purchases": 4,
    "aov": 789
  }
}
```
*Numbers extracted. Queryable.*

**Message:** "haha"
```json
{
  "type": "noise"
}
```
*Nothing to remember here.*

**Message:** "ohhh pookie you are SOO cute!!! omg"
```json
{
  "type": "noise"
}
```
*Vibes only. Skip.*

## THE DEDUPLICATION MAGIC

When you see a new message about something discussed before, USE THE SAME canonical_tag. Check existing tags first. This links:
- Request → assignment → progress → shipped
- Multiple people asking for the same thing
- Questions and answers about same topic

## BE CREATIVE

These are examples, not rules. You might see patterns I haven't. Invent new types. Find better tags. The only measure: **Can humans find what they're looking for?**

## EXISTING TAGS

{{EXISTING_TAGS}}

---

Sender: {{SENDER}}
Message: {{MESSAGE}}
Recent context: {{RECENT_MESSAGES}}
```

---

## Files to Create/Modify

### 1. Create: `app/api/tag/route.js`

```javascript
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../../lib/firebase';
import { doc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { messageId, chatId, chatType, text, sender, senderId, timestamp } = await request.json();

    if (!messageId || !text || !chatId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch last 20 messages for context
    const messagesRef = chatType === 'dm' 
      ? collection(db, 'dms', chatId, 'messages')
      : collection(db, 'channels', chatId, 'messages');
    
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    
    const recentMessages = snapshot.docs.map(doc => {
      const data = doc.data();
      return `[${data.sender}]: ${data.text}`;
    }).reverse().join('\n');

    // 2. TODO: Fetch existing canonical_tags (optional for v1)
    const existingTags = ""; // Can add Firestore collection later

    // 3. Build prompt and call Claude
    const prompt = buildTaggingPrompt(existingTags, sender, text, recentMessages);
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    // 4. Parse tags JSON
    const tagsText = response.content[0].text;
    let tags;
    try {
      tags = JSON.parse(tagsText);
    } catch (e) {
      // Try to extract JSON from response
      const jsonMatch = tagsText.match(/\{[\s\S]*\}/);
      tags = jsonMatch ? JSON.parse(jsonMatch[0]) : { type: 'unknown' };
    }

    // 5. Update Firestore message doc with tags
    const messageRef = chatType === 'dm'
      ? doc(db, 'dms', chatId, 'messages', messageId)
      : doc(db, 'channels', chatId, 'messages', messageId);
    
    await updateDoc(messageRef, { aiTags: tags });

    // 6. Sync to Ragie with enriched metadata
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/ragie/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        chatId,
        chatType,
        text,
        sender,
        senderId,
        timestamp,
        aiTags: tags // Include tags in Ragie metadata
      })
    });

    return NextResponse.json({ success: true, tags });
  } catch (error) {
    console.error('Tagging error:', error);
    
    // Fallback: still sync to Ragie without tags
    // ... (call ragie/sync with basic data)
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildTaggingPrompt(existingTags, sender, message, recentMessages) {
  return `You're the memory layer for a team chat...
  
  [FULL PROMPT FROM ABOVE]
  
  EXISTING TAGS:
  ${existingTags || 'None yet'}
  
  ---
  
  Sender: ${sender}
  Message: ${message}
  Recent context:
  ${recentMessages}
  
  Return ONLY valid JSON. No explanation.`;
}
```

### 2. Modify: `app/api/ragie/sync/route.js`

Add tags fields to metadata:

```javascript
// After existing metadata...

// Add AI tags if provided
if (aiTags) {
  metadata.message_type = aiTags.type;
  metadata.tags = aiTags.tags || [];
  metadata.canonical_tag = aiTags.canonical_tag || null;
  metadata.summary = aiTags.summary || null;
  metadata.priority = aiTags.priority || null;
  metadata.temperature = aiTags.temperature || null;
  // ... any other tag fields
}
```

### 3. Modify: `app/lib/firestore.js`

Replace `/api/ragie/sync` calls with `/api/tag`:

```javascript
// Before:
fetch('/api/ragie/sync', {...})

// After:
fetch('/api/tag', {...})
```

Affected functions (11 total):
- `sendMessage()` (line 72)
- `sendMessageDM()` (line 223)
- `sendMessageWithImage()` (line 669)
- `sendMessageDMWithImage()` (line 740)
- `sendMessageWithMedia()` (line 853)
- `sendMessageDMWithMedia()` (line 940)
- `sendMessageWithAudio()` (line 1000)
- `sendMessageDMWithAudio()` (line 1056)
- `sendMessageWithReply()` (line 1296)
- `sendMessageDMWithReply()` (line 1368)
- `sendAIMessage()` (line 1473)

---

## Optional: Canonical Tags Collection (for deduplication)

```
Collection: canonical_tags
Document: { 
  name: "dark_mode",
  type: "feature_request", 
  message_count: 5,
  last_seen: timestamp
}
```

**Skip for v1.** Add later if deduplication becomes important.

---

## Cost Estimate

- Input: ~100-200 tokens per message (text + 20 message context)
- Output: ~50-100 tokens (JSON tags)
- Claude Sonnet: ~$3/1M input, ~$15/1M output
- Per message: ~$0.001-0.002
- 500 messages/day: ~$15-30/month

---

## Error Handling

```javascript
try {
  const tags = await tagMessage(...);
  await updateFirestoreWithTags(...);
  await syncToRagie(...);
} catch (error) {
  console.error('Tagging failed:', error);
  // Fallback: still sync to Ragie with basic metadata
  await syncToRagieBasic(...);
}
```

Never block message delivery. Tagging is best-effort.

---

## Success Criteria

The system works if users can find messages by asking in fuzzy human ways:
- "what was that thing about dark mode"
- "camryn's feature requests"
- "bugs from last week"
- "that revenue update around christmas"
- "who works on the dev team"
- "what's abhi working on"
- "tasks assigned to amaanath"

If those queries return relevant results, we've succeeded.

