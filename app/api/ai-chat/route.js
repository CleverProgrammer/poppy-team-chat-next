import { NextResponse } from 'next/server'
import mcpManager from '../../lib/mcp-client.js'
import { searchChatHistory, getTopicVotes, addToTeamMemory } from '../../lib/retrieval-router.js'
import Anthropic from '@anthropic-ai/sdk'
import { KeywordsAITelemetry } from '@keywordsai/tracing'
import { adminDb } from '../../lib/firebase-admin.js'

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
  chatId,
  chatType,
  toolsUsed,
}) {
  try {
    await adminDb.collection('ai_usage').add({
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
      chatId: chatId || null,
      chatType: chatType || null,
      toolsUsed: toolsUsed || [],
    })
  } catch (error) {
    // Don't fail the request if tracking fails - just log it
    console.error('⚠️ Failed to track AI usage:', error.message)
  }
}

// Initialize Keywords AI Telemetry with manual instrumentation
const keywordsAi = new KeywordsAITelemetry({
  apiKey: process.env.KEYWORDS_AI_API_KEY || '',
  baseURL: process.env.KEYWORDSAI_BASE_URL || 'https://api.keywordsai.co/api',
  appName: 'poppy-team-chat',
  disableBatch: false,
  debug: false, // Disable verbose console logging
  instrumentModules: {
    anthropic: Anthropic,
  },
})

// Initialize telemetry (recommended for Next.js)
await keywordsAi.initialize()

// Fun memorable workflow ID generator
function generateWorkflowId() {
  const colors = [
    'red',
    'blue',
    'green',
    'purple',
    'orange',
    'pink',
    'yellow',
    'cyan',
    'white',
    'black',
    'silver',
    'gold',
  ]
  const animals = [
    'panda',
    'tiger',
    'bear',
    'lion',
    'wolf',
    'eagle',
    'shark',
    'dragon',
    'fox',
    'hawk',
    'whale',
    'phoenix',
  ]

  const color = colors[Math.floor(Math.random() * colors.length)]
  const animal = animals[Math.floor(Math.random() * animals.length)]
  const shortId = Math.random().toString(36).substring(2, 7)

  return `${color}-${animal}-${shortId}`
}

