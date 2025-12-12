import { NextResponse } from 'next/server';
import mcpManager from '../../lib/mcp-client.js';
import Anthropic from '@anthropic-ai/sdk';

// Main AI processing function (extracted for both streaming and non-streaming)
async function processAIRequest(message, chatHistory, apiKey, user = null, sendStatus = null, controller = null, encoder = null) {
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

TOOL SELECTION GUIDELINES:
- For structured queries (filtering, sorting): Use query_database
  Example: "emails being worked on" → query_database with filter on "platform" column
- For text search: Use API-post-search with keywords
- NEVER use execute_action - it returns ALL data unfiltered (causes token limit errors)
- Always limit results: Use page_size parameter to get top 10-20 results max
- Always sort by relevance: Use sorts parameter (e.g., last_edited_time descending)

CONTENT PIPELINE DATABASE STRUCTURE:
- Has a "platform" column with values: Email, Instagram, YouTube, TikTok, etc.
- Use this to filter content by type
- Sort by last_edited_time to get recent items

Be persistent and exhaustive in trying to find information.
Only say "I don't know" as an ABSOLUTE LAST RESORT after trying everything.
Don't ask permission to search - just do it.

EXAMPLE FORMAT:
Hey! Great question.

The answer is actually pretty simple - just do X and then Y.

Let me know if that helps! 🙌

Be helpful, witty, and brief. Use line breaks between thoughts for easy reading.`;

  // Build messages array from chat history
  const messages = [];

  // Add recent chat history if provided (last 10 messages for context)
  if (chatHistory && chatHistory.length > 0) {
    const recentHistory = chatHistory.slice(-10);
    recentHistory.forEach(msg => {
      if (msg.sender && msg.text) {
        messages.push({
          role: msg.senderId === 'ai' ? 'assistant' : 'user',
          content: `${msg.sender}: ${msg.text}`
        });
      }
    });
  }

  // Add the current user message
  messages.push({
    role: 'user',
    content: message
  });

  // Get available MCP tools from Notion
  console.log('🔧 MCP: Loading Notion tools...');
  if (sendStatus) sendStatus('Loading Notion tools...');

  let mcpTools = [];
  try {
    mcpTools = await mcpManager.listTools('notion');
    console.log(`🔧 MCP: Loaded ${mcpTools.length} Notion tools`);
  } catch (error) {
    console.error('🔧 MCP: Failed to load Notion tools:', error);
  }

  // Convert MCP tools to Claude format
  const tools = mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
  }));

  console.log('🤖 Poppy AI: Calling Claude API with Sonnet 4.5 via Keywords AI Gateway...');
  if (sendStatus) sendStatus('Calling Claude AI...');

  const keywordsApiKey = process.env.KEYWORDS_AI_API_KEY;

  // Initialize Anthropic SDK with Keywords AI baseURL
  const anthropic = new Anthropic({
    apiKey: keywordsApiKey,
    baseURL: 'https://api.keywordsai.co/api/anthropic/'
  });

  // Generate thread_identifier for conversation tracking
  const threadId = user ? `poppy_chat_${user.id}` : 'poppy_chat_anonymous';

  let data;
  try {
    // Build request with Keywords AI parameters
    const createParams = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      tools: tools,
      metadata: {
        keywordsai_params: {
          customer_params: user ? {
            customer_identifier: user.id,
            name: user.name,
            email: user.email
          } : {
            customer_identifier: 'anonymous'
          },
          thread_identifier: threadId,
          custom_identifier: user ? `user_${user.id}_ai_chat` : 'anonymous_ai_chat',
          prompt_id: 'poppy_ai_chat',
          is_custom_prompt: true
        }
      }
    };

    // Pass custom metadata via options (second parameter)
    const requestOptions = {
      body: {
        metadata: {
          app: 'poppy_team_chat',
          chat_type: 'ai_assistant',
          has_tools: tools.length > 0,
          tool_count: tools.length
        }
      }
    };

    data = await anthropic.messages.create(createParams, requestOptions);
    console.log('🤖 Poppy AI: Response received');
  } catch (error) {
    console.error('🤖 Poppy AI: API Error:', error);
    throw new Error(`API error: ${error.message}`);
  }
  console.log('🤖 Poppy AI: Response received');

  // Log response structure for debugging
  if (!data.content) {
    console.error('🤖 Poppy AI: WARNING - No content in response:', JSON.stringify(data, null, 2));
  }

  // Handle tool use loop
  while (data.stop_reason === 'tool_use') {
    console.log('🔧 Poppy AI: Claude wants to use a tool');

    // Find tool use blocks
    const toolUses = data.content.filter(block => block.type === 'tool_use');

    // Execute each tool via MCP
    const toolResults = [];
    let executeActionFailed = false; // Track if execute_action caused truncation

    for (const toolUse of toolUses) {
      console.log(`🔧 MCP: Executing tool: ${toolUse.name}`);
      if (sendStatus) sendStatus(`Using ${toolUse.name}...`);

      try {
        // Call the MCP tool
        const mcpResponse = await mcpManager.callTool('notion', toolUse.name, toolUse.input);

        // Truncate response if too large (prevent token limit errors)
        let responseContent = JSON.stringify(mcpResponse.content);
        const MAX_TOOL_RESPONSE_CHARS = 100000; // ~25K tokens (4 chars per token avg)
        let wasTruncated = false;

        if (responseContent.length > MAX_TOOL_RESPONSE_CHARS) {
          console.warn(`🔧 MCP: Tool response too large (${responseContent.length} chars), truncating to ${MAX_TOOL_RESPONSE_CHARS}`);
          responseContent = responseContent.substring(0, MAX_TOOL_RESPONSE_CHARS) + '\n\n[Response truncated due to size. Query returned too many results - try filtering or limiting results.]';
          wasTruncated = true;

          // Flag if execute_action caused the truncation (so we can retry)
          if (toolUse.name === 'execute_action') {
            executeActionFailed = true;
          }
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: responseContent
        });

        if (sendStatus) sendStatus('Processing results...');
      } catch (error) {
        console.error(`🔧 MCP: Error executing tool ${toolUse.name}:`, error);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: error.message }),
          is_error: true
        });
      }
    }

    // Add assistant's response and tool results to messages
    messages.push({
      role: 'assistant',
      content: data.content
    });

    messages.push({
      role: 'user',
      content: toolResults
    });

    // If execute_action failed due to size, add a hint to retry with query_database
    if (executeActionFailed) {
      console.log('🔄 MCP: execute_action was truncated, adding retry hint for Claude');
      messages.push({
        role: 'user',
        content: 'The previous execute_action query returned too much data and was truncated. Please retry using query_database instead, with proper filters (e.g., filter by "platform" column) and sorts (e.g., last_edited_time descending) to get a manageable number of results (10-20 max).'
      });
      if (sendStatus) sendStatus('Retrying with better query...');
    }

    // Call Claude again with tool results
    if (sendStatus) sendStatus('Processing results...');

    const retryParams = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      tools: tools,
      metadata: {
        keywordsai_params: {
          customer_params: user ? {
            customer_identifier: user.id,
            name: user.name,
            email: user.email
          } : {
            customer_identifier: 'anonymous'
          },
          thread_identifier: threadId,
          custom_identifier: user ? `user_${user.id}_ai_chat` : 'anonymous_ai_chat',
          prompt_id: 'poppy_ai_chat',
          is_custom_prompt: true
        }
      }
    };

    const retryOptions = {
      body: {
        metadata: {
          app: 'poppy_team_chat',
          chat_type: 'ai_assistant',
          has_tools: tools.length > 0,
          tool_count: tools.length,
          is_tool_retry: true
        }
      }
    };

    data = await anthropic.messages.create(retryParams, retryOptions);
    console.log('🤖 Poppy AI: Got response after tool use');
  }

  // Extract final text from response
  if (!data || !data.content || !Array.isArray(data.content)) {
    console.error('🤖 Poppy AI: Invalid response structure:', data);
    const aiResponse = 'Sorry, I got a weird response. Try again! 🤖';

    if (controller && encoder) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: aiResponse })}\n\n`));
    }

    return aiResponse;
  }

  const textBlock = data.content.find(block => block.type === 'text');
  const aiResponse = textBlock ? textBlock.text : 'Hmm, I got confused there. Try asking again!';

  if (sendStatus) sendStatus('Done!');

  // If streaming, send the final response
  if (controller && encoder) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: aiResponse })}\n\n`));
  }

  return aiResponse;
}

export async function POST(request) {
  try {
    const { message, chatHistory, stream, user } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // If streaming is requested, use SSE
    if (stream) {
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          const sendStatus = (status) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status })}\n\n`));
          };

          try {
            sendStatus('Thinking...');

            // Continue with AI processing (code below will be wrapped)
            await processAIRequest(message, chatHistory, apiKey, user, sendStatus, controller, encoder);

            controller.close();
          } catch (error) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming mode - use the extracted function
    const aiResponse = await processAIRequest(message, chatHistory, apiKey, user);
    return NextResponse.json({ response: aiResponse });

  } catch (error) {
    console.error('Error in AI chat route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
