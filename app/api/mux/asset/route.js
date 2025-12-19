import { NextResponse } from 'next/server'
import Mux from '@mux/mux-node'

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
})

// Get asset details from upload ID
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const uploadId = searchParams.get('uploadId')

    if (!uploadId) {
      return NextResponse.json({ error: 'uploadId is required' }, { status: 400 })
    }

    // Get the upload to find the asset ID
    const upload = await mux.video.uploads.retrieve(uploadId)

    if (!upload.asset_id) {
      return NextResponse.json({
        status: upload.status,
        ready: false,
      })
    }

    // Get the asset details
    const asset = await mux.video.assets.retrieve(upload.asset_id)

    // Check if MP4 static renditions are ready
    const staticRenditionsReady = asset.static_renditions?.status === 'ready'

    return NextResponse.json({
      status: asset.status,
      ready: asset.status === 'ready',
      mp4Ready: staticRenditionsReady,
      playbackId: asset.playback_ids?.[0]?.id || null,
      assetId: asset.id,
      duration: asset.duration,
    })
  } catch (error) {
    console.error('Error getting Mux asset:', error)
    return NextResponse.json({ error: 'Failed to get asset details' }, { status: 500 })
  }
}
