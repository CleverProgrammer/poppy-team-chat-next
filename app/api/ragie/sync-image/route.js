import { NextResponse } from 'next/server';
import ragie from '../../../lib/ragie-client.js';

// Sync an image to Ragie for RAG retrieval
export async function POST(request) {
  try {
    const {
      messageId,
      chatId,
      chatType,
      imageUrl,
      sender,
      senderEmail,
      senderId,
      timestamp,
      participants,
      recipientId,
      recipientName,
      recipientEmail,
      text // Optional accompanying text
    } = await request.json();

    if (!messageId || !imageUrl || !chatId || !chatType) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, imageUrl, chatId, chatType' },
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
      chatType,
      chatId,
      contentType: 'image',
      accompanyingText: text || ''
    };

    // Add DM-specific metadata
    if (chatType === 'dm') {
      if (participants) metadata.participants = participants;
      if (recipientId) metadata.recipientId = recipientId;
      if (recipientName) metadata.recipientName = recipientName;
      if (recipientEmail) metadata.recipientEmail = recipientEmail;
    }

    console.log(`🖼️ Ragie: Indexing image ${messageId} from ${imageUrl}`);

    // Create document from image URL - Ragie will process and extract content
    const document = await ragie.documents.createDocumentFromUrl({
      url: imageUrl,
      metadata
    });

    console.log(`✅ Ragie: Indexed image ${messageId}, doc ID: ${document.id}`);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      messageId
    });
  } catch (error) {
    console.error('❌ Ragie image sync error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
