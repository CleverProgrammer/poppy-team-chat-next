import ragie from './ragie-client.js';

// Helper to generate DM ID (same as firestore.js)
function getDMId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

/**
 * Search Ragie for chat history with permission-based filtering
 * This is called by Claude as a tool when it needs historical context
 *
 * @param {string} userId - Current user's ID
 * @param {string} query - Search query
 * @param {Object} currentChat - Current chat { type, id }
 * @returns {Array} Matching results
 */
export async function searchChatHistory(userId, query, currentChat) {
  console.log('🔍 RAGIE SEARCH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Query:', query);
  console.log('🔍 User:', userId);
  console.log('🔍 Chat context:', currentChat?.type || 'none', currentChat?.id || '');

  // Build permission filter based on current chat context
  let filter;
  let permissionScope;

  if (currentChat?.type === 'ai') {
    // AI assistant: full access to everything user sent OR received
    permissionScope = 'FULL ACCESS (AI chat) - own messages + received DMs + all channels';
    filter = {
      $or: [
        { senderId: { $eq: userId } },      // Messages I sent
        { recipientId: { $eq: userId } },   // DMs sent TO me
        { chatType: { $eq: 'channel' } }    // All channel messages (public)
      ]
    };
  } else if (currentChat?.type === 'dm') {
    // DM: this specific DM + all channels
    const dmId = getDMId(userId, currentChat.id);
    permissionScope = `DM SCOPE - this DM (${dmId}) + all channels`;
    filter = {
      $or: [
        { chatId: { $eq: dmId } },          // This specific DM
        { chatType: { $eq: 'channel' } }    // All channel messages (public)
      ]
    };
  } else if (currentChat?.type === 'channel') {
    // Channel: all channels only (no DMs)
    permissionScope = 'CHANNEL SCOPE - all channels only (no DMs accessible)';
    filter = { chatType: { $eq: 'channel' } };
  } else {
    permissionScope = 'NO CONTEXT - search may be unrestricted';
  }

  console.log('🔐 Permission scope:', permissionScope);

  const response = await ragie.retrievals.retrieve({
    query,
    filter,
    topK: 8,
    rerank: true,
    recencyBias: true
  });

  const results = (response.scoredChunks || []).map(chunk => ({
    text: chunk.text,
    score: chunk.score,
    sender: chunk.metadata?.sender || 'Unknown',
    timestamp: chunk.metadata?.timestamp || '',
    chatId: chunk.metadata?.chatId || ''
  }));

  // Log result status clearly
  if (results.length === 0) {
    console.log('📭 RESULT: No data found matching query within permission scope');
    console.log('   ℹ️  This is NOT a permission denial - user has access, but no matching content exists');
  } else {
    console.log(`✅ RESULT: Found ${results.length} matching message(s)`);
    results.forEach((r, i) => {
      console.log(`   ${i + 1}. [${r.sender}] score: ${r.score?.toFixed(3)} | chat: ${r.chatId}`);
    });
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return results;
}