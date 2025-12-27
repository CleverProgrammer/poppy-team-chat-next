import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import ragie from '../../../lib/ragie-client.js'
import { adminDb } from '../../../lib/firebase-admin.js'

/**
 * Track AI usage to Firestore for analytics and cost monitoring
 */
async function trackAIUsage({
  type,
  model,
  inputTokens,
  outputTokens,
  totalCost,
  userId,
  userEmail,
  userName,
  messageId,
}) {
  try {
    const colors = ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'gold', 'cyan']
    const animals = ['panda', 'tiger', 'wolf', 'eagle', 'shark', 'fox', 'hawk', 'bear']
    const color = colors[Math.floor(Math.random() * colors.length)]
    const animal = animals[Math.floor(Math.random() * animals.length)]
    const shortId = Math.random().toString(36).substring(2, 7)
    const nameSlug = (userName || 'unknown')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    const docId = `img_${nameSlug}_${color}_${animal}_${shortId}`

    await adminDb
      .collection('ai_usage')
      .doc(docId)
      .set({
        timestamp: new Date().toISOString(),
        type,
        model,
        inputTokens,
        outputTokens,
        inputCost: (inputTokens / 1_000_000) * 3,
        outputCost: (outputTokens / 1_000_000) * 15,
        totalCost,
        userId: userId || null,
        userEmail: userEmail || null,
        userName: userName || null,
        messageId: messageId || null,
      })
  } catch (error) {
    console.error('⚠️ Failed to track AI usage:', error.message)
  }
}

/**
 * Fetch image and convert to base64
 */
async function fetchImageAsBase64(imageUrl) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  // Map content type to Anthropic's expected media types
  let mediaType = 'image/jpeg'
  if (contentType.includes('png')) mediaType = 'image/png'
  else if (contentType.includes('gif')) mediaType = 'image/gif'
  else if (contentType.includes('webp')) mediaType = 'image/webp'

  return { base64, mediaType }
}

/**
 * Analyze image with Claude Vision
 */
async function analyzeImageWithClaude(imageUrl, accompanyingText = '', recentMessages = []) {
  const anthropic = new Anthropic({
    apiKey: process.env.KEYWORDS_AI_API_KEY,
    baseURL: 'https://api.keywordsai.co/api/anthropic/',
  })

  const { base64, mediaType } = await fetchImageAsBase64(imageUrl)

  // Build chat context from recent messages
  let chatContext = ''
  if (recentMessages && recentMessages.length > 0) {
    chatContext = `\n\n=== RECENT CHAT CONTEXT (last ${recentMessages.length} messages before this image) ===\n`
    recentMessages.forEach(msg => {
      if (msg.sender && msg.text) {
        chatContext += `[${msg.sender}]: ${msg.text}\n`
      }
    })
    chatContext += `=== END CONTEXT ===\n\nUse this context to better understand what the image might be about and who's involved in the conversation.`
  }

  const basePrompt = `You are an image analyzer for an internal team chat app. Your job is to give context about what this image is about so it can help the team understand and reference it later.

Key elements to focus on:
1. What is this image showing? Describe it in plain language.
2. Any text visible in the image - quote it exactly (OCR).
3. People, objects, locations, brands, logos, or notable items.
4. If it's a screenshot, what app/website is it from and what's happening?
5. If it's a chart/graph/data, what are the key takeaways?
6. Any context that would help a teammate understand what this is about.

Speak in plain, natural language. Keep it short and punchy - 3-5 sentences max. Format as plain text, not markdown.

At the end, always include a fun, casual one-line TLDR. Talk like a fucking HOMIE - like you're ON THE TEAM. Use people's actual names when you can see them in the image OR from the chat context! Don't say "someone" when you know who's talking. Examples:
- "tldr: Mohamed just hit his 1-year mark with Poppy, absolute legend 🔥"
- "tldr: Rafeh cooking up a new landing page design, looks clean af"
- "tldr: David and Naz going back and forth about the rebrand lol"
- "tldr: Just a cute dog pic, nothing work-related here 🐕"

Be personal. Use names. Talk like a team member, not a robot.${chatContext}`

  const analysisPrompt = accompanyingText
    ? `${basePrompt}

The person sharing this image said: "${accompanyingText}"

Use that context to help explain what this image is about and why they might be sharing it.`
    : basePrompt

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          { type: 'text', text: analysisPrompt },
        ],
      },
    ],
  })

  return {
    analysis: response.content[0]?.text || 'Unable to analyze image',
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  }
}

