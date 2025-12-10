import { NextResponse } from 'next/server';
import notionClient from '../../lib/notion-client.js';

// Main AI processing function (extracted for both streaming and non-streaming)
async function processAIRequest(message, chatHistory, apiKey, sendStatus = null, controller = null, encoder = null) {
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
- Try the search tool (API-post-search) with different keywords if needed
- Try query_database, get_page, list_databases - whatever makes sense
- Be persistent and exhaustive in trying to find information
- Only say "I don't know" as an ABSOLUTE LAST RESORT after trying everything
- Don't ask permission to search - just do it

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

  // Get Notion MCP tools
  console.log('🔧 Notion MCP: Loading tools...');
  if (sendStatus) sendStatus('Loading Notion tools...');

  let mcpTools = {};
  let tools = [];
  
  try {
    mcpTools = await notionClient.listTools();
    
    // Convert MCP tools to Claude format
    tools = Object.entries(mcpTools).map(([name, tool]) => ({
      name: name,
      description: tool.description,
      input_schema: tool.parameters
    }));

    console.log(`🔧 Notion MCP: Loaded ${tools.length} tools`);
    if (sendStatus) sendStatus('Ready!');
  } catch (error) {
    console.error('🔧 MCP: Failed to load Notion tools:', error);
    // Continue without Notion tools
  }
  

  console.log('🤖 Poppy AI: Calling Claude API with Sonnet 4.5...');
  if (sendStatus) sendStatus('Calling Claude AI...');

  let response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      tools: tools
    })
  });

  console.log('🤖 Poppy AI: Response status:', response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error('🤖 Poppy AI: API Error Response:', error);
    throw new Error(`API error: ${error}`);
  }

  let data = await response.json();
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

    // Execute each tool via Notion MCP adapter
    const toolResults = [];
    for (const toolUse of toolUses) {
      console.log(`🔧 Notion MCP: Executing tool: ${toolUse.name}`);
      if (sendStatus) sendStatus(`Using ${toolUse.name}...`);

      try {
        // Call tool through MCP interface
        const mcpResponse = await notionClient.callTool(toolUse.name, toolUse.input);

        // Format the response for Claude
        let content;
        if (typeof mcpResponse === 'string') {
          content = mcpResponse;
        } else if (mcpResponse.content) {
          content = JSON.stringify(mcpResponse.content);
        } else {
          content = JSON.stringify(mcpResponse);
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: content
        });

        if (sendStatus) sendStatus('Processing results...');
      } catch (error) {
        console.error(`🔧 Notion MCP: Error executing tool ${toolUse.name}:`, error);
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

    // Call Claude again with tool results
    if (sendStatus) sendStatus('Processing results...');
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages,
        tools: tools
      })
    });

    data = await response.json();
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
    const { message, chatHistory, stream } = await request.json();

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
            await processAIRequest(message, chatHistory, apiKey, sendStatus, controller, encoder);

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
    const aiResponse = await processAIRequest(message, chatHistory, apiKey);
    return NextResponse.json({ response: aiResponse });

  } catch (error) {
    console.error('Error in AI chat route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
