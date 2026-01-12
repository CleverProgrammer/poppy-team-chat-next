import { NextResponse } from 'next/server';
import { tasks } from '@trigger.dev/sdk/v3';

// Get the app URL for callbacks - works for both Vercel and local dev
function getCallbackUrl() {
  // Vercel sets this automatically for all deployments (preview and production)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Fallback for local development
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
}

export async function POST(request) {
  try {
    const { audioUrl, userId, messageId, chatId, chatType, audioIndex } = await request.json();

    if (!audioUrl || !userId || !messageId || !chatId || chatType === undefined || audioIndex === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const callbackUrl = getCallbackUrl();
    console.log(`🔄 Triggering CAF→MP3 conversion, callback URL: ${callbackUrl}`);

    // Trigger the background conversion task
    await tasks.trigger("convert-caf-to-mp3", {
      audioUrl,
      userId,
      messageId,
      chatId,
      chatType,
      audioIndex,
      callbackUrl, // Pass the callback URL so Trigger.dev knows where to send the result
    });

    return NextResponse.json({ success: true, message: 'Audio conversion triggered' });
  } catch (error) {
    console.error('Error triggering audio conversion:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

