'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function WebVideoRecorder({ isOpen, onClose, onVideoRecorded }) {
  const [recordingTime, setRecordingTime] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [videoBlob, setVideoBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [error, setError] = useState(null)

  const timerRef = useRef(null)
  const videoPreviewRef = useRef(null)
  const recordedVideoRef = useRef(null)
  const streamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  // Camera bubble dimensions
  const BUBBLE_WIDTH = 280
  const BUBBLE_HEIGHT = 380

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen])

  const startCamera = async () => {
    try {
      setError(null)
      setCameraReady(false)
      console.log('📹 Starting camera...')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      })

      streamRef.current = stream

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
      }

      setCameraReady(true)
      console.log('📹 Camera ready!')
    } catch (err) {
      console.error('📹 Camera error:', err)
      setError('Could not access camera. Please allow camera permissions.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setCameraReady(false)
    setIsRecording(false)
    setShowPreview(false)
    setVideoBlob(null)
    setPreviewUrl(null)
    setRecordingTime(0)
    chunksRef.current = []
  }

  const handleStartRecording = useCallback(() => {
    if (!streamRef.current) {
      console.error('📹 No stream available')
      return
    }

    console.log('📹 Starting recording...')
    chunksRef.current = []
    setRecordingTime(0)

    // Try webm first, fall back to mp4
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4'

    console.log('📹 Using mimeType:', mimeType)

    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType })
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
        console.log('📹 Got chunk:', event.data.size)
      }
    }

    mediaRecorder.onstop = () => {
      console.log('📹 Recording stopped, chunks:', chunksRef.current.length)
      const blob = new Blob(chunksRef.current, { type: mimeType })
      console.log('📹 Created blob:', blob.size)
      setVideoBlob(blob)

      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setShowPreview(true)
      setIsRecording(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    mediaRecorder.start(100) // Collect data every 100ms
    setIsRecording(true)

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime(t => t + 1)
    }, 1000)

    console.log('📹 Recording started!')
  }, [])

  const handleStopRecording = useCallback(() => {
    console.log('📹 Stopping recording...')
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleRetake = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setShowPreview(false)
    setVideoBlob(null)
    setPreviewUrl(null)
    setRecordingTime(0)
    chunksRef.current = []

    // Restart camera preview
    if (videoPreviewRef.current && streamRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current
    }
  }, [previewUrl])

  const handleSend = useCallback(() => {
    if (!videoBlob) return

    console.log('📹 Sending video blob, size:', videoBlob.size)
    
    // Pass the video blob immediately (like mobile passes file path)
    // The parent will handle the async upload with progress indicator
    onVideoRecorded(videoBlob)
    onClose()
  }, [videoBlob, onVideoRecorded, onClose])

  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [onClose])

  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return createPortal(
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.15)',
          border: 'none',
          borderRadius: '50%',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>

      {/* Error message */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '80px',
            background: 'rgba(255, 59, 48, 0.9)',
            padding: '12px 20px',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Video preview container */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: BUBBLE_WIDTH,
          height: BUBBLE_HEIGHT,
          borderRadius: '24px',
          overflow: 'hidden',
          border: isRecording
            ? '4px solid #ff3b30'
            : showPreview
            ? '4px solid #7c3aed'
            : '4px solid rgba(255,255,255,0.3)',
          boxShadow: isRecording
            ? '0 0 40px rgba(255,59,48,0.5)'
            : '0 8px 32px rgba(0,0,0,0.5)',
          position: 'relative',
          background: '#000',
        }}
      >
        {/* Live preview */}
        {!showPreview && (
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror for selfie view
              display: cameraReady ? 'block' : 'none',
            }}
          />
        )}

        {/* Recorded video preview */}
        {showPreview && previewUrl && (
          <video
            ref={recordedVideoRef}
            src={previewUrl}
            autoPlay
            loop
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}

        {/* Loading state */}
        {!cameraReady && !showPreview && !error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#000',
            }}
          >
            <span style={{ color: 'white', fontSize: '14px' }}>Starting camera...</span>
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0,0,0,0.7)',
              padding: '8px 16px',
              borderRadius: '20px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                background: '#ff3b30',
                borderRadius: '50%',
                animation: 'pulse 1s infinite',
              }}
            />
            <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
              {formatTime(recordingTime)}
            </span>
          </div>
        )}

        {/* Ready to send badge */}
        {showPreview && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(124, 58, 237, 0.9)',
              padding: '8px 16px',
              borderRadius: '20px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
              Ready to send ✨
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          marginTop: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Record / Stop button - only when not in preview mode */}
        {!showPreview && (
          <>
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={!cameraReady}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: isRecording ? '#ff3b30' : 'white',
                border: '4px solid rgba(255,255,255,0.3)',
                cursor: !cameraReady ? 'wait' : 'pointer',
                opacity: !cameraReady ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isRecording
                  ? '0 0 0 6px rgba(255,59,48,0.3)'
                  : '0 4px 20px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              {isRecording && (
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    background: 'white',
                  }}
                />
              )}
            </button>
            <span style={{ color: 'white', fontSize: '13px', opacity: 0.8 }}>
              {!cameraReady
                ? 'Starting camera...'
                : isRecording
                ? 'Tap to stop'
                : 'Tap to record'}
            </span>
          </>
        )}

        {/* Retake / Send buttons - only in preview mode */}
        {showPreview && (
          <div style={{ display: 'flex', gap: '40px' }}>
            {/* Retake */}
            <button
              onClick={handleRetake}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
              </div>
              <span style={{ color: 'white', fontSize: '12px', opacity: 0.8 }}>Retake</span>
            </button>

            {/* Send */}
            <button
              onClick={handleSend}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#7c3aed',
                  boxShadow: '0 4px 20px rgba(124, 58, 237, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </div>
              <span style={{ color: 'white', fontSize: '12px', opacity: 0.8 }}>Send</span>
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>,
    document.body
  )
}
