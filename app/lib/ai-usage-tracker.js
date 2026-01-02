import { adminDb } from './firebase-admin.js'

/**
 * AI Usage Tracker - Centralized cost tracking for all AI usage
 *
 * Tracks to Firestore collection: ai_usage
 *
 * Models in use:
 * - claude-sonnet-4-5-20250929 (Sonnet 4.5) - All AI operations
 *
 * Pricing (as of 2025):
 * - Claude Sonnet 4/4.5: $3/1M input tokens, $15/1M output tokens
 * - AssemblyAI: $0.00025/second (~$0.90/hour)
 */

// Fun readable ID components
const COLORS = ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'gold', 'cyan']
const ANIMALS = ['panda', 'tiger', 'wolf', 'eagle', 'shark', 'fox', 'hawk', 'bear']

/**
 * Generate a fun, readable document ID
 * Format: userName_color_animal_shortId (e.g., "rafeh_qazi_red_panda_abc12")
 */
function generateDocId(userName, prefix = '') {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  const shortId = Math.random().toString(36).substring(2, 7)
  const nameSlug = (userName || 'unknown')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  return prefix
    ? `${prefix}_${nameSlug}_${color}_${animal}_${shortId}`
    : `${nameSlug}_${color}_${animal}_${shortId}`
}

/**
 * Calculate cost for Claude token usage
 * Claude Sonnet 4 pricing: $3/1M input, $15/1M output
 */
export function calculateClaudeCost(inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1_000_000) * 3
  const outputCost = (outputTokens / 1_000_000) * 15
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  }
}

/**
 * Calculate cost for AssemblyAI audio transcription
 * AssemblyAI pricing: $0.00025/second (~$0.90/hour)
 */
export function calculateAssemblyAICost(durationSeconds) {
  const COST_PER_SECOND = 0.00025
  return durationSeconds * COST_PER_SECOND
}

/**
 * Track AI usage to Firestore for analytics and cost monitoring
 *
 * @param {Object} params - Usage parameters
 * @param {string} params.type - Type of AI usage (e.g., 'ai_chat', 'tagging', 'image_analysis', 'audio_transcription')
 * @param {string} params.model - Model used (e.g., 'claude-sonnet-4-5-20250929', 'assemblyai-best')
 * @param {number} [params.inputTokens] - Input tokens (for LLM calls)
 * @param {number} [params.outputTokens] - Output tokens (for LLM calls)
 * @param {number} [params.inputCost] - Input cost in dollars (auto-calculated if not provided)
 * @param {number} [params.outputCost] - Output cost in dollars (auto-calculated if not provided)
 * @param {number} params.totalCost - Total cost in dollars
 * @param {string} [params.userId] - Firebase UID of the user
 * @param {string} [params.userEmail] - User's email
 * @param {string} [params.userName] - User's display name
 * @param {string} [params.messageId] - Message ID (for message-related operations)
 * @param {string} [params.chatId] - Chat ID
 * @param {string} [params.chatType] - Chat type ('dm', 'channel', 'group', 'ai')
 * @param {Array} [params.toolsUsed] - Tools used during AI chat
 * @param {number} [params.audioDurationSeconds] - Audio duration (for transcription)
 * @param {string} [params.docIdPrefix] - Optional prefix for document ID (e.g., 'img', 'audio')
 * @param {Object} [params.breakdown] - Optional detailed cost breakdown
 */
export async function trackAIUsage({
  type,
  model,
  inputTokens = 0,
  outputTokens = 0,
  inputCost,
  outputCost,
  totalCost,
  userId,
  userEmail,
  userName,
  messageId,
  chatId,
  chatType,
  toolsUsed,
  audioDurationSeconds,
  docIdPrefix,
  breakdown,
}) {
  try {
    // Auto-calculate costs if not provided (for Claude-based calls)
    if (inputCost === undefined && inputTokens > 0) {
      inputCost = (inputTokens / 1_000_000) * 3
    }
    if (outputCost === undefined && outputTokens > 0) {
      outputCost = (outputTokens / 1_000_000) * 15
    }

    const docId = generateDocId(userName, docIdPrefix)

    const data = {
      timestamp: new Date().toISOString(),
      type,
      model,
      totalCost,
      userId: userId || null,
      userEmail: userEmail || null,
      userName: userName || null,
    }

    // Add token-based fields if present
    if (inputTokens > 0) data.inputTokens = inputTokens
    if (outputTokens > 0) data.outputTokens = outputTokens
    if (inputCost !== undefined) data.inputCost = inputCost
    if (outputCost !== undefined) data.outputCost = outputCost

    // Add optional fields if present
    if (messageId) data.messageId = messageId
    if (chatId) data.chatId = chatId
    if (chatType) data.chatType = chatType
    if (toolsUsed?.length > 0) data.toolsUsed = toolsUsed
    if (audioDurationSeconds) data.audioDurationSeconds = audioDurationSeconds
    if (breakdown) data.breakdown = breakdown

    await adminDb.collection('ai_usage').doc(docId).set(data)

    console.log(`📊 AI Usage Tracked: ${type} - $${totalCost.toFixed(6)} (${docId})`)

    return { success: true, docId, totalCost }
  } catch (error) {
    // Don't fail the request if tracking fails - just log it
    console.error('⚠️ Failed to track AI usage:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Track Claude LLM usage with auto-calculated costs
 * Convenience wrapper for Claude-specific tracking
 */
export async function trackClaudeUsage({
  type,
  model, // Required - pass the actual model used (e.g., 'claude-sonnet-4-5-20250929')
  inputTokens,
  outputTokens,
  userId,
  userEmail,
  userName,
  messageId,
  chatId,
  chatType,
  toolsUsed,
  docIdPrefix,
  breakdown,
}) {
  const { inputCost, outputCost, totalCost } = calculateClaudeCost(inputTokens, outputTokens)

  return trackAIUsage({
    type,
    model,
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost,
    userId,
    userEmail,
    userName,
    messageId,
    chatId,
    chatType,
    toolsUsed,
    docIdPrefix,
    breakdown,
  })
}

/**
 * Track AssemblyAI audio transcription usage
 * Convenience wrapper for audio transcription tracking
 */
export async function trackAudioTranscription({
  audioDurationSeconds,
  userId,
  userEmail,
  userName,
  messageId,
  // Optional: include TLDR Claude costs
  tldrInputTokens = 0,
  tldrOutputTokens = 0,
}) {
  const transcriptionCost = calculateAssemblyAICost(audioDurationSeconds)
  const {
    inputCost: tldrInputCost,
    outputCost: tldrOutputCost,
    totalCost: tldrCost,
  } = calculateClaudeCost(tldrInputTokens, tldrOutputTokens)

  const totalCost = transcriptionCost + tldrCost

  const breakdown = {
    transcription: {
      model: 'assemblyai-best',
      durationSeconds: audioDurationSeconds,
      cost: transcriptionCost,
    },
  }

  // Only add TLDR breakdown if tokens were used
  if (tldrInputTokens > 0 || tldrOutputTokens > 0) {
    breakdown.tldr = {
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: tldrInputTokens,
      outputTokens: tldrOutputTokens,
      inputCost: tldrInputCost,
      outputCost: tldrOutputCost,
      cost: tldrCost,
    }
  }

  return trackAIUsage({
    type: 'audio_transcription',
    model: 'assemblyai-best',
    audioDurationSeconds,
    totalCost,
    userId,
    userEmail,
    userName,
    messageId,
    docIdPrefix: 'audio',
    breakdown,
  })
}
