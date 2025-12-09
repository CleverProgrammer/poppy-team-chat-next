import { NextResponse } from 'next/server';

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

    console.log('🤖 Poppy AI: Calling Claude API with Sonnet 4.5...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
        messages: messages
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

    const data = await response.json();
    console.log('🤖 Poppy AI: Response received');

    // Extract text from response
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