// Main AI processing function (extracted for both streaming and non-streaming)
async function processAIRequest(
  message,
  chatHistory,
  apiKey,
  user = null,
  currentChat = null,
  sendStatus = null,
  controller = null,
  encoder = null,
  workflowId = null
) {
  // Build system prompt with user context and current time
  const now = new Date()
  const dateTimeContext = `
CURRENT DATE & TIME:
- Today is: ${now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}
- Current time: ${now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}
- Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- ISO timestamp: ${now.toISOString()}`

  const userContext = user
    ? `
╔══════════════════════════════════════════════════════════════════╗
║  WHO YOU ARE TALKING TO RIGHT NOW (CRITICALLY IMPORTANT!)        ║
╚══════════════════════════════════════════════════════════════════╝
The person sending you messages RIGHT NOW is:
  → Name: ${user.name}
  → Email: ${user.email}
  → User ID: ${user.id}

⚠️ SPEAKER IDENTIFICATION RULES (READ CAREFULLY!) ⚠️
1. When this user says "I", "me", "my", "mine", or "myself" = they mean ${user.name}
2. When they ask "what did I say" = find messages from [${user.name}] in the chat history
3. When they ask "what did [Someone] say" = find messages from [Someone] (NOT ${user.name})
4. The chat history contains messages from MULTIPLE PEOPLE - look at the [Name] prefix!
5. YOUR conversation partner is ONLY ${user.name} - everyone else is just context

EXAMPLE:
- History shows: "[Athena]: I love pizza" and "[${user.name}]: I hate pizza"
- User asks: "what did I say about pizza?"
- CORRECT: "You said you hate pizza" (because ${user.name} = "I")
- WRONG: "You said you love pizza" (that was Athena, not ${user.name}!)
`
    : `You are chatting with an anonymous user.`

  const systemPrompt = `You are Poppy, a friendly AI assistant in Poppy Chat.
${dateTimeContext}
${userContext}

tldr bro. respond like SUPER fucking short unless I explicitly ask you to expand. Also keep shit very simple and easy to understand!

IMPORTANT FORMATTING RULES:
- NO markdown ever (no **, no *, no #, no \`, no - bullets, no numbered lists)
- Write plain text only, like a casual text message
- Use line breaks to separate thoughts (makes it easy to read!)
- Keep responses SHORT but well-spaced
- Be casual, friendly, and conversational
- Use emojis sparingly if it fits the vibe
- NEVER prefix your messages with "Poppy:" or your name - just respond directly

=== FOLLOW CONVERSATIONAL CONTEXT (CRITICAL!) ===

You have the last 50 messages - USE THEM to understand follow-up questions!
- "what about last week?" after discussing feature requests = "feature requests from last week"
- "any from yesterday?" = same topic, different time
- "what about X?" or "and Y?" = they're referring to the PREVIOUS topic
- NEVER ask for clarification on obvious follow-ups - just do it
- SHORT responses ≠ DUMB responses. Be concise AND smart.

=== TIME-AWARE SEARCH (CRITICAL!) ===

When users ask about ANYTHING with a time reference (this week, yesterday, last month, recent, latest, etc.):

1. ALWAYS PRIORITIZE search_chat_history FIRST with date filters!
   - Use the startDate and endDate parameters to filter by time
   - "this week" = startDate: Monday of this week, endDate: today
   - "yesterday" = startDate: yesterday 00:00, endDate: yesterday 23:59
   - "last month" = startDate: first of last month, endDate: last day of last month
   - "today" = startDate: today 00:00, endDate: now
   - "recent" or "latest" = last 7 days

2. If you MUST use Notion for time-bound queries:
   - ALWAYS filter by last_edited_time or created_time
   - Use sorts: [{ "timestamp": "last_edited_time", "direction": "descending" }]
   - NEVER return old Notion content for recent queries
   - If the Notion item wasn't updated within the time frame, DON'T include it

3. BE STRICT about dates:
   - "feature requests this week" = ONLY things from THIS calendar week
   - Don't return 2-year-old Notion pages just because they're related
   - The timestamp/date MUST match the user's time reference

=== HOW TO FIND INFORMATION ===

🚨🚨🚨 MOST IMPORTANT RULE: USE search_chat_history AGGRESSIVELY! 🚨🚨🚨

You have access to EVERY message ever sent in this workspace through search_chat_history.
This is your SUPERPOWER. USE IT CONSTANTLY. Don't be shy about it!

ALWAYS USE search_chat_history WHEN:
- User asks about ANYTHING that happened before (even if vague)
- User asks a question and you don't have the answer in immediate context
- User asks about: people, decisions, features, bugs, tasks, revenue, goals, metrics, conversations
- User says: "remember", "what about", "when did", "who said", "did anyone", "what happened"
- User asks the same/similar question AGAIN = they want you to SEARCH HARDER
- User seems frustrated or says "no" / "that's not it" = SEARCH CHAT HISTORY IMMEDIATELY
- ANY question that could have been discussed in the past = SEARCH FIRST, think later
- User asks about team members, who does what, assignments, etc.
- User asks about any topic you're not 100% certain about from immediate context

THE 80% RULE: If there's even a 20% chance the answer is in chat history, USE THE TOOL!

DON'T BE LAZY! Checking chat context (50 messages) is NOT enough.
The real gold is in search_chat_history - use it proactively, not as a last resort.

=== SEARCH STRATEGY ===

1. QUICK GLANCE: Check the last 50 messages for obvious answers
2. IF NOT OBVIOUS → IMMEDIATELY USE search_chat_history
   - Don't say "I don't see that in our conversation"
   - Don't ask "can you tell me more?"
   - Just SEARCH! The answer is probably in there!

3. search_chat_history (Ragie.ai) - YOUR MEMORY SYSTEM
   - Contains EVERY message ever sent across ALL channels and DMs
   - Searchable by content, people, dates, topics
   - FOR TIME-BOUND QUERIES: Use startDate and endDate parameters!
   - Use topK of 20-50 to get more context
   - Try MULTIPLE searches with different phrasings if first one doesn't work

4. IF STILL NOT FOUND: USE CLAVIS AI TOOLS
   - These give you access to external systems: Linear, Google Calendar, Notion, Tavily, etc.
   
   === LINEAR (Project Management) ===
   - Use for: tasks, project status, what's being worked on, coding tasks
   - IMPORTANT: ONLY search in PROJECTS - do NOT look at initiatives or anything else
   - Users won't say "projects" - they'll ask about tasks, work, what's happening, etc.
   - Just look in projects and tell them what you find
   
   === GOOGLE CALENDAR ===
   - This calendar belongs to Rafeh Qazi (the founder)
   - ONLY share calendar info if the user is one of these people:
     * Rafeh Qazi (qazi@cleverprogrammer.com) - the owner
     * Elsa - assistant
     * Rachel - assistant
   - For ANYONE ELSE: Do not reveal calendar details. Say something like "I can only share Rafeh's calendar with authorized team members"
   - Use the EXACT date format from the timestamp above
   
   === TAVILY (Online Search) ===
   - Use for: looking up current info online (follower counts, subscriber counts, news, facts you don't know)
   - Use as a LAST RESORT after checking:
     1. Chat history context
     2. search_chat_history (Ragie)
     3. Other Clavis tools
   - Great for real-time info that changes (social stats, current events, etc.)
   
   === NOTION ===
   - Use for: documents, notes, wikis, knowledge base
   - FOR NOTION: Always filter/sort by last_edited_time for time-bound queries!

CRITICAL DATE HANDLING:
- ALWAYS use the current date/time provided above - never guess!
- For "today", "tomorrow", "yesterday" - calculate from the date above
- When scheduling or checking calendar: use ISO format (YYYY-MM-DD)
- TIME-BOUND SEARCHES: Calculate exact date ranges and pass them to tools!

=== VOTE TRACKING (get_topic_votes) ===

USE get_topic_votes WHEN:
- User asks "who wants X?" / "who's down for X?" / "who's interested in X?"
- User asks "how many people want X?" / "how many votes does X have?"
- User asks about support/agreement for ANY topic (trips, features, ideas, decisions)
- Any question about counting people interested in something

This tool checks Firestore for tracked votes on topics. It's FASTER than searching chat history for vote counts because votes are pre-aggregated.

STRATEGY: For vote questions, use BOTH tools:
1. get_topic_votes → gives you the count and names
2. search_chat_history → gives you context about what was said

=== TEAM MEMORY (add_to_team_memory) ===

USE add_to_team_memory WHEN:
- User says "remember this" / "save this" / "add to memory"
- User says "@poppy remember..." or "poppy, remember..."
- User explicitly asks you to store something for the team
- User says "make sure we don't forget..."
- User shares important info and asks you to keep track of it

This saves info to Team Memory so EVERYONE on the team can ask you about it later.

🚨 CRITICAL: USE THE CHAT HISTORY! 🚨
When user says "remember this", LOOK BACK at the last 20-30 messages to understand WHAT to remember. They're usually referring to the recent conversation, not just their last message.

HOW TO SUMMARIZE:
- Capture WHO said WHAT: "Rafeh said X, David confirmed Y, Naz added Z"
- Include key facts, dates, decisions, action items
- Make it searchable - include names, topics, specific details
- Write it so someone asking "what did we decide about X?" can find it

WHAT TO SAVE:
✅ Important decisions, dates, deadlines
✅ Useful info (meeting notes, processes, contacts)
✅ Team preferences, resources
✅ Key discussion points from conversations

WHAT NOT TO SAVE:
❌ Jokes, memes, casual banter
❌ Inappropriate or sexual content
❌ Personal private info that shouldn't be shared
❌ Obvious/trivial things

🔥 GOLDEN RULES 🔥
1. NEVER say "I don't see that" without using search_chat_history first!
2. NEVER say "I don't know" without at least 2-3 different search attempts!
3. NEVER ask "can you tell me more?" - just SEARCH with what you have!
4. If user asks again or says "no that's wrong" = SEARCH CHAT HISTORY IMMEDIATELY
5. Don't ask permission to search - JUST DO IT
6. Be aggressive about finding information - the user is counting on you!
7. When in doubt, SEARCH. When certain, SEARCH ANYWAY to confirm.
`

  // Build messages array from chat history
  const messages = []
  const currentUserName = user?.name || 'Current User'

  // Add recent chat history if provided (last 50 messages for context)
  if (chatHistory && chatHistory.length > 0) {
    const recentHistory = chatHistory.slice(-50)

    // Collect all messages into a single context block for clarity
    let historyBlock = `═══ CHAT HISTORY (${recentHistory.length} messages) ═══\n`
    historyBlock += `Note: [${currentUserName}] = the person you're talking to. "I/me" in their questions refers to [${currentUserName}].\n\n`

    recentHistory.forEach(msg => {
      if (msg.sender && msg.text) {
        const isCurrentUser = msg.senderId === user?.id
        const marker = isCurrentUser ? ' ← THIS IS YOUR CONVERSATION PARTNER' : ''
        historyBlock += `[${msg.sender}]${marker}: ${msg.text}\n`
      }
    })

    historyBlock += `\n═══ END OF HISTORY ═══`

    messages.push({
      role: 'user',
      content: historyBlock,
    })
  }

  // Add the current user message WITH their name clearly marked
  messages.push({
    role: 'user',
    content: `═══ NEW MESSAGE FROM ${currentUserName.toUpperCase()} (this is "I/me/my") ═══\n[${currentUserName}]: ${message}`,
  })

  // Get available MCP tools for this specific user (per-user strata)
  const userId = user?.id || 'anonymous'
  console.log(`🔧 MCP: Loading tools for user: ${userId}`)
  if (sendStatus) sendStatus('Loading MCP tools...')

  let mcpTools = []
  try {
    mcpTools = await keywordsAi.withTask(
      { name: 'load_mcp_tools', metadata: { tool_count: 0 } },
      async () => {
        const tools = await mcpManager.listTools(userId)
        console.log(`🔧 MCP: Loaded ${tools.length} tools for user ${userId}`)
        tools.forEach(tool => {
          console.log(`  - ${tool.name}`)
        })
        return tools
      }
    )
  } catch (error) {
    console.error(`🔧 MCP: Failed to load tools for user ${userId}:`, error)
  }

  // Convert MCP tools to Claude format
  const tools = mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }))

  // Add Ragie chat history search tool with date filtering
  tools.push({
    name: 'search_chat_history',
    description:
      'Search through past chat messages to find relevant conversations. Use this when users ask about things discussed before, personal info shared in past chats, or any historical context from previous conversations. IMPORTANT: For time-bound queries (this week, yesterday, last month, etc.), ALWAYS use startDate and endDate to filter results!',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant past messages',
        },
        startDate: {
          type: 'string',
          description:
            'ISO date string for the start of the time range (e.g., "2025-12-16T00:00:00Z"). Use this for time-bound queries like "this week", "yesterday", "last month".',
        },
        endDate: {
          type: 'string',
          description:
            'ISO date string for the end of the time range (e.g., "2025-12-20T23:59:59Z"). Use this for time-bound queries.',
        },
      },
      required: ['query'],
    },
  })

  // Add topic vote/endorsement lookup tool
  tools.push({
    name: 'get_topic_votes',
    description:
      'Look up how many people have endorsed or agreed with a topic, idea, proposal, or request. Use this when users ask "how many people want X?", "who agrees with Y?", "is Z popular?", "how many votes does X have?", or any question about support/agreement for any topic.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The topic, idea, or proposal to look up (e.g., "dark mode", "big bear trip", "team offsite", "new pricing")',
        },
      },
      required: ['query'],
    },
  })

  // Add team memory tool - allows AI to save important info for the whole team
  tools.push({
    name: 'add_to_team_memory',
    description:
      'Save important information to the Team AI Memory so everyone on the team can ask Poppy about it later. Use this when users say things like "remember this", "save this", "add to memory", "@poppy remember", or explicitly ask you to store something for the team. LOOK AT THE RECENT CHAT HISTORY to understand what they want remembered - they often say "remember this" referring to something discussed earlier. Summarize the key info in a clear, useful way that captures WHO said WHAT.',
    input_schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description:
            'A clear summary of the information to remember. Include WHO said what and the key facts. Example: "Rafeh confirmed the Q1 target is $500k ARR. David mentioned the deadline is March 31st." Make it useful for future lookups.',
        },
        source: {
          type: 'string',
          description: 'The main person(s) who provided this information',
        },
        context: {
          type: 'string',
          description:
            'Brief context: what topic/discussion is this from? (e.g., "Q1 planning discussion", "Germany trip planning")',
        },
      },
      required: ['content', 'source'],
    },
  })

  console.log('🤖 Poppy AI: Calling Claude API with Sonnet 4.5 via Keywords AI Gateway...')
  if (sendStatus) sendStatus('Calling Claude AI...')

  const keywordsApiKey = process.env.KEYWORDS_AI_API_KEY

  // Initialize Anthropic SDK with Keywords AI baseURL
  const anthropic = new Anthropic({
    apiKey: keywordsApiKey,
    baseURL: 'https://api.keywordsai.co/api/anthropic/',
  })

  // Generate thread_identifier for conversation tracking
  const threadId = user ? `poppy_chat_${user.id}` : 'poppy_chat_anonymous'

  let data
  try {
    // Build request with Keywords AI parameters in metadata
    const createParams = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      tools: tools,
      metadata: {
        keywordsai_params: {
          customer_params: user
            ? {
                customer_identifier: user.id,
                name: user.name,
                email: user.email,
              }
            : {
                customer_identifier: 'anonymous',
              },
          thread_identifier: threadId,
          custom_identifier: workflowId
            ? user
              ? `${workflowId}_user_${user.id}`
              : workflowId
            : user
            ? `user_${user.id}_ai_chat`
            : 'anonymous_ai_chat',
          prompt_id: 'poppy_ai_chat',
          is_custom_prompt: true,
          metadata: {
            app: 'poppy_team_chat',
            chat_type: 'ai_assistant',
            has_tools: tools.length > 0,
            tool_count: tools.length,
            workflow_id: workflowId,
            name: user ? user.name : 'Anonymous',
            email: user ? user.email : 'N/A',
          },
        },
      },
    }

    data = await keywordsAi.withTask(
      {
        name: 'claude_api_call',
        metadata: {
          model: 'claude-sonnet-4-5-20250929',
          has_tools: tools.length > 0,
          tool_count: tools.length,
        },
      },
      async () => {
        const response = await anthropic.messages.create(createParams)
        console.log('🤖 Poppy AI: Response received')
        return response
      }
    )
  } catch (error) {
    console.error('🤖 Poppy AI: API Error:', error)
    throw new Error(`API error: ${error.message}`)
  }

  // Log response structure for debugging
  if (!data.content) {
    console.error('🤖 Poppy AI: WARNING - No content in response:', JSON.stringify(data, null, 2))
  }

  // Track cumulative token usage across all API calls
  let totalInputTokens = data.usage?.input_tokens || 0
  let totalOutputTokens = data.usage?.output_tokens || 0
  const toolsUsedList = []

  // Handle tool use loop
  let lastMemoryToolMessage = null // Track memory tool success message as fallback

  while (data.stop_reason === 'tool_use') {
    console.log('🔧 Poppy AI: Claude wants to use a tool')

    // Find tool use blocks
    const toolUses = data.content.filter(block => block.type === 'tool_use')

    // Execute each tool via MCP
    const toolResults = []
    let executeActionFailed = false // Track if execute_action caused truncation

    for (const toolUse of toolUses) {
      // Categorize tool for clearer logging
      let toolCategory = '🔧 MCP'
      if (toolUse.name === 'search_chat_history') {
        toolCategory = '🔍 RAGIE'
      } else if (toolUse.name === 'get_topic_votes') {
        toolCategory = '🗳️  VOTES'
      } else if (toolUse.name === 'add_to_team_memory') {
        toolCategory = '🧠 MEMORY'
      } else if (
        toolUse.name.includes('notion') ||
        toolUse.name.includes('search_notion') ||
        toolUse.name.includes('query_database') ||
        toolUse.name.includes('execute_action')
      ) {
        toolCategory = '📝 NOTION'
      }

      console.log(`\n${'='.repeat(50)}`)
      console.log(`${toolCategory}: Using tool "${toolUse.name}"`)
      console.log(`${toolCategory}: Input:`, JSON.stringify(toolUse.input, null, 2))
      console.log(`${'='.repeat(50)}`)

      // Track which tools are used
      toolsUsedList.push(toolUse.name)

      if (sendStatus) sendStatus(`Using ${toolUse.name}...`)

      try {
        let toolResponse

        // Handle Ragie search tool separately
        if (toolUse.name === 'search_chat_history') {
          console.log(`🔍 RAGIE: Searching chat history for: "${toolUse.input.query}"`)
          console.log(`🔍 RAGIE: Current chat context:`, currentChat)
          if (toolUse.input.startDate || toolUse.input.endDate) {
            console.log(
              `🔍 RAGIE: Date filter - from: ${toolUse.input.startDate || 'any'} to: ${
                toolUse.input.endDate || 'any'
              }`
            )
          }
          const results = await searchChatHistory(
            userId,
            toolUse.input.query,
            currentChat,
            toolUse.input.startDate,
            toolUse.input.endDate
          )
          toolResponse = { content: results }
          console.log(`🔍 RAGIE: Found ${results.length} results`)
          if (results.length > 0) {
            console.log(`🔍 RAGIE: Sample result:`, results[0])
          }
        } else if (toolUse.name === 'get_topic_votes') {
          // Handle topic vote lookup
          console.log(`🗳️  VOTES: Looking up votes for: "${toolUse.input.query}"`)
          const results = await getTopicVotes(toolUse.input.query)
          toolResponse = { content: results }
          console.log(`🗳️  VOTES: Found ${results.length} matching topic(s)`)
          if (results.length > 0) {
            const totalVotes = results.reduce((sum, r) => sum + (r.votes || 0), 0)
            console.log(`🗳️  VOTES: Total votes across matches: ${totalVotes}`)
          }
        } else if (toolUse.name === 'add_to_team_memory') {
          // Handle adding to team memory
          console.log(`🧠 MEMORY: Adding to team memory...`)
          console.log(`🧠 MEMORY: Content: "${toolUse.input.content?.substring(0, 100)}..."`)
          console.log(`🧠 MEMORY: Source: ${toolUse.input.source}`)
          const result = await addToTeamMemory({
            content: toolUse.input.content,
            source: toolUse.input.source,
            context: toolUse.input.context,
            addedBy: user?.name || user?.email || 'Unknown',
            addedByEmail: user?.email,
            addedById: user?.id,
          })
          toolResponse = { content: result }
          console.log(`🧠 MEMORY: ${result.success ? '✅ Added successfully' : '❌ Failed'}`)

          // Save the success message as fallback (Claude sometimes doesn't respond after tool use)
          if (result.success && result.message) {
            lastMemoryToolMessage = result.message
          }
        } else {
          // Call MCP tools with tracing
          console.log(`${toolCategory}: Executing for user ${userId}`)
          toolResponse = await keywordsAi.withTask(
            {
              name: `mcp_tool_${toolUse.name}`,
              metadata: {
                tool_name: toolUse.name,
                server: userId,
                input_keys: Object.keys(toolUse.input || {}),
              },
            },
            async () => {
              return await mcpManager.callTool(userId, toolUse.name, toolUse.input)
            }
          )
        }

        // Truncate response if too large (prevent token limit errors)
        let responseContent = JSON.stringify(toolResponse.content)
        const MAX_TOOL_RESPONSE_CHARS = 100000 // ~25K tokens (4 chars per token avg)
        let wasTruncated = false

        if (responseContent.length > MAX_TOOL_RESPONSE_CHARS) {
          console.warn(
            `🔧 MCP: Tool response too large (${responseContent.length} chars), truncating to ${MAX_TOOL_RESPONSE_CHARS}`
          )
          responseContent =
            responseContent.substring(0, MAX_TOOL_RESPONSE_CHARS) +
            '\n\n[Response truncated due to size. Query returned too many results - try filtering or limiting results.]'
          wasTruncated = true

          // Flag if execute_action caused the truncation (so we can retry)
          if (toolUse.name === 'execute_action') {
            executeActionFailed = true
          }
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: responseContent,
        })

        if (sendStatus) sendStatus('Processing results...')
      } catch (error) {
        console.error(`🔧 MCP: Error executing tool ${toolUse.name}:`, error)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: error.message }),
          is_error: true,
        })
      }
    }

    // Add assistant's response and tool results to messages
    messages.push({
      role: 'assistant',
      content: data.content,
    })

    messages.push({
      role: 'user',
      content: toolResults,
    })

    // If execute_action failed due to size, add a hint to retry with query_database
    if (executeActionFailed) {
      console.log('🔄 MCP: execute_action was truncated, adding retry hint for Claude')
      messages.push({
        role: 'user',
        content:
          'The previous execute_action query returned too much data and was truncated. Please retry using query_database instead, with proper filters (e.g., filter by "platform" column) and sorts (e.g., last_edited_time descending) to get a manageable number of results (10-20 max).',
      })
      if (sendStatus) sendStatus('Retrying with better query...')
    }

    // Call Claude again with tool results
    if (sendStatus) sendStatus('Processing results...')
    data = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      tools: tools,
      metadata: {
        keywordsai_params: {
          customer_params: user
            ? {
                customer_identifier: user.id,
                name: user.name,
                email: user.email,
              }
            : {
                customer_identifier: 'anonymous',
              },
          thread_identifier: threadId,
          custom_identifier: workflowId
            ? user
              ? `${workflowId}_user_${user.id}`
              : workflowId
            : user
            ? `user_${user.id}_ai_chat`
            : 'anonymous_ai_chat',
          prompt_id: 'poppy_ai_chat',
          is_custom_prompt: true,
          metadata: {
            app: 'poppy_team_chat',
            chat_type: 'ai_assistant',
            has_tools: tools.length > 0,
            tool_count: tools.length,
            is_tool_retry: true,
            name: user.name,
            email: user.email,
          },
        },
      },
    })
    console.log('🤖 Poppy AI: Got response after tool use')

    // Accumulate tokens from this API call
    totalInputTokens += data.usage?.input_tokens || 0
    totalOutputTokens += data.usage?.output_tokens || 0
  }

  // Calculate cost and track usage (Claude Sonnet 4 pricing: $3/1M input, $15/1M output)
  const inputCost = (totalInputTokens / 1_000_000) * 3
  const outputCost = (totalOutputTokens / 1_000_000) * 15
  const totalCost = inputCost + outputCost

  console.log(`💰 AI Chat Tokens: ${totalInputTokens} in / ${totalOutputTokens} out`)
  console.log(`💵 AI Chat Cost: $${totalCost.toFixed(6)}`)

  // Track AI usage to Firestore (async, don't await to avoid blocking response)
  trackAIUsage({
    type: 'ai_chat',
    model: 'claude-sonnet-4-5-20250929',
    inputTokens: totalInputTokens,
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

  // Extract final text from response
  if (!data || !data.content || !Array.isArray(data.content)) {
    console.error('🤖 Poppy AI: Invalid response structure:', data)
    const aiResponse = 'Sorry, I got a weird response. Try again!'

    if (controller && encoder) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: aiResponse })}\n\n`))
    }

    return aiResponse
  }

  const textBlock = data.content.find(block => block.type === 'text')
  // Use Claude's text response, or fallback to memory tool message, or generic error
  const aiResponse =
    textBlock?.text || lastMemoryToolMessage || 'Hmm, I got confused there. Try asking again!'

  if (sendStatus) sendStatus('Done!')

  // If streaming, send the final response
  if (controller && encoder) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: aiResponse })}\n\n`))
  }

  return aiResponse
}

