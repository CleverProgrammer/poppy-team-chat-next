import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import ragie from '../../lib/ragie-client.js'
import { adminDb } from '../../lib/firebase-admin.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// In-memory cache for canonical tags (persists across requests, resets on server restart)
// Format: Map<canonical_tag, { type, count, lastSeen, summary }>
const canonicalTagsCache = new Map()

/**
 * Track AI usage to Firestore for analytics and cost monitoring
 */
async function trackAIUsage({
  type,
  model,
  inputTokens,
  outputTokens,
  inputCost,
  outputCost,
  totalCost,
  userId,
  userEmail,
  userName,
  messageId,
  chatId,
  chatType,
}) {
  try {
    // Create fun readable doc ID: userName_color_animal_shortId (e.g., "rafeh_qazi_red_panda_abc12")
    const colors = ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'gold', 'cyan']
    const animals = ['panda', 'tiger', 'wolf', 'eagle', 'shark', 'fox', 'hawk', 'bear']
    const color = colors[Math.floor(Math.random() * colors.length)]
    const animal = animals[Math.floor(Math.random() * animals.length)]
    const shortId = Math.random().toString(36).substring(2, 7)
    const nameSlug = (userName || 'unknown')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    const docId = `${nameSlug}_${color}_${animal}_${shortId}`

    await adminDb
      .collection('ai_usage')
      .doc(docId)
      .set({
        timestamp: new Date().toISOString(),
        type,
        model,
        inputTokens,
        outputTokens,
        inputCost,
        outputCost,
        totalCost,
        userId: userId || null,
        userEmail: userEmail || null,
        userName: userName || null,
        messageId: messageId || null,
        chatId: chatId || null,
        chatType: chatType || null,
      })
  } catch (error) {
    // Don't fail the request if tracking fails - just log it
    console.error('⚠️ Failed to track AI usage:', error.message)
  }
}

/**
 * Persist canonical_tag to Firestore and handle vote tracking
 * Votes are counted when AI outputs a `voter` field - simple as that
 */
async function persistCanonicalTag(aiTags, sender) {
  if (!aiTags.canonical_tag) return

  const tagId = aiTags.canonical_tag
  const tagRef = adminDb.collection('canonical_tags').doc(tagId)

  try {
    const doc = await tagRef.get()
    const now = new Date().toISOString()

    // Get voter name - ONLY from explicit voter field, no fallbacks
    const voterName = aiTags.voter

    if (doc.exists) {
      // Update existing tag
      const updateData = {
        count: (doc.data().count || 0) + 1,
        lastSeen: now,
      }

      // If there's an explicit voter, count the vote
      if (voterName) {
        const currentVoters = doc.data().voters || []

        // Only add if not already in voters list (prevent duplicates)
        if (!currentVoters.includes(voterName)) {
          updateData.votes = (doc.data().votes || 0) + 1
          updateData.voters = [...currentVoters, voterName]
          console.log(
            `🗳️  FIRESTORE VOTE: Added "${voterName}" to "${tagId}" (now ${updateData.votes} votes)`
          )
        } else {
          console.log(
            `🗳️  FIRESTORE VOTE: "${voterName}" already voted for "${tagId}" (skipping duplicate)`
          )
        }
      }

      // Update summary if we have a better one
      if (aiTags.summary && !doc.data().summary) {
        updateData.summary = aiTags.summary
      }

      await tagRef.update(updateData)
      console.log(`💾 FIRESTORE: Updated topic "${tagId}"`)
    } else {
      // Create new tag
      const newTagData = {
        name: tagId,
        type: aiTags.type || 'unknown',
        summary: aiTags.summary || '',
        count: 1,
        votes: voterName ? 1 : 0,
        voters: voterName ? [voterName] : [],
        createdAt: now,
        lastSeen: now,
      }

      if (voterName) {
        console.log(`🗳️  FIRESTORE VOTE: Created "${tagId}" with first vote from "${voterName}"`)
      }

      await tagRef.set(newTagData)
      console.log(`💾 FIRESTORE: Created topic "${tagId}"`)
    }
  } catch (error) {
    console.error(`❌ FIRESTORE ERROR: Failed to persist "${tagId}":`, error.message)
  }
}

