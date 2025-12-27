import ragie from './ragie-client.js';
import { adminDb } from './firebase-admin.js';

// Helper to generate DM ID (same as firestore.js)
function getDMId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

/**
 * Search Ragie for chat history with permission-based filtering and optional date range
 * This is called by Claude as a tool when it needs historical context
 *
 * @param {string} userId - Current user's ID
 * @param {string} query - Search query
 * @param {Object} currentChat - Current chat { type, id }
 * @param {string} startDate - Optional ISO date string for start of time range
 * @param {string} endDate - Optional ISO date string for end of time range
 * @returns {Array} Matching results
 */
export async function searchChatHistory(userId, query, currentChat, startDate = null, endDate = null) {
  console.log('🔍 RAGIE SEARCH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Query:', query);
  console.log('🔍 User:', userId);
  console.log('🔍 Chat context:', currentChat?.type || 'none', currentChat?.id || '');
  if (startDate || endDate) {
    console.log('🔍 Date filter:', startDate || 'any', 'to', endDate || 'any');
  }

  // Build permission filter based on current chat context
  let filter;
  let permissionScope;

  // Team memory is ALWAYS included in every search (globally accessible)
  const teamMemoryFilter = { chatType: { $eq: 'team_memory' } };

  if (currentChat?.type === 'ai') {
    // AI assistant: full access to everything user sent OR received + team memory
    permissionScope = 'FULL ACCESS (AI chat) - own messages + received DMs + all channels + team memory';
    filter = {
      $or: [
        { senderId: { $eq: userId } },      // Messages I sent
        { recipientId: { $eq: userId } },   // DMs sent TO me
        { chatType: { $eq: 'channel' } },   // All channel messages (public)
        teamMemoryFilter                     // Team AI Memory (always accessible)
      ]
    };
  } else if (currentChat?.type === 'dm') {
    // DM: this specific DM + all channels + team memory
    const dmId = getDMId(userId, currentChat.id);
    permissionScope = `DM SCOPE - this DM (${dmId}) + all channels + team memory`;
    filter = {
      $or: [
        { chatId: { $eq: dmId } },          // This specific DM
        { chatType: { $eq: 'channel' } },   // All channel messages (public)
        teamMemoryFilter                     // Team AI Memory (always accessible)
      ]
    };
  } else if (currentChat?.type === 'channel') {
    // Channel: all channels + team memory (no DMs)
    permissionScope = 'CHANNEL SCOPE - all channels + team memory (no DMs accessible)';
    filter = {
      $or: [
        { chatType: { $eq: 'channel' } },   // All channel messages
        teamMemoryFilter                     // Team AI Memory (always accessible)
      ]
    };
  } else {
    // No context - still include team memory
    permissionScope = 'NO CONTEXT - team memory only';
    filter = teamMemoryFilter;
  }

  console.log('🔐 Permission scope:', permissionScope);

  // Add date filtering if provided
  // Ragie stores timestamps as ISO strings in metadata, so we filter using string comparison
  if (startDate || endDate) {
    const dateConditions = [];
    
    if (startDate) {
      dateConditions.push({ timestamp: { $gte: startDate } });
    }
    if (endDate) {
      dateConditions.push({ timestamp: { $lte: endDate } });
    }
    
    // Combine date filters with existing permission filter using $and
    filter = {
      $and: [
        filter,
        ...dateConditions
      ]
    };
    
    console.log('🔍 Date-filtered query:', JSON.stringify(filter, null, 2));
  }

  const response = await ragie.retrievals.retrieve({
    query,
    filter,
    topK: 50, // High topK for comprehensive results
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

/**
 * Get vote counts and details for any topic/idea from canonical_tags
 * This allows Poppy to answer "how many people want X?" or "who agrees with Y?" questions
 *
 * @param {string} query - Search term (e.g., "dark_mode", "big_bear_trip", "new_pricing")
 * @returns {Array} Matching canonical tags with vote counts
 */
export async function getTopicVotes(query) {
  console.log('🗳️  VOTE LOOKUP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗳️  Query:', query);

  try {
    // First, try exact match
    const exactDoc = await adminDb.collection('canonical_tags').doc(query.toLowerCase().replace(/\s+/g, '_')).get();
    
    if (exactDoc.exists) {
      const data = exactDoc.data();
      console.log(`✅ Found exact match: ${exactDoc.id}`);
      console.log(`   Type: ${data.type}, Votes: ${data.votes || 0}, Voters: ${data.voters?.join(', ') || 'none'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return [{
        id: exactDoc.id,
        name: data.name,
        type: data.type,
        summary: data.summary,
        votes: data.votes || 0,
        voters: data.voters || [],
        count: data.count || 0,
        lastSeen: data.lastSeen
      }];
    }

    // If no exact match, search for partial matches
    const snapshot = await adminDb.collection('canonical_tags').get();
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    const matches = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const name = (data.name || doc.id).toLowerCase();
      const summary = (data.summary || '').toLowerCase();
      
      // Check if any search term matches the name or summary
      const isMatch = searchTerms.some(term => 
        name.includes(term) || summary.includes(term)
      );
      
      if (isMatch) {
        matches.push({
          id: doc.id,
          name: data.name || doc.id,
          type: data.type,
          summary: data.summary,
          votes: data.votes || 0,
          voters: data.voters || [],
          count: data.count || 0,
          lastSeen: data.lastSeen
        });
      }
    });

    // Sort by votes (descending)
    matches.sort((a, b) => (b.votes || 0) - (a.votes || 0));

    if (matches.length === 0) {
      console.log('📭 No matching features found');
    } else {
      console.log(`✅ Found ${matches.length} matching feature(s):`);
      matches.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.name} - ${m.votes} votes from: ${m.voters.join(', ') || 'none'}`);
      });
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return matches;
  } catch (error) {
    console.error('❌ Error fetching feature votes:', error.message);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return [];
  }
}