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
 * Analyze one or more images with Claude Vision
 * Supports batch analysis for multiple images in one request
 * @param {string|string[]} imageUrls - URL(s) of image(s) to analyze
 * @param {string} accompanyingText - Text sent with the image
 * @param {Array} recentMessages - Recent chat messages for context
 * @param {string} uploaderName - Name of the person who uploaded the image (required for attribution)
 */
async function analyzeImagesWithClaude(imageUrls, accompanyingText = '', recentMessages = [], uploaderName = '') {
  const anthropic = new Anthropic({
    apiKey: process.env.KEYWORDS_AI_API_KEY,
    baseURL: 'https://api.keywordsai.co/api/anthropic/',
  })

  // Normalize to array
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls]
  const imageCount = urls.length

  // Fetch all images as base64 in parallel
  const imageData = await Promise.all(urls.map(url => fetchImageAsBase64(url)))

  // Build chat context from recent messages
  let chatContext = ''
  if (recentMessages && recentMessages.length > 0) {
    chatContext = `\n\n=== RECENT CHAT CONTEXT (last ${recentMessages.length} messages before ${
      imageCount > 1 ? 'these images' : 'this image'
    }) ===\n`
    recentMessages.forEach(msg => {
      if (msg.sender && msg.text) {
        chatContext += `[${msg.sender}]: ${msg.text}\n`
      }
    })
    chatContext += `=== END CONTEXT ===\n\nUse this context to better understand what ${
      imageCount > 1 ? 'these images are' : 'the image is'
    } about and who's involved in the conversation.`
  }

  // Adjust prompt based on number of images
  const imagePhrase = imageCount > 1 ? `these ${imageCount} images` : 'this image'

  // CRITICAL: Explicitly state who uploaded the image to avoid misattribution
  const uploaderStatement = uploaderName 
    ? `**IMPORTANT: This image was uploaded by ${uploaderName}. When referring to who shared/uploaded this, ALWAYS use "${uploaderName}" - do NOT guess based on chat context or who was last typing.**

`
    : ''

  const basePrompt = `You are an image analyzer for an internal team chat app. Your job is to give context about what ${imagePhrase} ${
    imageCount > 1 ? 'are' : 'is'
  } about so it can help the team understand and reference ${imageCount > 1 ? 'them' : 'it'} later.

${uploaderStatement}${
  imageCount > 1
    ? `You're looking at ${imageCount} images shared together. Analyze them as a cohesive set - they might be related (before/after, sequence, comparison, etc).

`
    : ''
}Key elements to focus on:
1. What ${
    imageCount > 1 ? 'are these images' : 'is this image'
  } showing? Describe in plain language.
2. Any text visible - quote it exactly (OCR).
3. People, objects, locations, brands, logos, or notable items.
4. If ${
    imageCount > 1 ? "they're screenshots" : "it's a screenshot"
  }, what app/website and what's happening?
5. If ${
    imageCount > 1 ? "they're charts/graphs" : "it's a chart/graph"
  }, what are the key takeaways?
6. ${
    imageCount > 1
      ? 'How do these images relate to each other?'
      : 'Any context that would help a teammate understand this.'
  }

Speak in plain, natural language. Keep it short and punchy - ${
    imageCount > 1 ? '4-6' : '3-5'
  } sentences max. Format as plain text, not markdown.

At the end, always include a fun, casual one-line TLDR. Talk like a fucking HOMIE - like you're ON THE TEAM. 

**CRITICAL FOR TLDR:** Always mention the uploader by name when describing who shared the image. ${uploaderName ? `The uploader is ${uploaderName} - use their name!` : ''} Examples:
- "tldr: ${uploaderName || 'Mohamed'} just shared his 1-year anniversary with Poppy, absolute legend 🔥"
- "tldr: ${uploaderName || 'Rafeh'} cooking up a new landing page design, looks clean af"
- "tldr: ${uploaderName || 'David'} dropped some screenshots of the rebrand progress"
- "tldr: ${uploaderName || 'Someone'} shared before/after of the homepage - night and day difference 🔥"
- "tldr: Just a cute dog pic from ${uploaderName || 'the team'}, nothing work-related here 🐕"

Be personal. Use the uploader's actual name. Talk like a team member, not a robot.${chatContext}`

  const analysisPrompt = accompanyingText
    ? `${basePrompt}

The person sharing ${imagePhrase} said: "${accompanyingText}"

Use that context to help explain what ${imagePhrase} ${
        imageCount > 1 ? 'are' : 'is'
      } about and why they might be sharing ${imageCount > 1 ? 'them' : 'it'}.`
    : basePrompt

  // Build content array with all images + the prompt
  const content = [
    ...imageData.map(({ base64, mediaType }) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    })),
    { type: 'text', text: analysisPrompt },
  ]

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  })

  return {
    analysis: response.content[0]?.text || 'Unable to analyze image',
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    imageCount,
  }
}

/**
 * Sync image(s) to Ragie for RAG retrieval
 * First analyzes with Claude Vision, then indexes the analysis to Ragie
 * Supports single image (imageUrl) or multiple images (imageUrls)
 */
export async function POST(request) {
  try {
    const {
      messageId,
      chatId,
      chatType,
      imageUrl, // Single image (backwards compatibility)
      imageUrls, // Multiple images (new)
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

    // Support both single imageUrl and array imageUrls
    const urls = imageUrls?.length > 0 ? imageUrls : imageUrl ? [imageUrl] : []

    if (!messageId || urls.length === 0 || !chatId || !chatType) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, imageUrl/imageUrls, chatId, chatType' },
        { status: 400 }
      )
    }

    const imageCount = urls.length
    console.log(
      `🖼️ Processing ${imageCount} image${imageCount > 1 ? 's' : ''} for message ${messageId}`
    )

    // Step 1: Analyze image(s) with Claude Vision
    console.log(`🔍 Claude Vision: Analyzing ${imageCount} image${imageCount > 1 ? 's' : ''}...`)
    if (recentMessages?.length) {
      console.log(`📝 Context: Including ${recentMessages.length} recent messages`)
    }
    let imageAnalysis = ''
    let tokens = { input: 0, output: 0 }

    try {
      const result = await analyzeImagesWithClaude(urls, text, recentMessages || [], sender)
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
        type: imageCount > 1 ? 'multi_image_analysis' : 'image_analysis',
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
      imageAnalysis = `[${imageCount} image${imageCount > 1 ? 's' : ''} shared by ${sender}]${
        text ? ` with message: "${text}"` : ''
      }`
    }

    // Step 2: Build content for Ragie indexing
    // Combine sender context + analysis for better searchability
    const indexContent = `[${sender}] shared ${imageCount} image${imageCount > 1 ? 's' : ''}${
      text ? ` with message: "${text}"` : ''
    }

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
      imageUrls: urls,
      imageCount,
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

    console.log(
      `✅ Ragie: Indexed ${imageCount} image${
        imageCount > 1 ? 's' : ''
      } for ${messageId}, doc ID: ${document.id}`
    )

    return NextResponse.json({
      success: true,
      documentId: document.id,
      messageId,
      analysis: imageAnalysis,
      tokens,
      imageCount,
    })
  } catch (error) {
    console.error('❌ Image sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
