import { getLinkPreview } from 'link-preview-js'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    const data = await getLinkPreview(url, {
      timeout: 5000,
      followRedirects: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    })

    // Normalize the response
    const preview = {
      url: data.url || url,
      title: data.title || null,
      description: data.description || null,
      siteName: data.siteName || null,
      images: data.images || [],
      favicons: data.favicons || [],
      mediaType: data.mediaType || 'website',
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

