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

    const documents = [];

    // If there's an image, create an image document
    if (imageUrl) {
      const imageMetadata = {
        ...metadata,
        contentType: 'image',
        hasAccompanyingText: !!text
      };

      console.log(`🧠 Team Memory: Adding image from ${sender}`);

      const imageDoc = await ragie.documents.createDocumentFromUrl({
        url: imageUrl,
        metadata: imageMetadata
      });
      documents.push({ id: imageDoc.id, type: 'image' });
    }

    // If there's text, create a text document (even if there's also an image)
    if (text) {
      const textMetadata = {
        ...metadata,
        contentType: 'text',
        hasAccompanyingImage: !!imageUrl,
        imageUrl: imageUrl || null
      };

      const textContent = imageUrl
        ? `[Team Memory from ${sender}] (with image): ${text}`
        : `[Team Memory from ${sender}]: ${text}`;

      console.log(`🧠 Team Memory: Adding text "${text.substring(0, 50)}..." by ${sender}`);

      const textDoc = await ragie.documents.createRaw({
        data: textContent,
        metadata: textMetadata
      });
      documents.push({ id: textDoc.id, type: 'text' });
    }

    console.log(`✅ Team Memory: Added ${documents.length} document(s), IDs: ${documents.map(d => d.id).join(', ')}`);

    return NextResponse.json({
      success: true,
      documents,
      messageId,
      type: imageUrl && text ? 'image+text' : (imageUrl ? 'image' : 'text')
    });
  } catch (error) {
    console.error('❌ Team Memory error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}