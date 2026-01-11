import { NextResponse } from 'next/server'

/**
 * Extract Loom video transcript from a shared Loom URL
 * 
 * Loom embeds all video data in __APOLLO_STATE__ in the page HTML,
 * including signed URLs to the transcript JSON. We parse this to
 * get the transcript without needing to download any video.
 */

/**
 * Validate that a URL is a valid Loom share URL
 */
function isValidLoomUrl(url) {
  if (!url || typeof url !== 'string') return false
  
  try {
    const parsed = new URL(url.trim())
    return (
      (parsed.hostname === 'www.loom.com' || parsed.hostname === 'loom.com') &&
      parsed.pathname.startsWith('/share/')
    )
  } catch {
    return false
  }
}

/**
 * Extract video ID from Loom URL
 * Example: https://www.loom.com/share/b523b8563c3e4532a39b5b216ad48a4e
 * Returns: b523b8563c3e4532a39b5b216ad48a4e
 */
function extractVideoId(loomUrl) {
  const match = loomUrl.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}

/**
 * Parse the __APOLLO_STATE__ JSON from Loom's HTML
 */
function parseApolloState(html) {
  // Loom embeds Apollo state as: window.__APOLLO_STATE__ = {...};
  const match = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|window\.|$)/)
  
  if (!match) {
    // Try alternative pattern
    const altMatch = html.match(/"__APOLLO_STATE__"\s*:\s*(\{[\s\S]*?\})\s*,?\s*"/)
    if (altMatch) {
      return JSON.parse(altMatch[1])
    }
    return null
  }
  
  try {
    return JSON.parse(match[1])
  } catch (error) {
    console.error('Failed to parse Apollo state:', error)
    return null
  }
}

/**
 * Extract video metadata and transcript URL from Apollo state
 */
function extractVideoData(apolloState, videoId) {
  if (!apolloState) return null
  
  // Find the video entry
  const videoKey = Object.keys(apolloState).find(
    key => key.startsWith('RegularUserVideo:') && key.includes(videoId)
  )
  
  // Find the transcript entry
  const transcriptKey = Object.keys(apolloState).find(
    key => key.startsWith('VideoTranscriptDetails:')
  )
  
  const videoData = videoKey ? apolloState[videoKey] : null
  const transcriptData = transcriptKey ? apolloState[transcriptKey] : null
  
  return {
    video: videoData ? {
      id: videoData.id || videoId,
      name: videoData.name || 'Untitled',
      description: videoData.description,
      createdAt: videoData.createdAt,
      duration: videoData.video_properties?.duration || videoData.playable_duration,
      durationMs: videoData.video_properties?.durationMs,
      ownerId: videoData.owner_id,
      thumbnailUrl: videoData.signedThumbnails?.default 
        ? `https://cdn.loom.com/${videoData.signedThumbnails.default}`
        : null,
    } : null,
    transcript: transcriptData ? {
      id: transcriptData.idv2,
      status: transcriptData.transcription_status,
      language: transcriptData.language,
      sourceUrl: transcriptData.source_url,  // Signed URL to transcript JSON
      captionsUrl: transcriptData.captions_source_url,  // Signed URL to VTT captions
    } : null,
  }
}

/**
 * Fetch and parse the actual transcript content
 */
