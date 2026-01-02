import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import assemblyai from '../../../lib/assemblyai-client.js'
import { trackAudioTranscription, calculateClaudeCost } from '../../../lib/ai-usage-tracker.js'

/**
 * AssemblyAI Pricing (as of 2025):
 * - Best/Universal model: $0.00025/second (~$0.90/hour)
 * - Speaker diarization: included
 */
const COST_PER_SECOND = 0.00025

/**
 * Generate a short TLDR from transcription using Claude
 */
async function generateTLDR(transcriptionText, sender) {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.KEYWORDS_AI_API_KEY,
      baseURL: 'https://api.keywordsai.co/api/anthropic/',
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `You are summarizing a voice message from ${sender} in a team chat app.

Voice message content:
"${transcriptionText}"

Write a casual, punchy 1-line TLDR (max 80 chars). Talk like a team member, not a robot. Use the person's name if relevant. No quotes around the response.

Examples:
- "asking about the design review deadline"
- "quick update on the API integration"
- "wants feedback on the new landing page"
- "checking in about tomorrow's standup"`,
        },
      ],
    })

    const tldr = response.content[0]?.text?.trim() || null

    // Return TLDR and token usage for cost tracking
    return {
      tldr,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    }
  } catch (error) {
    console.error('⚠️ Failed to generate TLDR:', error.message)
    return { tldr: null, inputTokens: 0, outputTokens: 0 }
  }
}

/**
 * Transcribe audio using AssemblyAI's Universal (Best) model
 *
 * Features:
 * - 93.3% Word Accuracy Rate (highest in industry)
 * - Speaker diarization (who said what)
 * - Automatic punctuation & casing
 * - Works with noisy audio
 *
 * @param {Object} request - The incoming request
 * @returns {Object} Transcription result with text, speakers, and summary
 */
export async function POST(request) {
  try {
    const {
      audioUrl,
      messageId,
      sender,
      senderEmail,
      senderId,
      enableSpeakerDiarization = true, // Identify different speakers
      generateSummary = false, // Generate a summary for longer audio
    } = await request.json()

    if (!audioUrl) {
      return NextResponse.json({ error: 'Missing required field: audioUrl' }, { status: 400 })
    }

    console.log(`🎙️ AssemblyAI: Transcribing audio for message ${messageId}`)
    console.log(`   URL: ${audioUrl}`)

    // Configure transcription options
    const config = {
      audio_url: audioUrl,
      speech_model: 'best', // Highest accuracy model (93.3% WAR)
      speaker_labels: enableSpeakerDiarization, // Identify speakers
      auto_highlights: false, // We don't need key phrases for now
      punctuate: true,
      format_text: true,
    }

    // Add summarization for longer audio (costs extra but useful for meetings)
    if (generateSummary) {
      config.summarization = true
      config.summary_model = 'informative' // Options: informative, conversational, catchy
      config.summary_type = 'bullets' // Options: bullets, gist, headline, paragraph
    }

    // Submit transcription request and wait for completion
    const startTime = Date.now()
    const transcript = await assemblyai.transcripts.transcribe(config)

    if (transcript.status === 'error') {
      console.error('❌ AssemblyAI error:', transcript.error)
      return NextResponse.json({ error: transcript.error }, { status: 500 })
    }

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1)
    const audioDuration = transcript.audio_duration || 0
    const transcriptionCost = audioDuration * COST_PER_SECOND

    console.log(`✅ AssemblyAI: Transcribed ${audioDuration}s audio in ${processingTime}s`)
    console.log(`💰 Transcription Cost: $${transcriptionCost.toFixed(6)} (${audioDuration}s × $${COST_PER_SECOND}/s)`)

    // Format speaker-labeled transcription if available
    let formattedTranscript = transcript.text
    let speakerSegments = []

    if (enableSpeakerDiarization && transcript.utterances?.length > 0) {
      speakerSegments = transcript.utterances.map(u => ({
        speaker: u.speaker, // 'A', 'B', 'C', etc.
        text: u.text,
        start: u.start, // milliseconds
        end: u.end,
        confidence: u.confidence,
      }))

      // Create a readable speaker-labeled version
      formattedTranscript = transcript.utterances
        .map(u => `Speaker ${u.speaker}: ${u.text}`)
        .join('\n')
    }

    // Generate AI TLDR from transcription
    let tldr = null
    let tldrInputTokens = 0
    let tldrOutputTokens = 0
    let tldrCost = 0
    if (transcript.text && transcript.text.length > 0) {
      const tldrResult = await generateTLDR(transcript.text, sender)
      tldr = tldrResult.tldr
      tldrInputTokens = tldrResult.inputTokens
      tldrOutputTokens = tldrResult.outputTokens
      // Calculate TLDR cost (Claude Sonnet 4.5: $3/1M input, $15/1M output)
      const { totalCost: tldrTotalCost } = calculateClaudeCost(tldrInputTokens, tldrOutputTokens)
      tldrCost = tldrTotalCost
      console.log(`✨ TLDR generated: "${tldr}" (cost: $${tldrCost.toFixed(6)})`)
    }

    const finalCost = transcriptionCost + tldrCost
    console.log(`💵 Total Cost: $${finalCost.toFixed(6)} (transcription + TLDR)`)

    // Track COMPLETE usage to Firestore (transcription + TLDR cost together!)
    trackAudioTranscription({
      audioDurationSeconds: audioDuration,
      userId: senderId,
      userEmail: senderEmail,
      userName: sender,
      messageId,
      tldrInputTokens,
      tldrOutputTokens,
    })

    // Build response
    const response = {
      success: true,
      transcription: {
        text: transcript.text, // Plain text transcription
        formatted: formattedTranscript, // With speaker labels if available
        tldr, // AI-generated short summary
        speakerCount: transcript.utterances
          ? new Set(transcript.utterances.map(u => u.speaker)).size
          : 1,
        speakerSegments, // Detailed speaker segments with timestamps
        confidence: transcript.confidence,
        words: transcript.words?.length || 0,
      },
      audio: {
        durationSeconds: audioDuration,
        durationFormatted: formatDuration(audioDuration),
      },
      cost: {
        amount: finalCost,
        transcriptionCost,
        tldrCost,
        breakdown: `${audioDuration}s × $${COST_PER_SECOND}/s + TLDR`,
      },
      processingTimeSeconds: parseFloat(processingTime),
    }

    // Add summary if requested
    if (generateSummary && transcript.summary) {
      response.summary = transcript.summary
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ AssemblyAI transcription error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Format seconds into human-readable duration
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }
}

