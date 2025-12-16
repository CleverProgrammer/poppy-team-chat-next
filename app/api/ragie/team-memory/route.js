import { NextResponse } from 'next/server';
import ragie from '../../../lib/ragie-client.js';

// Add a message to team-wide AI memory (globally accessible)
// Supports both text messages and images
export async function POST(request) {
  try {
    const {
      messageId,
      text,
      imageUrl,
      sender,
      senderEmail,
      senderId,
      timestamp
    } = await request.json();

    // Must have messageId and either text or imageUrl
    if (!messageId || (!text && !imageUrl)) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, and either text or imageUrl' },
        { status: 400 }
      );
    }

    // Build metadata for GLOBAL team memory - no permission restrictions
    const metadata = {
      messageId,
      sender: sender || 'Unknown',
      senderEmail: senderEmail || '',
      senderId: senderId || '',
      timestamp: timestamp || new Date().toISOString(),
      chatType: 'team_memory',  // Special type that bypasses all permission filters
      chatId: 'team_memory',    // Global team memory
      isTeamMemory: true        // Flag for easy filtering
    };

    let document;

    if (imageUrl) {
      // Handle image - Ragie will extract/OCR content from the image
      metadata.contentType = 'image';
      metadata.accompanyingText = text || '';

      console.log(`🧠 Team Memory: Adding image from ${sender}`);

      document = await ragie.documents.createDocumentFromUrl({
        url: imageUrl,
        metadata
      });
    } else {
      // Handle text-only message
      console.log(`🧠 Team Memory: Adding "${text.substring(0, 50)}..." by ${sender}`);

      document = await ragie.documents.createRaw({
        data: `[Team Memory from ${sender}]: ${text}`,
        metadata
      });
    }

    console.log(`✅ Team Memory: Added successfully, doc ID: ${document.id}`);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      messageId,
      type: imageUrl ? 'image' : 'text'
    });
  } catch (error) {
    console.error('❌ Team Memory error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}