export async function POST(request) {
  try {
    const { message, chatHistory, stream, user, currentChat } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not configured')
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
    }

    // Generate unique workflow ID for this request
    const workflowId = generateWorkflowId()
    console.log(`🔄 Workflow ID: ${workflowId}`)

    // If streaming is requested, use SSE
    if (stream) {
      const encoder = new TextEncoder()
      const customReadable = new ReadableStream({
        async start(controller) {
          const sendStatus = status => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status })}\n\n`))
          }

          try {
            sendStatus('Thinking...')

            // Wrap in workflow for tracing
            await keywordsAi.withWorkflow(
              {
                name: 'poppy_ai_chat',
                metadata: {
                  workflow_id: workflowId,
                  user_id: user?.id || 'anonymous',
                  user_name: user?.name || 'Anonymous',
                  stream: true,
                },
              },
              async () => {
                await processAIRequest(
                  message,
                  chatHistory,
                  apiKey,
                  user,
                  currentChat,
                  sendStatus,
                  controller,
                  encoder,
                  workflowId
                )
              }
            )

            controller.close()
          } catch (error) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
            )
            controller.close()
          }
        },
      })

      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // Non-streaming mode - wrap in workflow for tracing
    const aiResponse = await keywordsAi.withWorkflow(
      {
        name: 'poppy_ai_chat',
        metadata: {
          workflow_id: workflowId,
          user_id: user?.id || 'anonymous',
          user_name: user?.name || 'Anonymous',
          stream: false,
        },
      },
      async () => {
        return await processAIRequest(
          message,
          chatHistory,
          apiKey,
          user,
          currentChat,
          null,
          null,
          null,
          workflowId
        )
      }
    )
    return NextResponse.json({ response: aiResponse })
  } catch (error) {
    console.error('Error in AI chat route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
