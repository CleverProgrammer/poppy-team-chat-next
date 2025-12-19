'use client'

import { useState, useCallback } from 'react'

export function useMuxUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const uploadVideo = useCallback(async (file) => {
    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // 1. Get a direct upload URL from our API
      const uploadResponse = await fetch('/api/mux/upload', {
        method: 'POST',
      })
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL')
      }
      
      const { uploadUrl, uploadId } = await uploadResponse.json()

      // 2. Upload the video directly to Mux
      const xhr = new XMLHttpRequest()
      
      await new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100)
            setProgress(percent)
          }
        })
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })
        
        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))
        
        xhr.open('PUT', uploadUrl)
        xhr.send(file)
      })

      // 3. Poll for the asset to be ready
      let playbackId = null
      let attempts = 0
      const maxAttempts = 60 // 60 seconds max wait

      while (!playbackId && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000))
        attempts++
        
        const assetResponse = await fetch(`/api/mux/asset?uploadId=${uploadId}`)
        const assetData = await assetResponse.json()
        
        if (assetData.ready && assetData.playbackId) {
          playbackId = assetData.playbackId
        }
      }

      if (!playbackId) {
        throw new Error('Video processing timed out')
      }

      setUploading(false)
      setProgress(100)
      
      return {
        playbackId,
        uploadId,
      }
    } catch (err) {
      console.error('Mux upload error:', err)
      setError(err.message)
      setUploading(false)
      throw err
    }
  }, [])

  return {
    uploadVideo,
    uploading,
    progress,
    error,
  }
}

