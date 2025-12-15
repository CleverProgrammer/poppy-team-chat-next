import { NextResponse } from 'next/server';
import ragie from '../../../lib/ragie-client.js';

// Sync a message to Ragie for RAG retrieval
export async function POST(request) {
  try {
    const {
      messageId,
      chatId,
      chatType,
      text,
      sender,
      senderEmail,
      senderId,
      timestamp,
      participants
    } = await request.json();

    if (!messageId || !text || !chatId || !chatType) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, text, chatId, chatType' },
        { status: 400 }
      );
    }

    // Build metadata for permission-scoped retrieval
    const metadata = {
      messageId,
      sender: sender || 'Unknown',
      senderEmail: senderEmail || '',
      senderId: senderId || '',
      timestamp: timestamp || new Date().toISOString(),
      chatType, // 'dm' or 'channel'
      chatId    // 'general', 'test', or 'dm_user1_user2'
    };

    // Add participants for DMs (for permission filtering)
    if (chatType === 'dm' && participants) {
      metadata.participants = participants;
    }

    console.log(`📚 Ragie: Indexing message ${messageId} to ${chatType}:${chatId}`);

    // Create document in Ragie with message content and metadata
    const document = await ragie.documents.createRaw({
      data: `[${sender}]: ${text}`,
      metadata
    });

    console.log(`✅ Ragie: Indexed message ${messageId}, doc ID: ${document.id}`);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      messageId
    });
  } catch (error) {
    console.error('❌ Ragie sync error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}