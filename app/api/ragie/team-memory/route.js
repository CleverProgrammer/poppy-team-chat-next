import { NextResponse } from 'next/server';
import ragie from '../../../lib/ragie-client.js';

// Add a message to team-wide AI memory (globally accessible)
export async function POST(request) {
  try {
    const {
      messageId,
      text,
      sender,
      senderEmail,
      senderId,
      timestamp
    } = await request.json();

    if (!messageId || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, text' },
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

    console.log(`🧠 Team Memory: Adding "${text.substring(0, 50)}..." by ${sender}`);

    // Create document in Ragie with team memory metadata
    const document = await ragie.documents.createRaw({
      data: `[Team Memory from ${sender}]: ${text}`,
      metadata
    });

    console.log(`✅ Team Memory: Added successfully, doc ID: ${document.id}`);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      messageId
    });
  } catch (error) {
    console.error('❌ Team Memory error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}