import { NextResponse } from 'next/server'
import assemblyai from '../../../lib/assemblyai-client.js'
import { adminDb } from '../../../lib/firebase-admin.js'

/**
 * AssemblyAI Pricing (as of 2024):
 * - Best/Universal model: $0.00025/second (~$0.90/hour)
 * - Speaker diarization: included
 */
const COST_PER_SECOND = 0.00025

/**
 * Track AI usage to Firestore for analytics and cost monitoring
 */
async function trackAIUsage({
  type,
  model,
  audioDurationSeconds,
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
        audioDurationSeconds,
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
    const totalCost = audioDuration * COST_PER_SECOND

    console.log(`✅ AssemblyAI: Transcribed ${audioDuration}s audio in ${processingTime}s`)
    console.log(`💰 Cost: $${totalCost.toFixed(6)} (${audioDuration}s × $${COST_PER_SECOND}/s)`)

    // Track usage to Firestore
    trackAIUsage({
      type: 'audio_transcription',
      model: 'assemblyai-best',
      audioDurationSeconds: audioDuration,
      totalCost,
      userId: senderId,
      userEmail: senderEmail,
      userName: sender,
      messageId,
    })

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

    // Build response
    const response = {
      success: true,
      transcription: {
        text: transcript.text, // Plain text transcription
        formatted: formattedTranscript, // With speaker labels if available
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
        amount: totalCost,
        breakdown: `${audioDuration}s × $${COST_PER_SECOND}/s`,
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

