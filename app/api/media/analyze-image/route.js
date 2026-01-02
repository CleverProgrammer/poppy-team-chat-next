import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { trackClaudeUsage, calculateClaudeCost } from '../../../lib/ai-usage-tracker.js'

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
2. People, objects, locations, brands, logos, or notable items.
3. If it's a screenshot, what app/website is it from and what's happening?
4. If it's a chart/graph/data, what are the key takeaways?
5. Any context that would help a teammate understand what this is about.

Speak in plain, natural language. Keep the summary short and punchy - 3-5 sentences max. Format as plain text, not markdown.

At the end of your summary, always include a fun, casual one-line TLDR. Talk like a fucking HOMIE - like you're ON THE TEAM. 

**CRITICAL FOR TLDR:** Always mention the uploader by name when describing who shared the image. ${sender ? `The uploader is ${sender} - use their name!` : ''} Examples:
- "tldr: ${sender || 'Mohamed'} just shared his 1-year anniversary with Poppy, absolute legend 🔥"
- "tldr: ${sender || 'Rafeh'} cooking up a new landing page design, looks clean af"
- "tldr: ${sender || 'David'} dropped some screenshots of the rebrand progress"
- "tldr: Just a cute dog pic from ${sender || 'the team'}, nothing work-related here 🐕"

Be personal. Use the uploader's actual name. Talk like a team member, not a robot.

---

=== COMPLETE TEXT EXTRACTION (OCR) ===

After your summary and TLDR, you MUST include a complete text extraction section.

**Extract EVERY SINGLE character of text visible in the image.** This includes:
- ALL text messages, chat bubbles, or conversation text
- ALL UI labels, buttons, menus, headers, footers
- ALL usernames, timestamps, dates
- ALL numbers, prices, stats, metrics
- ALL captions, watermarks, logos with text
- ALL email content, subject lines, sender/recipient info
- ALL fine print, disclaimers, small text
- EVERYTHING. Miss nothing.

Format as:
---
[OCR - FULL TEXT EXTRACTION]
(paste every single piece of text you can see, preserving structure where possible)
---

If there are multiple text regions (like a chat screenshot), preserve the conversation structure:
[Person 1]: message text here
[Person 2]: their reply here

If it's an email, preserve the email structure:
From: ...
To: ...
Subject: ...
Body: ...

If it's a document or form, extract line by line.
If there's literally no text in the image, write: "[No text detected in image]"

DO NOT summarize or paraphrase the text. Extract it VERBATIM, character for character.`

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
    const { totalCost } = calculateClaudeCost(inputTokens, outputTokens)

    console.log(`✅ Claude Vision: Analyzed image(s) for ${messageId}`)
    console.log(`💰 Tokens: ${inputTokens} in / ${outputTokens} out = $${totalCost.toFixed(6)}`)

    // Track usage to Firestore
    trackClaudeUsage({
      type: 'image_analysis',
      model: 'claude-sonnet-4-5-20250929',
      inputTokens,
      outputTokens,
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
