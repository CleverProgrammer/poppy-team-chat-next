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
    // AI assistant: full access to everything user sent OR received + groups user is in + team memory
    // SIMPLIFIED FILTER: Ragie has issues with complex nested $or/$and, so we use simpler conditions
    permissionScope = 'FULL ACCESS (AI chat) - own messages + received DMs + all channels + all groups + team memory';
    filter = {
      $or: [
        { senderId: { $eq: userId } },      // Messages I sent (any chat type)
        { recipientId: { $eq: userId } },   // DMs sent TO me
        { chatType: { $eq: 'channel' } },   // All channel messages (public)
        { chatType: { $eq: 'group' } },     // All group messages (simplified - was breaking with $and)
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
  } else if (currentChat?.type === 'group') {
    // Group: this specific group + all channels + team memory
    // Similar to DMs - only group members can access group messages
    const groupId = currentChat.id;
    permissionScope = `GROUP SCOPE - this group (${groupId}) + all channels + team memory`;
    filter = {
      $or: [
        { chatId: { $eq: groupId } },       // This specific group's messages
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

  const results = (response.scoredChunks || []).map(chunk => {
    // Ragie stores metadata at both chunk level and document level
    // imageUrls is typically in document_metadata (document-level)
    const chunkMeta = chunk.metadata || {};
    const docMeta = chunk.document_metadata || chunk.documentMetadata || {};
    
    // Merge both metadata sources, with document metadata taking precedence for media fields
    const imageUrls = docMeta.imageUrls || chunkMeta.imageUrls || null;
    const contentType = docMeta.contentType || chunkMeta.contentType || 'text';
    const imageCount = docMeta.imageCount || chunkMeta.imageCount || 0;
    
    // Log if we found imageUrls to help debug
    if (imageUrls) {
      console.log(`🖼️ Found imageUrls in ${docMeta.imageUrls ? 'document_metadata' : 'chunk.metadata'}:`, imageUrls);
    }
    
    return {
      text: chunk.text,
      score: chunk.score,
      sender: docMeta.sender || chunkMeta.sender || 'Unknown',
      timestamp: docMeta.timestamp || chunkMeta.timestamp || '',
      chatId: docMeta.chatId || chunkMeta.chatId || '',
      // Media fields - check both metadata sources
      contentType,
      imageUrls,
      imageCount,
      messageId: docMeta.messageId || chunkMeta.messageId || '',
    };
  });

  // Log result status clearly
  if (results.length === 0) {
    console.log('📭 RESULT: No data found matching query within permission scope');
    console.log('   ℹ️  This is NOT a permission denial - user has access, but no matching content exists');
  } else {
    const imageResults = results.filter(r => r.contentType === 'image');
    console.log(`✅ RESULT: Found ${results.length} matching item(s)${imageResults.length > 0 ? ` (${imageResults.length} with images)` : ''}`);
    results.forEach((r, i) => {
      const mediaTag = r.contentType === 'image' ? ` 🖼️ ${r.imageCount} img` : '';
      console.log(`   ${i + 1}. [${r.sender}] score: ${r.score?.toFixed(3)} | chat: ${r.chatId}${mediaTag}`);
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
      console.log(`✅ FIRESTORE: Found exact match: ${exactDoc.id}`);
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
      console.log('📭 No matching topics found');
    } else {
      console.log(`✅ Found ${matches.length} matching topic(s):`);
      matches.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.name} - ${m.votes} votes from: ${m.voters.join(', ') || 'none'}`);
      });
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return matches;
  } catch (error) {
    console.error('❌ FIRESTORE ERROR: Failed to fetch topic votes:', error.message);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return [];
  }
}

/**
 * Add information to the Team AI Memory via Ragie
 * This allows Poppy to save important info when users ask "remember this"
 *
 * @param {Object} params - The memory to add
 * @param {string} params.content - The information to remember
 * @param {string} params.source - Who provided this information
 * @param {string} params.context - Optional context about why this is important
 * @param {string} params.addedBy - Who asked Poppy to remember this
 * @param {string} params.addedByEmail - Email of the person who asked
 * @param {string} params.addedById - User ID of the person who asked
 * @param {Array} params.imageUrls - Optional array of image URLs to include
 * @returns {Object} Result with success status and message
 */
export async function addToTeamMemory({ content, source, context, addedBy, addedByEmail, addedById, imageUrls }) {
  console.log('🧠 TEAM MEMORY ADD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧠 Content:', content?.substring(0, 100) + (content?.length > 100 ? '...' : ''));
  console.log('🧠 Source:', source);
  console.log('🧠 Added by:', addedBy);
  if (imageUrls?.length) console.log('🧠 Images:', imageUrls.length);

  // Basic content moderation - reject obviously inappropriate content
  const inappropriatePatterns = [
    /\b(porn|xxx|nude|naked|sex|fuck\s*me|dick|cock|pussy|ass\s*hole)\b/i,
    /\b(kill\s*(yourself|myself)|suicide|murder)\b/i,
  ];

  for (const pattern of inappropriatePatterns) {
    if (pattern.test(content)) {
      console.log('❌ MEMORY: Rejected - inappropriate content detected');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return {
        success: false,
        message: 'I can\'t save that to team memory. Let\'s keep it professional! 😊',
      };
    }
  }

  try {
    const timestamp = new Date().toISOString();
    const messageId = `memory_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Build metadata for global team memory
    const hasImages = imageUrls?.length > 0;
    const metadata = {
      messageId,
      sender: source || addedBy || 'Unknown',
      senderEmail: addedByEmail || '',
      senderId: addedById || '',
      timestamp,
      chatType: 'team_memory',  // Special type that bypasses all permission filters
      chatId: 'team_memory',    // Global team memory
      isTeamMemory: true,       // Flag for easy filtering
      addedViaAI: true,         // Flag to show this was added via Poppy
      addedBy: addedBy || 'Unknown',
      addedByEmail: addedByEmail || '',
      context: context || '',
      // Include image URLs if present
      ...(hasImages && { 
        contentType: 'image',
        imageUrls,
        imageCount: imageUrls.length,
      }),
    };

    // Build the content with clear formatting
    let textContent = `[Team Memory from ${source || addedBy}]`;
    if (context) {
      textContent += ` (Context: ${context})`;
    }
    if (hasImages) {
      textContent += ` [${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''} attached]`;
    }
    textContent += `: ${content}`;

    console.log('🧠 MEMORY: Indexing to Ragie...');

    const document = await ragie.documents.createRaw({
      data: textContent,
      metadata,
    });

    console.log(`✅ MEMORY: Added successfully, doc ID: ${document.id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return {
      success: true,
      message: `Got it! I've saved that to Team Memory. Everyone can now ask me about: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
      documentId: document.id,
    };
  } catch (error) {
    console.error('❌ MEMORY ERROR:', error.message);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return {
      success: false,
      message: 'Sorry, I couldn\'t save that to team memory. Please try again!',
      error: error.message,
    };
  }
}