// Fetch recent messages from Firestore for context
async function getRecentMessages(chatId, chatType, limit = 5) {
  try {
    let messagesRef
    if (chatType === 'channel') {
      messagesRef = adminDb.collection('channels').doc(chatId).collection('messages')
    } else if (chatType === 'dm') {
      messagesRef = adminDb.collection('dms').doc(chatId).collection('messages')
    } else {
      return []
    }

    const snapshot = await messagesRef
      .orderBy('timestamp', 'desc')
      .limit(limit + 1) // +1 because current message might be included
      .get()

    const messages = []
    snapshot.forEach(doc => {
      const data = doc.data()
      messages.push({
        sender: data.sender || data.senderName || 'Unknown',
        text: data.text || '',
        timestamp: data.timestamp,
      })
    })

    // Return in chronological order (oldest first), skip the most recent (current message)
    return messages.reverse().slice(0, -1)
  } catch (error) {
    console.warn('⚠️ Failed to fetch recent messages:', error.message)
    return []
  }
}

// The tagging prompt - teaches AI to tag messages for easy retrieval
const TAGGING_PROMPT = `You're the memory layer for a team chat. Your one job:

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
\`\`\`json
{
  "type": "feature_request",
  "canonical_tag": "mobile_new_thread",
  "tags": ["mobile", "keyboard_shortcuts", "thread", "navigation", "cmd_k", "phone"],
  "queries": ["how to start thread on mobile", "new thread on phone", "cmd k on mobile", "mobile keyboard shortcuts"],
  "priority": "medium",
  "temperature": "warm",
  "summary": "Need way to start new thread on mobile (no cmd+k)"
}
\`\`\`

**Message:** "add native MACOS notifications on the desktop app! important"
\`\`\`json
{
  "type": "feature_request",
  "canonical_tag": "macos_notifications",
  "tags": ["macos", "desktop", "notifications", "native", "alerts"],
  "queries": ["desktop notifications", "mac notifications", "notification feature", "alert me on desktop"],
  "priority": "high",
  "temperature": "hot",
  "summary": "Add native macOS notifications to desktop app"
}
\`\`\`

**Message:** "working on adding notifications for desktop"
\`\`\`json
{
  "type": "status_update",
  "canonical_tag": "macos_notifications",
  "tags": ["macos", "desktop", "notifications", "in_progress"],
  "queries": ["notification status", "are notifications being worked on", "desktop alerts progress"],
  "status": "in_progress",
  "summary": "Working on desktop notifications feature"
}
\`\`\`
*Notice: Same canonical_tag as the request above. They're now linked.*

**Message:** "desktop notifications are now live"
\`\`\`json
{
  "type": "status_update",
  "canonical_tag": "macos_notifications",
  "tags": ["macos", "desktop", "notifications", "shipped", "release"],
  "queries": ["when did notifications ship", "are desktop notifications live", "notification release date"],
  "status": "complete",
  "summary": "Desktop notifications shipped"
}
\`\`\`
*Full lifecycle linked: request → in progress → shipped*

## TASK COMPLETION DETECTION

When someone indicates a task is done, cancelled, or no longer needed, use the SAME canonical_tag and set status:

**Message:** "can you bring a raincoat tomorrow?"
\`\`\`json
{
  "type": "task",
  "canonical_tag": "bring_raincoat_tomorrow",
  "assignee": "[recipient if in DM]",
  "priority": "medium",
  "due_date": "tomorrow",
  "summary": "Bring raincoat tomorrow"
}
\`\`\`

**Message:** "oh nvm I see you've already done that"
\`\`\`json
{
  "type": "status_update",
  "canonical_tag": "bring_raincoat_tomorrow",
  "status": "complete",
  "summary": "Task completed - already handled"
}
\`\`\`

**Message:** "amaanath bro thanks for picking us up from the airport"
\`\`\`json
{
  "type": "status_update",
  "canonical_tag": "amaanath_airport_pickup",
  "status": "complete",
  "summary": "Airport pickup completed"
}
\`\`\`
*The message implies the pickup HAPPENED. Past tense = done.*

*CRITICAL: Use the SAME canonical_tag so the original task gets marked complete!*

**Message:** "actually forget about the report, we don't need it anymore"
\`\`\`json
{
  "type": "status_update",
  "canonical_tag": "[original task's canonical_tag]",
  "status": "cancelled",
  "summary": "Task cancelled - no longer needed"
}
\`\`\`

### How to detect task completion (USE YOUR JUDGMENT!)

**The core principle:** If a message implies that something HAS BEEN DONE, mark it complete.

Think about it: What would make you check something off your to-do list?
- Someone saying they did it
- Someone thanking you for doing it
- Someone acknowledging it happened
- Someone saying it's no longer needed
- Any signal that the action is in the past tense / resolved

**Examples of completion signals:**
- Direct: "done", "finished", "completed", "all set"
- Gratitude: "thanks for doing X", "appreciate you handling that"
- Acknowledgment: "got it", "received", "looks good"
- Past tense: "he picked us up", "she sent it", "they fixed it"
- Cancellation: "nvm", "forget it", "don't need it anymore"

**The key insight:** You're not pattern-matching keywords. You're asking: "Does this message imply the task is resolved?" If yes → complete. If cancelled → cancelled.

Always use the SAME canonical_tag as the original task so they're linked!

## WHAT IS A TASK? (IMPORTANT - READ THIS!)

**You are the TASK MASTER.** Your job is to figure out what's ACTUALLY a task vs what's just casual conversation.

### The core question: "Would this end up on someone's to-do list?"

A REAL task has:
- **Accountability**: Someone specific is expected to DO something
- **Deliverable**: There's a tangible outcome (send a file, build a feature, bring an item)
- **Follow-up potential**: Someone might ask "did you do that thing?"

**NOT a task** (even if it sounds like one):
- Jokes, banter, rhetorical questions
- Casual expressions ("give me a high five", "lmk if I should be worried")
- Vibe checks ("can I get a HOOYAH", "thoughts?")
- Feedback requests with no real deliverable ("what do you think about this?")
- Social/emotional exchanges ("let me know if you're happy")

### The "To-Do List" Test
Ask yourself: **Would any reasonable person actually write this down as a task?**

| Message | Task? | Why |
|---------|-------|-----|
| "Please send me the Q4 report by Friday" | ✅ YES | Clear deliverable, deadline, accountability |
| "Can you review this PR today?" | ✅ YES | Specific action needed |
| "Bring cookies to the meeting tomorrow" | ✅ YES | Real deliverable with timeline |
| "lmk if i'm not supposed to be happy" | ❌ NO | It's a vibe check, not a deliverable |
| "give me a fucking high five" | ❌ NO | Banter, not a to-do item |
| "can I get a HOOOYAAAA" | ❌ NO | Team hype, not actionable |
| "what do you think?" | ❌ NO | Casual question, no deliverable |
| "let me know your thoughts when you get a chance" | ❌ NO | Too vague, no specific outcome |

### Use your judgment!
Don't pattern-match on words like "please", "can you", or "lmk". Those appear in casual chat all the time. Think about INTENT and whether there's real work to be done.

If it's NOT a task, it might be:
- \`general\` - casual chat, banter
- \`question\` - asking for info/opinion
- \`noise\` - reactions, vibes, fluff

**Message:** "you just have to accept them when you refresh"
\`\`\`json
{
  "type": "tip",
  "canonical_tag": "macos_notifications",
  "tags": ["macos", "desktop", "notifications", "how_to", "onboarding", "permissions"],
  "queries": ["how to enable notifications", "notifications not working", "accept permissions"],
  "summary": "Accept notification permissions on refresh to enable"
}
\`\`\`
*Tribal knowledge, still linked to same feature*

**Message:** "my eyes hurt at night from the bright screen"
\`\`\`json
{
  "type": "feature_request",
  "canonical_tag": "dark_mode",
  "tags": ["dark_mode", "ui", "accessibility", "night_mode", "eye_strain", "brightness"],
  "queries": ["dark mode request", "night mode", "screen too bright", "eye strain"],
  "priority": "medium",
  "temperature": "warm",
  "summary": "User wants dark mode (eyes hurt at night)"
}
\`\`\`
*They never said "dark mode" but that's what it is*

**Message:** "‼️When I'm trying to react to ur message and u send something, it closes out of reaction bubble"
\`\`\`json
{
  "type": "bug",
  "canonical_tag": "reaction_bubble_closes",
  "tags": ["reactions", "ui", "mobile", "messaging", "race_condition", "emoji"],
  "queries": ["reaction bug", "emoji picker closes", "can't react to messages", "reaction bubble issue"],
  "priority": "medium",
  "temperature": "warm",
  "summary": "Reaction bubble closes when new message arrives"
}
\`\`\`

**Message:** "GIFS" (hearted by sawwa, athena, and olivia)
\`\`\`json
{
  "type": "feature_request",
  "canonical_tag": "gif_support",
  "tags": ["gifs", "media", "messaging", "fun", "emoji"],
  "queries": ["gif feature", "can we add gifs", "gif support", "send gifs"],
  "priority": "medium",
  "temperature": "hot",
  "votes": 3,
  "voters": ["sawwa", "athena", "olivia"],
  "summary": "Add GIF support"
}
\`\`\`
*Hearts = votes. Captured.*

**Message:** "amaanath bro i really need you to fucking lock in on the affiliates & start tracking them in notion please bro"
\`\`\`json
{
  "type": "task",
  "canonical_tag": "affiliate_tracking",
  "tags": ["affiliates", "notion", "tracking", "operations"],
  "queries": ["amaanath tasks", "affiliate tracking", "what did qazi assign", "notion tracking"],
  "priority": "high",
  "temperature": "hot",
  "assignee": "amaanath",
  "assigner": "qazi",
  "summary": "Track affiliates in Notion"
}
\`\`\`
*CEO → employee task. High priority. Assignee extracted.*

**Message:** "Qazi's GOAL: Officially move to Poppy Team Chat this week by DEC Wednesday 24th 2025!!"
\`\`\`json
{
  "type": "goal",
  "canonical_tag": "poppy_team_chat_migration",
  "tags": ["migration", "poppy_team_chat", "deadline", "team_goal", "internal_tools"],
  "queries": ["qazi's goals", "poppy chat migration", "when are we switching apps", "team chat deadline"],
  "priority": "critical",
  "temperature": "hot",
  "due_date": "2025-12-24",
  "summary": "Migrate team to Poppy Team Chat by Dec 24"
}
\`\`\`

**Message:** "50k builds... THAT would be fucking insane... $50k would be totally worth it for the right company"
\`\`\`json
{
  "type": "idea",
  "canonical_tag": "messaging_app_builds_service",
  "tags": ["business_idea", "revenue", "productized_service", "b2b", "enterprise"],
  "queries": ["50k idea", "business ideas", "camryn brainstorm", "enterprise messaging service"],
  "priority": "medium",
  "temperature": "hot",
  "participants": ["qazi", "camryn"],
  "summary": "Sell custom internal messaging app builds to companies for $50k"
}
\`\`\`
*Business brainstorm. Captured so it doesn't disappear.*

**Message:** "Today's EPV & Stuff 12/25 - Revenue: $3156, EPV: $4.89, Total Purchases: 4, AOV: $789"
\`\`\`json
{
  "type": "metrics",
  "canonical_tag": "daily_revenue_report",
  "tags": ["revenue", "epv", "aov", "daily_metrics", "finance", "christmas"],
  "queries": ["christmas revenue", "how much did we make dec 25", "what was EPV on christmas", "daily revenue report"],
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
\`\`\`
*Numbers extracted. Queryable.*

## VOTE TRACKING (CRITICAL!)

When someone expresses interest, agreement, or commitment to ANY topic/idea, add a "voter" field with their name.

**Message:** "yeah i agree we definitely need that"
(context: someone just suggested adding dark mode)
\`\`\`json
{
  "type": "status_update",
  "canonical_tag": "dark_mode",
  "tags": ["dark_mode", "agreement"],
  "voter": "sawwa",
  "summary": "Sawwa wants dark mode"
}
\`\`\`

**Message:** "yo i'm down to go to germany"
\`\`\`json
{
  "type": "idea",
  "canonical_tag": "germany_team_meetup",
  "tags": ["germany", "trip", "meetup"],
  "voter": "rafeh",
  "summary": "Rafeh wants to go to Germany"
}
\`\`\`
*"I'm down" = vote. The sender is the voter.*

**Message:** "yo thinking of going to norway this year. i'd be down"
\`\`\`json
{
  "type": "idea",
  "canonical_tag": "norway_team_trip",
  "tags": ["norway", "trip", "team_travel"],
  "voter": "rafeh",
  "summary": "Rafeh proposing Norway trip and is in"
}
\`\`\`
*Proposing an idea AND saying "I'd be down" = they're voting for their own idea!*

**Message:** "david is also down to go to germany"
\`\`\`json
{
  "type": "status_update",
  "canonical_tag": "germany_team_meetup",
  "tags": ["germany", "trip"],
  "voter": "david",
  "summary": "David is in for Germany (reported by someone else)"
}
\`\`\`
*Someone reporting that David is in → voter is "david", not the sender.*

**Message:** "naz said he'd be down for norway too"
\`\`\`json
{
  "type": "status_update",
  "canonical_tag": "norway_team_trip",
  "tags": ["norway", "trip"],
  "voter": "naz",
  "summary": "Naz is in for Norway"
}
\`\`\`

**Message:** "count me in!"
(context: team planning an event)
\`\`\`json
{
  "type": "status_update",
  "canonical_tag": "[from context]",
  "voter": "[sender name]",
  "summary": "[sender] is in"
}
\`\`\`

### When to add "voter" field:
- "I'm down" / "I'd be down" / "I'm in" / "I'm game" → voter = sender
- "count me in" / "sign me up" → voter = sender
- "I agree" / "+1" / "yes please" → voter = sender
- "[Person] is down" / "[Person] wants in" → voter = that person's name

The "type" field can be anything (idea, status_update, feature_request, etc.) - just ADD the "voter" field when there's interest expressed. Don't overcomplicate it!

**Message:** "haha"
\`\`\`json
{
  "type": "noise"
}
\`\`\`
*Nothing to remember here.*

**Message:** "ohhh pookie you are SOO cute!!! omg"
\`\`\`json
{
  "type": "noise"
}
\`\`\`
*Vibes only. Skip.*

## THE DEDUPLICATION MAGIC

When you see a new message about something discussed before, USE THE SAME canonical_tag. Check existing tags first. This links:
- Request → assignment → progress → shipped
- Multiple people asking for the same thing
- Questions and answers about same topic

## TASK ACTIONS (IMPORTANT!)

When a message is task-related, include a \`task_action\` field to signal what should happen:

| task_action | When to use |
|-------------|-------------|
| \`"create"\` | A new task is being assigned or requested |
| \`"complete"\` | A task is being marked as done (gratitude, acknowledgment, past tense) |
| \`"cancel"\` | A task is being cancelled (nvm, forget it, no longer needed) |
| \`null\` or omit | Not task-related at all |

**This is how you tell the system to take action.** Don't just describe - signal intent!

Examples:
- "Amaanath should pick us up" → \`task_action: "create"\`
- "thanks for picking us up" → \`task_action: "complete"\`
- "nvm don't worry about the pickup" → \`task_action: "cancel"\`
- "how's the weather?" → no task_action field

## BE CREATIVE

These are examples, not rules. You might see patterns I haven't. Invent new types. Find better tags. The only measure: **Can humans find what they're looking for?**`

