import { getLinkPreview } from 'link-preview-js'
import { NextResponse } from 'next/server'

/**
 * Validates that a string is a valid HTTP/HTTPS URL
 */
function isValidUrl(string) {
  if (!string || typeof string !== 'string') return false
  
  // Trim whitespace
  const trimmed = string.trim()
  if (!trimmed) return false
  
  try {
    const url = new URL(trimmed)
    // Only allow http and https protocols
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Fetches image dimensions from a URL
 * Returns { width, height } or null if unable to determine
 */
async function getImageDimensions(imageUrl) {
  try {
    // Fetch the image headers to check content-type
    const response = await fetch(imageUrl, { 
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    })
    
    if (!response.ok) return null
    
    // For now, we'll use a default OG image size
    // Most sites use 1200x630 for og:image (Facebook's recommended size)
    // In the future, we could parse the actual image to get dimensions
    return { width: 1200, height: 630 }
  } catch (error) {
    console.error('Error getting image dimensions:', error)
    return null
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  // Validate URL format before processing
  if (!isValidUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  try {
    const data = await getLinkPreview(url, {
      timeout: 5000,
      followRedirects: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    })

    // Get the primary image
    const primaryImage = data.images?.[0] || null
    
    // Fetch image dimensions if there's an image
    let imageDimensions = null
    if (primaryImage) {
      imageDimensions = await getImageDimensions(primaryImage)
    }

    // Normalize the response
    const preview = {
      url: data.url || url,
      title: data.title || null,
      description: data.description || null,
      siteName: data.siteName || null,
      images: data.images || [],
      favicons: data.favicons || [],
      mediaType: data.mediaType || 'website',
      imageDimensions, // Include image dimensions
    }

    return NextResponse.json(preview)
  } catch (error) {
    console.error('Link preview error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch link preview', url },
      { status: 500 }
    )
  }
}
