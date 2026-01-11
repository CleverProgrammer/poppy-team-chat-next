import { NextResponse } from 'next/server';
import ragie from '../../../lib/ragie-client.js';

/**
 * Sync a Loom video transcript to Ragie for RAG retrieval
 * This allows Poppy to remember and search Loom video content
 */
export async function POST(request) {
  try {
    const {
      loomUrl,
      videoId,
      videoName,
      duration,
      durationFormatted,
      transcript,
      wordCount,
      language,
      // Context about where/who shared this Loom
      messageId,
      chatId,
      chatType,
      sender,
      senderEmail,
      senderId,
      timestamp,
    } = await request.json();

    if (!loomUrl || !transcript) {
      return NextResponse.json(
        { error: 'Missing required fields: loomUrl, transcript' },
        { status: 400 }
      );
    }

    // Build metadata for permission-scoped retrieval
    const metadata = {
      type: 'loom_video',
      loomUrl,
      videoId: videoId || loomUrl.split('/share/')[1],
      videoName: videoName || 'Untitled Loom',
      duration: duration || 0,
      durationFormatted: durationFormatted || 'unknown',
      wordCount: wordCount || 0,
      language: language || 'en',
      // Context
      messageId: messageId || null,
      chatId: chatId || null,
      chatType: chatType || null,
      sender: sender || 'Unknown',
      senderEmail: senderEmail || '',
      senderId: senderId || '',
      timestamp: timestamp || new Date().toISOString(),
    };

    console.log(`📚 Ragie: Indexing Loom video "${videoName}" (${durationFormatted})`);

    // Create document in Ragie with the full transcript and metadata
    // Format: Include video title and who shared it for better search
    const documentContent = `[Loom Video shared by ${sender}]
Title: ${videoName}
Duration: ${durationFormatted}
URL: ${loomUrl}

Transcript:
${transcript}`;

    const document = await ragie.documents.createRaw({
      data: documentContent,
      metadata
    });

    console.log(`✅ Ragie: Indexed Loom video "${videoName}", doc ID: ${document.id}`);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      videoId: metadata.videoId,
      videoName,
    });
  } catch (error) {
    console.error('❌ Ragie Loom sync error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

