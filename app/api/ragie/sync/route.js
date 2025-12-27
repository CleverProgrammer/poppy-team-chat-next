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
      participants,
      // Recipient info for DMs
      recipientId,
      recipientName,
      recipientEmail,
      // AI-generated tags for better retrieval
      aiTags
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

    // Add recipient info for DMs (for search like "messages I sent to Athena")
    if (chatType === 'dm') {
      if (recipientId) metadata.recipientId = recipientId;
      if (recipientName) metadata.recipientName = recipientName;
      if (recipientEmail) metadata.recipientEmail = recipientEmail;
    }

    // Add AI-generated tags for better semantic retrieval
    if (aiTags) {
      metadata.message_type = aiTags.type || null;
      metadata.tags = aiTags.tags || [];
      metadata.canonical_tag = aiTags.canonical_tag || null;
      metadata.summary = aiTags.summary || null;
      metadata.priority = aiTags.priority || null;
      metadata.temperature = aiTags.temperature || null;
      // Additional fields that may be present
      if (aiTags.assignee) metadata.assignee = aiTags.assignee;
      if (aiTags.assigner) metadata.assigner = aiTags.assigner;
      if (aiTags.status) metadata.status = aiTags.status;
      if (aiTags.due_date) metadata.due_date = aiTags.due_date;
      if (aiTags.votes) metadata.votes = aiTags.votes;
      if (aiTags.voters) metadata.voters = aiTags.voters;
      if (aiTags.participants) metadata.tag_participants = aiTags.participants;
      if (aiTags.data) metadata.extracted_data = JSON.stringify(aiTags.data);
    }

    console.log(`📚 Ragie: Indexing message ${messageId} to ${chatType}:${chatId}${aiTags ? ` [${aiTags.type}]` : ''}`);

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