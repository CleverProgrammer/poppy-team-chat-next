import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
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
    const docId = `${nameSlug}_${color}_${animal}_${shortId}`

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
 * Analyze an image using Claude Vision
 * Returns a detailed description, any text/OCR, and key elements
 */
export async function POST(request) {
  try {
    const {
      imageUrl,
      imageUrls, // Support multiple images
      messageId,
      sender,
      senderEmail,
      senderId,
      accompanyingText, // Text sent with the image
    } = await request.json()

    // Normalize to array
    const allImageUrls = imageUrls || (imageUrl ? [imageUrl] : [])

    if (allImageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: imageUrl or imageUrls' },
        { status: 400 }
      )
    }

    console.log(
      `🖼️ Claude Vision: Analyzing ${allImageUrls.length} image(s) for message ${messageId}`
    )

    // Initialize Anthropic client via Keywords AI gateway
    const anthropic = new Anthropic({
      apiKey: process.env.KEYWORDS_AI_API_KEY,
      baseURL: 'https://api.keywordsai.co/api/anthropic/',
    })

    // Fetch all images and convert to base64
    const imageContents = await Promise.all(
      allImageUrls.map(async url => {
        try {
          const { base64, mediaType } = await fetchImageAsBase64(url)
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          }
        } catch (error) {
          console.error(`Failed to fetch image ${url}:`, error)
          return null
        }
      })
    )

    // Filter out failed fetches
    const validImages = imageContents.filter(Boolean)

    if (validImages.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch any images' }, { status: 400 })
    }

    // Build the prompt with explicit uploader attribution
    const uploaderStatement = sender 
      ? `**IMPORTANT: This image was uploaded by ${sender}. When referring to who shared/uploaded this, ALWAYS use "${sender}" - do NOT guess based on other context.**

`
      : ''

    const basePrompt = `You are an image analyzer for an internal team chat app. Your job is to give context about what this image is about so it can help the team understand and reference it later.

${uploaderStatement}Key elements to focus on:
1. What is this image showing? Describe it in plain language.
2. Any text visible in the image - quote it exactly (OCR).
3. People, objects, locations, brands, logos, or notable items.
4. If it's a screenshot, what app/website is it from and what's happening?
5. If it's a chart/graph/data, what are the key takeaways?
6. Any context that would help a teammate understand what this is about.

Speak in plain, natural language. Keep it short and punchy - 3-5 sentences max. Format as plain text, not markdown.

At the end, always include a fun, casual one-line TLDR. Talk like a fucking HOMIE - like you're ON THE TEAM. 

**CRITICAL FOR TLDR:** Always mention the uploader by name when describing who shared the image. ${sender ? `The uploader is ${sender} - use their name!` : ''} Examples:
- "tldr: ${sender || 'Mohamed'} just shared his 1-year anniversary with Poppy, absolute legend 🔥"
- "tldr: ${sender || 'Rafeh'} cooking up a new landing page design, looks clean af"
- "tldr: ${sender || 'David'} dropped some screenshots of the rebrand progress"
- "tldr: Just a cute dog pic from ${sender || 'the team'}, nothing work-related here 🐕"

Be personal. Use the uploader's actual name. Talk like a team member, not a robot.`

    const analysisPrompt = accompanyingText
      ? `${basePrompt}

${sender || 'The person'} shared this image and said: "${accompanyingText}"

Use that context to help explain what this image is about and why ${sender || 'they'} might be sharing it.`
      : basePrompt

    // Call Claude Vision
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [...validImages, { type: 'text', text: analysisPrompt }],
        },
      ],
    })

    const analysis = response.content[0]?.text || 'Unable to analyze image'

    // Get token usage and calculate cost (Sonnet 4.5: $3/1M input, $15/1M output)
    const inputTokens = response.usage?.input_tokens || 0
    const outputTokens = response.usage?.output_tokens || 0
    const inputCost = (inputTokens / 1_000_000) * 3
    const outputCost = (outputTokens / 1_000_000) * 15
    const totalCost = inputCost + outputCost

    console.log(`✅ Claude Vision: Analyzed image(s) for ${messageId}`)
    console.log(`💰 Tokens: ${inputTokens} in / ${outputTokens} out = $${totalCost.toFixed(6)}`)

    // Track usage to our Firestore
    trackAIUsage({
      type: 'image_analysis',
      model: 'claude-sonnet-4-5-20250929',
      inputTokens,
      outputTokens,
      totalCost,
      userId: senderId,
      userEmail: senderEmail,
      userName: sender,
      messageId,
    })

    return NextResponse.json({
      success: true,
      analysis,
      imageCount: validImages.length,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        cost: totalCost,
      },
    })
  } catch (error) {
    console.error('❌ Claude Vision error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
