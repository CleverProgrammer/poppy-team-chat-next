import { NextResponse } from 'next/server'
import { adminDb } from '../../../lib/firebase-admin.js'

/**
 * GET /api/ai-usage/lifetime
 * 
 * Returns the lifetime AI cost for a specific chat.
 * Queries the ai_usage collection and sums all costs.
 * 
 * Query params:
 * - chatId: The chat ID to get costs for
 * - chatType: The chat type ('channel', 'dm', 'group', 'ai')
 */
export async function GET(request) {
  try {
    const startTime = Date.now()
    const { searchParams } = new URL(request.url)
    const chatId = searchParams.get('chatId')
    const chatType = searchParams.get('chatType')

    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
    }

    // Query ai_usage collection for this chat
    const snapshot = await adminDb
      .collection('ai_usage')
      .where('chatId', '==', chatId)
      .get()
    
    console.log(`⏱️ AI Usage query took ${Date.now() - startTime}ms for chatId: ${chatId} (${snapshot.size} docs)`)

    let totalCost = 0
    let totalRecords = 0
    const breakdown = {
      ai_chat: 0,
      tagging: 0,
      image_analysis: 0,
      audio_transcription: 0,
      other: 0,
    }

    snapshot.forEach(doc => {
      const data = doc.data()
      const cost = data.totalCost || 0
      totalCost += cost
      totalRecords++

      // Track by type for breakdown
      const type = data.type || 'other'
      if (breakdown[type] !== undefined) {
        breakdown[type] += cost
      } else {
        breakdown.other += cost
      }
    })

    return NextResponse.json({
      chatId,
      chatType,
      totalCost,
      totalRecords,
      breakdown,
    })
  } catch (error) {
    console.error('Error fetching lifetime AI usage:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI usage data' },
      { status: 500 }
    )
  }
}

