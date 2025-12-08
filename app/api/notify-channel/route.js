import { NextResponse } from 'next/server';
import { notifyNewChannelMessage } from '../../lib/knock';

export async function POST(request) {
  try {
    const { senderId, senderName, channelId, messageText, allUsers } = await request.json();

    await notifyNewChannelMessage(senderId, channelId, messageText, senderName, allUsers);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending channel notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
