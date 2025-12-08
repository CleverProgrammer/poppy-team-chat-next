import { NextResponse } from 'next/server';
import { notifyNewDM } from '../../lib/knock';

export async function POST(request) {
  try {
    const { senderId, senderName, recipientId, messageText } = await request.json();

    await notifyNewDM(senderId, recipientId, messageText, senderName);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending DM notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
