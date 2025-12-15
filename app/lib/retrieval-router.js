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
  console.log('🔍 Ragie: Searching for:', query);
  console.log('🔍 Ragie: User:', userId, 'Chat:', currentChat);

  // DEBUG: Log what currentChat.id actually is for DMs
  if (currentChat?.type === 'dm') {
    const dmId = getDMId(userId, currentChat.id);
    console.log('🔍 DEBUG DM:', {
      'currentChat.id (other user)': currentChat.id,
      'userId (me)': userId,
      'constructed dmId': dmId
    });
  }

  const response = await ragie.retrievals.retrieve({
    query,
    topK: 8,
    rerank: true,
    recencyBias: true
  });

  return (response.scoredChunks || []).map(chunk => ({
    text: chunk.text,
    score: chunk.score,
    sender: chunk.metadata?.sender || 'Unknown',
    timestamp: chunk.metadata?.timestamp || '',
    chatId: chunk.metadata?.chatId || ''
  }));
}