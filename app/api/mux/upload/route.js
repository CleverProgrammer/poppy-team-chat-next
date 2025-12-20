import { NextResponse } from 'next/server'
import Mux from '@mux/mux-node'

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
})

// Create a direct upload URL for client-side uploads
export async function POST() {
  try {
    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        playback_policy: ['public'],
        encoding_tier: 'smart', // Better quality encoding
        mp4_support: 'standard', // Enable MP4 for non-HLS browsers (Chrome)
        max_resolution_tier: '2160p', // Up to 4K - Mux auto-adapts to best quality like YouTube
      },
    })

    return NextResponse.json({
      uploadUrl: upload.url,
      uploadId: upload.id,
    })
  } catch (error) {
    console.error('Error creating Mux upload:', error)
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
  }
}