/**
 * Sync an image to Ragie for RAG retrieval
 * First analyzes with Claude Vision, then indexes the analysis to Ragie
 */
export async function POST(request) {
  try {
    const {
      messageId,
      chatId,
      chatType,
      imageUrl,
      sender,
      senderEmail,
      senderId,
      timestamp,
      participants,
      recipientId,
      recipientName,
      recipientEmail,
      text, // Optional accompanying text
      recentMessages, // Optional: last 10-20 messages for context
    } = await request.json()

    if (!messageId || !imageUrl || !chatId || !chatType) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, imageUrl, chatId, chatType' },
        { status: 400 }
      )
    }

    console.log(`🖼️ Processing image ${messageId} from ${imageUrl}`)

    // Step 1: Analyze image with Claude Vision
    console.log(`🔍 Claude Vision: Analyzing image...`)
    if (recentMessages?.length) {
      console.log(`📝 Context: Including ${recentMessages.length} recent messages`)
    }
    let imageAnalysis = ''
    let tokens = { input: 0, output: 0 }

    try {
      const result = await analyzeImageWithClaude(imageUrl, text, recentMessages || [])
      imageAnalysis = result.analysis
      tokens = { input: result.inputTokens, output: result.outputTokens }
      
      // Calculate cost (Sonnet 4.5: $3/1M input, $15/1M output)
      const inputCost = (tokens.input / 1_000_000) * 3
      const outputCost = (tokens.output / 1_000_000) * 15
      const totalCost = inputCost + outputCost
      
      console.log(`✅ Claude Vision: Got analysis (${imageAnalysis.length} chars)`)
      console.log(`💰 Tokens: ${tokens.input} in / ${tokens.output} out = $${totalCost.toFixed(6)}`)

      // Track AI usage to Firestore
      trackAIUsage({
        type: 'image_analysis',
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: tokens.input,
        outputTokens: tokens.output,
        totalCost,
        userId: senderId,
        userEmail: senderEmail,
        userName: sender,
        messageId,
      })
    } catch (error) {
      console.error(`⚠️ Claude Vision failed, falling back to URL-only:`, error.message)
      imageAnalysis = `[Image shared by ${sender}]${text ? ` with message: "${text}"` : ''}`
    }

    // Step 2: Build content for Ragie indexing
    // Combine sender context + analysis for better searchability
    const indexContent = `[${sender}] shared an image${text ? ` with message: "${text}"` : ''}

Image Analysis:
${imageAnalysis}`

    // Step 3: Build metadata for permission-scoped retrieval
    const metadata = {
      messageId,
      sender: sender || 'Unknown',
      senderEmail: senderEmail || '',
      senderId: senderId || '',
      timestamp: timestamp || new Date().toISOString(),
      chatType,
      chatId,
      contentType: 'image',
      imageUrl,
      accompanyingText: text || '',
      hasAnalysis: imageAnalysis.length > 50, // Flag if we got real analysis
    }

    // Add DM-specific metadata
    if (chatType === 'dm') {
      if (participants) metadata.participants = participants
      if (recipientId) metadata.recipientId = recipientId
      if (recipientName) metadata.recipientName = recipientName
      if (recipientEmail) metadata.recipientEmail = recipientEmail
    }

    // Step 4: Index to Ragie with the analysis as searchable content
    console.log(`📚 Ragie: Indexing image analysis for ${messageId}`)

    const document = await ragie.documents.createRaw({
      data: indexContent,
      metadata,
    })

    console.log(`✅ Ragie: Indexed image ${messageId}, doc ID: ${document.id}`)

    return NextResponse.json({
      success: true,
      documentId: document.id,
      messageId,
      analysis: imageAnalysis,
      tokens,
    })
  } catch (error) {
    console.error('❌ Image sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