export async function POST(request) {
  // Store original data for fallback
  let originalData = null

  try {
    const data = await request.json()
    originalData = data

    const {
      messageId,
      chatId,
      chatType,
      text,
      sender,
      senderId,
      senderEmail,
      timestamp,
      // DM-specific fields
      participants,
      recipientId,
      recipientName,
      recipientEmail,
    } = data

    // Skip tagging for empty messages - just sync to Ragie with basic metadata
    if (!messageId || !text?.trim() || !chatId) {
      console.log(`🏷️ SKIP: Empty or missing text - syncing to Ragie without tags`)
      await syncToRagie(data, null)
      return NextResponse.json({ success: true, skipped: true, reason: 'Empty or missing text' })
    }

    const MODEL = 'claude-sonnet-4-5-20250929'
    const startTime = Date.now()

    console.log(`\n${'═'.repeat(70)}`)
    console.log(`🏷️  AI TAGGING START`)
    console.log(`${'═'.repeat(70)}`)
    console.log(`📨 Message ID:  ${messageId}`)
    console.log(`💬 Chat:        ${chatType}:${chatId}`)
    console.log(`👤 Sender:      ${sender}`)
    console.log(`📝 Text:        "${text.length > 100 ? text.substring(0, 100) + '...' : text}"`)
    console.log(`🤖 Model:       ${MODEL}`)
    console.log(`${'─'.repeat(70)}`)

    // Build existing tags list from cache
    let existingTagsSection = 'None yet - you are creating the first tags!'
    if (canonicalTagsCache.size > 0) {
      const tagsList = Array.from(canonicalTagsCache.entries())
        .sort((a, b) => b[1].count - a[1].count) // Most used first
        .slice(0, 50) // Limit to top 50 to save tokens
        .map(([tag, info]) => `- ${tag} (${info.type}, used ${info.count}x)`)
        .join('\n')
      existingTagsSection = tagsList
    }

    console.log(`📋 Existing Tags: ${canonicalTagsCache.size} in cache`)

    // Fetch recent messages for context
    const recentMessages = await getRecentMessages(chatId, chatType, 20)
    let recentContextSection = 'No recent messages'
    if (recentMessages.length > 0) {
      recentContextSection = recentMessages.map(m => `- ${m.sender}: ${m.text}`).join('\n')
    }
    console.log(`💬 Recent Context: ${recentMessages.length} messages`)

    const prompt = `${TAGGING_PROMPT}

## EXISTING TAGS

${existingTagsSection}

---

Recent context:
${recentContextSection}

Sender: ${sender}
Message: ${text}

Return ONLY valid JSON. No explanation, no markdown code blocks, just the raw JSON object.`

    console.log(`⏳ Calling Claude...`)

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const claudeTime = Date.now() - startTime

    // Calculate cost (Claude Sonnet 4 pricing: $3/1M input, $15/1M output)
    const inputTokens = response.usage?.input_tokens || 0
    const outputTokens = response.usage?.output_tokens || 0
    const inputCost = (inputTokens / 1_000_000) * 3
    const outputCost = (outputTokens / 1_000_000) * 15
    const totalCost = inputCost + outputCost

    // Parse tags JSON
    const tagsText = response.content[0].text
    let aiTags
    try {
      aiTags = JSON.parse(tagsText)
    } catch (e) {
      // Try to extract JSON from response (in case Claude wrapped it)
      const jsonMatch = tagsText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        aiTags = JSON.parse(jsonMatch[0])
      } else {
        console.warn('⚠️  Failed to parse tags JSON:', tagsText)
        aiTags = { type: 'unknown', tags: [], summary: text.substring(0, 100) }
      }
    }

    // Log the full classification result
    console.log(`${'─'.repeat(70)}`)
    console.log(`✅ CLASSIFICATION RESULT`)
    console.log(`${'─'.repeat(70)}`)
    console.log(`📋 Type:          ${aiTags.type || 'N/A'}`)
    console.log(`🏷️  Canonical Tag: ${aiTags.canonical_tag || 'N/A'}`)
    console.log(`🔖 Tags:          ${aiTags.tags?.join(', ') || 'None'}`)
    console.log(`📝 Summary:       ${aiTags.summary || 'N/A'}`)
    if (aiTags.priority) console.log(`⚡ Priority:      ${aiTags.priority}`)
    if (aiTags.temperature) console.log(`🌡️  Temperature:   ${aiTags.temperature}`)
    if (aiTags.assignee) console.log(`👤 Assignee:      ${aiTags.assignee}`)
    if (aiTags.assigner) console.log(`👤 Assigner:      ${aiTags.assigner}`)
    if (aiTags.voter) console.log(`🗳️  Voter:         ${aiTags.voter}`)
    if (aiTags.status) console.log(`📊 Status:        ${aiTags.status}`)
    if (aiTags.due_date) console.log(`📅 Due Date:      ${aiTags.due_date}`)
    if (aiTags.votes) console.log(`👍 Votes:         ${aiTags.votes}`)
    if (aiTags.queries) console.log(`❓ Queries:       ${aiTags.queries?.join(', ') || 'None'}`)
    if (aiTags.data) console.log(`📊 Data:          ${JSON.stringify(aiTags.data)}`)
    console.log(`${'─'.repeat(70)}`)

    // Update canonical tags cache for deduplication
    if (aiTags.canonical_tag && aiTags.type !== 'noise') {
      const existing = canonicalTagsCache.get(aiTags.canonical_tag)
      canonicalTagsCache.set(aiTags.canonical_tag, {
        type: aiTags.type || existing?.type || 'unknown',
        count: (existing?.count || 0) + 1,
        lastSeen: new Date().toISOString(),
        summary: aiTags.summary || existing?.summary,
      })
      console.log(
        `💾 Cache Updated:  ${aiTags.canonical_tag} (${canonicalTagsCache.size} total tags in cache)`
      )

      // Persist canonical_tag to Firestore for vote tracking
      // Vote only counts if AI explicitly outputs a `voter` field
      await persistCanonicalTag(aiTags, sender)
    }

    // Sync to Ragie with enriched metadata (directly, no internal fetch)
    const ragieStart = Date.now()
    await syncToRagie(data, aiTags)
    const ragieTime = Date.now() - ragieStart

    const totalTime = Date.now() - startTime
    console.log(
      `⏱️  Timing:        Claude ${claudeTime}ms | Ragie ${ragieTime}ms | Total ${totalTime}ms`
    )
    console.log(`💰 Tokens:        ${inputTokens} in / ${outputTokens} out`)
    console.log(
      `💵 Cost:          $${totalCost.toFixed(6)} ($${inputCost.toFixed(
        6
      )} in + $${outputCost.toFixed(6)} out)`
    )
    console.log(`${'═'.repeat(70)}`)
    console.log(`🏷️  AI TAGGING COMPLETE`)
    console.log(`${'═'.repeat(70)}\n`)

    // Track AI usage to Firestore (async, don't await to avoid blocking response)
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

    // Add cost to aiTags for dev mode display
    aiTags._cost = totalCost

    return NextResponse.json({ success: true, aiTags })
  } catch (error) {
    console.log(`\n${'═'.repeat(70)}`)
    console.error(`❌ AI TAGGING ERROR`)
    console.log(`${'═'.repeat(70)}`)
    console.error(`Error: ${error.message}`)
    console.error(error.stack)

    // Fallback: still try to sync to Ragie without tags
    if (originalData) {
      try {
        await syncToRagie(originalData, null)
        console.log(`✅ Fallback: Synced to Ragie without tags`)
      } catch (syncErr) {
        console.error(`❌ Fallback Ragie sync also failed:`, syncErr.message)
      }
    }
    console.log(`${'═'.repeat(70)}\n`)

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Sync message to Ragie directly (no internal fetch)
async function syncToRagie(data, aiTags) {
  const {
    messageId,
    chatId,
    chatType,
    text,
    sender,
    senderEmail,
    senderId,
    timestamp,
    participants,
    recipientId,
    recipientName,
    recipientEmail,
  } = data

  if (!messageId || !text || !chatId || !chatType) {
    console.warn('🏷️ Skipping Ragie sync - missing required fields')
    return
  }

  // Build metadata for permission-scoped retrieval
  const metadata = {
    messageId,
    sender: sender || 'Unknown',
    senderEmail: senderEmail || '',
    senderId: senderId || '',
    timestamp: timestamp || new Date().toISOString(),
    chatType,
    chatId,
  }

  // Add participants for DMs (for permission filtering)
  if (chatType === 'dm' && participants) {
    metadata.participants = participants
  }

  // Add recipient info for DMs
  if (chatType === 'dm') {
    if (recipientId) metadata.recipientId = recipientId
    if (recipientName) metadata.recipientName = recipientName
    if (recipientEmail) metadata.recipientEmail = recipientEmail
  }

  // Add AI-generated tags for better semantic retrieval
  if (aiTags) {
    if (aiTags.type) metadata.message_type = aiTags.type
    if (aiTags.tags?.length) metadata.tags = aiTags.tags
    if (aiTags.canonical_tag) metadata.canonical_tag = aiTags.canonical_tag
    if (aiTags.summary) metadata.summary = aiTags.summary
    if (aiTags.queries?.length) metadata.queries = aiTags.queries
    if (aiTags.priority) metadata.priority = aiTags.priority
    if (aiTags.temperature) metadata.temperature = aiTags.temperature
    if (aiTags.assignee) metadata.assignee = aiTags.assignee
    if (aiTags.assigner) metadata.assigner = aiTags.assigner
    if (aiTags.status) metadata.status = aiTags.status
    if (aiTags.due_date) metadata.due_date = aiTags.due_date
    if (aiTags.votes) metadata.votes = aiTags.votes
    if (aiTags.voters) metadata.voters = aiTags.voters
    if (aiTags.voter) metadata.voter = aiTags.voter
    if (aiTags.participants) metadata.tag_participants = aiTags.participants
    if (aiTags.data) metadata.extracted_data = JSON.stringify(aiTags.data)
  }

  console.log(
    `📚 Ragie: Indexing message ${messageId} to ${chatType}:${chatId}${
      aiTags ? ` [${aiTags.type}]` : ''
    }`
  )

  // Build searchable content that includes tags/queries for better retrieval
  let searchableContent = `[${sender}]: ${text}`

  if (aiTags && aiTags.type !== 'noise') {
    // Add summary for semantic matching
    if (aiTags.summary) {
      searchableContent += `\n[Summary]: ${aiTags.summary}`
    }
    // Add tags as searchable keywords
    if (aiTags.tags?.length) {
      searchableContent += `\n[Keywords]: ${aiTags.tags.join(', ')}`
    }
    // Add queries for natural language matching
    if (aiTags.queries?.length) {
      searchableContent += `\n[Related queries]: ${aiTags.queries.join(', ')}`
    }
  }

  // Create document in Ragie with enriched content and metadata
  const document = await ragie.documents.createRaw({
    data: searchableContent,
    metadata,
  })

  console.log(`✅ Ragie: Indexed message ${messageId}, doc ID: ${document.id}`)

  return document
}
