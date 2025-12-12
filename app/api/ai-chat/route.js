import { NextResponse } from 'next/server'
import mcpManager from '../../lib/mcp-client.js'
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, tool, jsonSchema } from 'ai'

export async function POST(request) {
  try {
    const { message, chatHistory, user } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const keywordsApiKey = process.env.KEYWORDS_AI_API_KEY
    if (!keywordsApiKey) {
      console.error('KEYWORDS_AI_API_KEY not configured')
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      )
    }

    // Build system prompt
    const systemPrompt = `You are Poppy, a friendly AI assistant in Poppy Chat.

tldr bro. respond like SUPER fucking short unless I explicitly ask you to expand. Also keep shit very simple and easy to understand!

IMPORTANT FORMATTING RULES:
- NO markdown ever (no **, no *, no #, no \`, no - bullets, no numbered lists)
- Write plain text only, like a casual text message
- Use line breaks to separate thoughts (makes it easy to read!)
- Keep responses SHORT but well-spaced
- Be casual, friendly, and conversational
- Use emojis sparingly if it fits the vibe

CRITICAL: ALWAYS SEARCH NOTION BEFORE GIVING UP
- You have access to Notion tools - USE THEM proactively
- If you don't immediately know an answer, search Notion FIRST

CONTENT PIPELINE DATABASE STRUCTURE:
- Has a "platform" column with values: Email, Instagram, YouTube, TikTok, etc.
- Use this to filter content by type
- Sort by last_edited_time to get recent items

Be persistent and exhaustive in trying to find information.
Only say "I don't know" as an ABSOLUTE LAST RESORT after trying everything.
Don't ask permission to search - just do it.`

    // Build messages array from chat history
    const messages = []

    // Add recent chat history if provided (last 10 messages for context)
    if (chatHistory && chatHistory.length > 0) {
      const recentHistory = chatHistory.slice(-10)
      recentHistory.forEach(msg => {
        if (msg.sender && msg.text) {
          messages.push({
            role: msg.senderId === 'ai' ? 'assistant' : 'user',
            content: `${msg.sender}: ${msg.text}`,
          })
        }
      })
    }

    // Add the current user message
    messages.push({
      role: 'user',
      content: message,
    })

    // Get available MCP tools from Notion
    console.log('🔧 MCP: Loading Notion tools...')
    let mcpTools = []
    try {
      mcpTools = await mcpManager.listTools('notion')
      console.log(`🔧 MCP: Loaded ${mcpTools.length} Notion tools`)
    } catch (error) {
      console.error('🔧 MCP: Failed to load Notion tools:', error)
    }

    // Convert MCP tools to Vercel AI SDK format
    const tools = {}
    mcpTools.forEach(mcpTool => {
      // Ensure inputSchema has required 'type' field for Anthropic
      // Spread first, then force type to 'object' (overrides any existing type)
      const schema = {
        ...mcpTool.inputSchema,
        type: 'object', // Force type to always be 'object'
      }

      tools[mcpTool.name] = tool({
        description: mcpTool.description,
        inputSchema: jsonSchema(schema), // Use jsonSchema() helper for JSON schemas
        execute: async params => {
          console.log(`🔧 MCP: Executing tool: ${mcpTool.name}`)
          try {
            const mcpResponse = await mcpManager.callTool(
              'notion',
              mcpTool.name,
              params
            )

            // Truncate response if too large (prevent token limit errors)
            let responseContent = JSON.stringify(mcpResponse.content)
            const MAX_TOOL_RESPONSE_CHARS = 100000 // ~25K tokens (4 chars per token avg)

            if (responseContent.length > MAX_TOOL_RESPONSE_CHARS) {
              console.warn(
                `🔧 MCP: Tool response too large (${responseContent.length} chars), truncating to ${MAX_TOOL_RESPONSE_CHARS}`
              )
              responseContent =
                responseContent.substring(0, MAX_TOOL_RESPONSE_CHARS) +
                '\n\n[Response truncated due to size. Query returned too many results - try filtering or limiting results.]'
            }

            return responseContent
          } catch (error) {
            console.error(
              `🔧 MCP: Error executing tool ${mcpTool.name}:`,
              error
            )
            throw error
          }
        },
      })
    })

    // Prepare Keywords AI parameters as base64-encoded header
    const threadId = user ? `poppy_chat_${user.id}` : 'poppy_chat_anonymous'
    const keywordsAIHeaderContent = {
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
      custom_identifier: user ? `user_${user.id}_ai_chat` : 'anonymous_ai_chat',
      prompt_id: 'poppy_ai_chat',
      is_custom_prompt: true,
      keywords_metadata: {
        app: 'poppy_team_chat',
        chat_type: 'ai_assistant',
        has_tools: Object.keys(tools).length > 0,
        tool_count: Object.keys(tools).length,
      },
    }

    const encoded = Buffer.from(
      JSON.stringify(keywordsAIHeaderContent)
    ).toString('base64')

    // Initialize Anthropic with Keywords AI Gateway
    const anthropic = createAnthropic({
      baseURL: 'https://api.keywordsai.co/api/anthropic/v1',
      apiKey: keywordsApiKey,
      headers: {
        'X-Data-Keywordsai-Params': encoded,
      },
    })

    console.log(
      '🤖 Poppy AI: Calling Claude API with Sonnet 4.5 via Keywords AI Gateway...'
    )

    // Use streamText from Vercel AI SDK
    const result = streamText({
      model: anthropic('claude-sonnet-4-5-20250929'),
      system: systemPrompt,
      messages: messages,
      tools: tools,
      maxSteps: 5, // Allow up to 5 tool calls
    })

    // Return streaming response (handles tool execution automatically)
    return result.toTextStreamResponse()
  } catch (error) {
    console.error('Error in AI chat route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