async function fetchTranscript(transcriptUrl) {
  try {
    const response = await fetch(transcriptUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching transcript:', error)
    return null
  }
}

/**
 * Format transcript into readable text
 */
function formatTranscript(transcriptData) {
  if (!transcriptData) return null
  
  // Loom's primary format: { phrases: [{ ts, value, ranges }] }
  if (transcriptData.phrases && Array.isArray(transcriptData.phrases)) {
    return transcriptData.phrases
      .map(phrase => phrase.value || '')
      .filter(Boolean)
      .join(' ')
  }
  
  // Transcript JSON structure varies, handle common formats
  if (Array.isArray(transcriptData)) {
    // Array of segments with text
    return transcriptData
      .map(segment => segment.text || segment.value || '')
      .filter(Boolean)
      .join(' ')
  }
  
  if (transcriptData.transcript) {
    // Nested transcript object
    return formatTranscript(transcriptData.transcript)
  }
  
  if (transcriptData.words) {
    // Words array format
    return transcriptData.words
      .map(word => word.text || word.word || '')
      .filter(Boolean)
      .join(' ')
  }
  
  if (transcriptData.segments) {
    // Segments format
    return transcriptData.segments
      .map(seg => seg.text || '')
      .filter(Boolean)
      .join(' ')
  }
  
  if (typeof transcriptData === 'string') {
    return transcriptData
  }
  
  // Return raw if we can't parse it
  return JSON.stringify(transcriptData)
}

/**
 * POST /api/loom/transcript
 * 
 * Extract transcript from a Loom video URL
 */
export async function POST(request) {
  try {
    const { loomUrl } = await request.json()
    
    // Validate URL
    if (!isValidLoomUrl(loomUrl)) {
      return NextResponse.json(
        { error: 'Invalid Loom URL. Expected format: https://www.loom.com/share/VIDEO_ID' },
        { status: 400 }
      )
    }
    
    const videoId = extractVideoId(loomUrl)
    console.log(`🎬 Extracting Loom transcript for video: ${videoId}`)
    
    // Fetch the Loom page HTML
    const pageResponse = await fetch(loomUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    })
    
    if (!pageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch Loom page: ${pageResponse.status}` },
        { status: 502 }
      )
    }
    
    const html = await pageResponse.text()
    
    // Parse Apollo state from HTML
    const apolloState = parseApolloState(html)
    
    if (!apolloState) {
      return NextResponse.json(
        { error: 'Could not parse Loom page data. The page structure may have changed.' },
        { status: 500 }
      )
    }
    
    // Extract video and transcript data
    const { video, transcript } = extractVideoData(apolloState, videoId)
    
    if (!video) {
      return NextResponse.json(
        { error: 'Could not find video data in page' },
        { status: 404 }
      )
    }
    
    if (!transcript || !transcript.sourceUrl) {
      return NextResponse.json(
        { 
          error: 'Transcript not available for this video',
          video,
          transcriptStatus: transcript?.status || 'not_found'
        },
        { status: 404 }
      )
    }
    
    // Check if transcript is ready
    if (transcript.status !== 'success') {
      return NextResponse.json(
        { 
          error: `Transcript is not ready yet. Status: ${transcript.status}`,
          video,
          transcriptStatus: transcript.status
        },
        { status: 202 }  // Accepted but not ready
      )
    }
    
    // Fetch the actual transcript content
    const transcriptContent = await fetchTranscript(transcript.sourceUrl)
    
    if (!transcriptContent) {
      return NextResponse.json(
        { error: 'Failed to fetch transcript content' },
        { status: 500 }
      )
    }
    
    // Format the transcript into readable text
    const formattedText = formatTranscript(transcriptContent)
    
    console.log(`✅ Extracted transcript for "${video.name}" (${Math.round(video.duration)}s)`)
    
    return NextResponse.json({
      success: true,
      video: {
        ...video,
        durationFormatted: formatDuration(video.duration),
      },
      transcript: {
        language: transcript.language,
        text: formattedText,
        raw: transcriptContent,  // Include raw data in case client needs it
        wordCount: formattedText ? formattedText.split(/\s+/).length : 0,
      },
    })
    
  } catch (error) {
    console.error('❌ Loom transcript extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract transcript' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/loom/transcript?url=...
 * 
 * Alternative GET endpoint for easier testing
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const loomUrl = searchParams.get('url')
  
  if (!loomUrl) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      { status: 400 }
    )
  }
  
  // Reuse POST logic
  const fakeRequest = {
    json: async () => ({ loomUrl })
  }
  
  return POST(fakeRequest)
}

/**
 * Format seconds into human-readable duration
 */
function formatDuration(seconds) {
  if (!seconds) return 'Unknown'
  
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

