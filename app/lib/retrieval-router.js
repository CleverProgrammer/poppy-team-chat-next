import ragie from './ragie-client.js';

// Helper to generate DM ID (same as firestore.js)
function getDMId(uid1, uid2) {
  return `dm_${[uid1, uid2].sort().join('_')}`;
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
  // For now, search everything without filters to debug
  // TODO: Add permission filtering back once we verify retrieval works
  console.log('🔍 Ragie: Searching for:', query);
  console.log('🔍 Ragie: User:', userId, 'Chat:', currentChat);

  const response = await ragie.retrievals.retrieve({
    query,
    topK: 10
  });

  return (response.scoredChunks || []).map(chunk => ({
    text: chunk.text,
    score: chunk.score,
    sender: chunk.metadata?.sender || 'Unknown',
    timestamp: chunk.metadata?.timestamp || '',
    chatId: chunk.metadata?.chatId || ''
  }));
}