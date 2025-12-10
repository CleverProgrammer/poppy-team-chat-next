import { NextResponse } from 'next/server';
import { setupNotionMCPIntegration, cleanupMCPClients } from '../../lib/notion-mcp-client.js';
import { auth } from '../../lib/firebase.js';

// Main AI processing function (extracted for both streaming and non-streaming)
async function processAIRequest(message, chatHistory, apiKey, sendStatus = null, controller = null, encoder = null) {
  // Build base system prompt
  let systemPrompt = `You are Poppy, a friendly AI assistant in Poppy Chat.

tldr bro. respond like SUPER fucking short unless I explicitly ask you to expand. Also keep shit very simple and easy to understand!

IMPORTANT FORMATTING RULES:
- NO markdown ever (no **, no *, no #, no \`, no - bullets, no numbered lists)
- Write plain text only, like a casual text message
- Use line breaks to separate thoughts (makes it easy to read!)
- Keep responses SHORT but well-spaced
- Be casual, friendly, and conversational
- Use emojis sparingly if it fits the vibe

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

  // Setup Notion MCP integration
  console.log('🔧 Notion MCP: Checking for integration...');
  if (sendStatus) sendStatus('Loading Notion tools...');

  let mcpClients = [];
  let tools = [];
  let notionToolsAvailable = false;
  
  try {
    const { mcpTools, mcpClients: clients } = await setupNotionMCPIntegration();
    mcpClients = clients;
    
    if (mcpTools && Object.keys(mcpTools).length > 0) {
      // Convert MCP tools to Claude format
      tools = Object.entries(mcpTools).map(([name, tool]) => {
        // Extract input schema from the tool config
        const inputSchema = tool.inputSchema || tool.input_schema || tool.parameters || { type: 'object', properties: {} };
        
        // Ensure input_schema has required 'type' field
        if (!inputSchema.type) {
          inputSchema.type = 'object';
        }

        return {
          name: name,
          description: tool.description || 'No description available',
          input_schema: inputSchema
        };
      });

      notionToolsAvailable = true;
      
      // Update system prompt with Notion instructions
      systemPrompt += `\n\n
<notion_integration>
  You have access to Notion MCP tools for interacting with Notion workspaces.

  Available Notion tools: ${Object.keys(mcpTools).join(', ')}

  For any requests related to:
  - Reading, searching, or querying Notion pages/databases
  - Creating or updating Notion content
  - Managing Notion workspaces, pages, or databases
  - Notion-related operations

  RULES:
  - Use the available Notion MCP tools instead of providing general advice
  - These tools can directly interact with the user's connected Notion workspace
  - If the user asks for any change to Notion content, you MUST invoke the relevant Notion MCP tool to perform that change before responding
  - After completing any Notion create, update, or delete action, immediately read the affected resource to verify the change
  - Only confirm success to the user once the verification read matches the intended outcome
  - If the change is not verified, retry the operation within the same request before responding
  - ALWAYS SEARCH NOTION BEFORE GIVING UP
  - If you don't immediately know an answer, search Notion FIRST
  - Try different tools and keywords if needed - be persistent
  - Only say "I don't know" as an ABSOLUTE LAST RESORT after trying everything
  - Don't ask permission to search - just do it
</notion_integration>`;

      console.log(`🔧 Notion MCP: Loaded ${tools.length} tools`);
      if (sendStatus) sendStatus('Ready!');
    } else {
      console.log('ℹ️ No Notion MCP tools available for this user');
    }
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
      tools: tools.length > 0 ? tools : undefined
    })
  });

  console.log('🤖 Poppy AI: Response status:', response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error('🤖 Poppy AI: API Error Response:', error);
    
    // Cleanup MCP clients before throwing
    if (mcpClients.length > 0) {
      await cleanupMCPClients(mcpClients);
    }
    
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

    // Execute each tool via Notion MCP
    const toolResults = [];
    for (const toolUse of toolUses) {
      console.log(`🔧 Notion MCP: Executing tool: ${toolUse.name}`);
      if (sendStatus) sendStatus(`Using ${toolUse.name}...`);

      try {
        // Call tool through MCP client
        if (mcpClients.length > 0) {
          const mcpClient = mcpClients[0];
          
          // Remove the 'notion_' prefix to get the actual tool name
          const actualToolName = toolUse.name.replace(/^notion_/, '');
          
          // Get all tools from MCP client
          const allTools = await mcpClient.tools();
          const tool = allTools[actualToolName];
          
          if (tool && tool.execute) {
            const mcpResponse = await tool.execute(toolUse.input);
            
            // Format the response for Claude
            let content;
            if (typeof mcpResponse === 'string') {
              content = mcpResponse;
            } else if (mcpResponse && mcpResponse.content) {
              content = JSON.stringify(mcpResponse.content);
            } else {
              content = JSON.stringify(mcpResponse);
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: content
            });
          } else {
            throw new Error(`Tool ${actualToolName} not found in MCP client`);
          }
        } else {
          throw new Error('No MCP client available');
        }

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
        tools: tools.length > 0 ? tools : undefined
      })
    });

    data = await response.json();
    console.log('🤖 Poppy AI: Got response after tool use');
  }

  // Cleanup MCP clients
  if (mcpClients.length > 0) {
    await cleanupMCPClients(mcpClients);
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
