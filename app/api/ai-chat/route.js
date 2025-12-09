import { NextResponse } from 'next/server';

// Helper function to call Notion API directly
async function searchNotion(query) {
  const notionApiKey = process.env.NOTION_API_KEY;

  const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await response.json();
  return data.results || [];
}

// Helper function to get page content from Notion
async function getNotionPage(pageId) {
  const notionApiKey = process.env.NOTION_API_KEY;

  const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28'
    }
  });

  const data = await response.json();
  return data.results || [];
}

export async function POST(request) {
  try {
    const { message, chatHistory } = await request.json();

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

    // Define Notion tools for Claude
    const tools = [
      {
        name: 'search_notion',
        description: 'Search through all Notion pages and databases. Use this when the user asks about information that might be stored in Notion, like notes, documents, tasks, knowledge bases, etc.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to find relevant Notion pages'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_notion_page',
        description: 'Get the full content of a specific Notion page. Use this after searching to read the actual content of a page.',
        input_schema: {
          type: 'object',
          properties: {
            page_id: {
              type: 'string',
              description: 'The Notion page ID to retrieve content from'
            }
          },
          required: ['page_id']
        }
      }
    ];

    console.log('🤖 Poppy AI: Calling Claude API with Sonnet 4.5...');
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
      return NextResponse.json(
        { error: `API error: ${error}` },
        { status: response.status }
      );
    }

    let data = await response.json();
    console.log('🤖 Poppy AI: Response received');

    // Handle tool use loop
    while (data.stop_reason === 'tool_use') {
      console.log('🔧 Poppy AI: Claude wants to use a tool');

      // Find tool use blocks
      const toolUses = data.content.filter(block => block.type === 'tool_use');

      // Execute each tool
      const toolResults = [];
      for (const toolUse of toolUses) {
        console.log(`🔧 Poppy AI: Executing tool: ${toolUse.name}`);

        let toolResult;
        if (toolUse.name === 'search_notion') {
          const searchResults = await searchNotion(toolUse.input.query);
          toolResult = JSON.stringify(searchResults.map(page => ({
            id: page.id,
            title: page.properties?.title?.title?.[0]?.plain_text || page.properties?.Name?.title?.[0]?.plain_text || 'Untitled',
            url: page.url
          })));
        } else if (toolUse.name === 'get_notion_page') {
          const pageContent = await getNotionPage(toolUse.input.page_id);
          toolResult = JSON.stringify(pageContent);
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: toolResult
        });
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
    const textBlock = data.content.find(block => block.type === 'text');
    const aiResponse = textBlock ? textBlock.text : 'Hmm, I got confused there. Try asking again!';

    return NextResponse.json({ response: aiResponse });

  } catch (error) {
    console.error('Error in AI chat route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
