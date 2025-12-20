'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'
import { hapticLight, hapticMedium } from '../../utils/haptics'

// Only import CameraPreview on native platforms
let CameraPreview = null
if (typeof window !== 'undefined') {
  import('@capgo/camera-preview').then(mod => {
    CameraPreview = mod.CameraPreview
  })
}

export default function VideoRecorder({ isOpen, onClose, onVideoRecorded }) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState(null)
  const [videoPath, setVideoPath] = useState(null)
  const timerRef = useRef(null)
  const containerRef = useRef(null)

  // Camera bubble dimensions - compact and light!
  const BUBBLE_WIDTH = 200
  const BUBBLE_HEIGHT = 280 // ~9:16 aspect ratio
  const BUBBLE_BOTTOM = 180 // Above the record button

  // Initialize camera when opened
  useEffect(() => {
    if (!isOpen) return
    if (!Capacitor.isNativePlatform()) {
      setError('Native camera only available on iOS/Android')
      return
    }

    // Reset state
    setVideoPath(null)
    setError(null)
    setRecordingTime(0)

    const initCamera = async () => {
      try {
        if (!CameraPreview) {
          const mod = await import('@capgo/camera-preview')
          CameraPreview = mod.CameraPreview
        }

        // Calculate exact position for camera bubble
        // Bubble is centered horizontally, positioned above the record button
        const screenWidth = window.innerWidth
        const screenHeight = window.innerHeight
        const x = Math.round((screenWidth - BUBBLE_WIDTH) / 2)
        // Position: from bottom - padding(40) - button area(~100) - bubble height - margin
        const y = Math.round(screenHeight - 40 - 100 - BUBBLE_HEIGHT - 20)

        await CameraPreview.start({
          position: 'front',
          toBack: false, // Render on top of webview
          disableAudio: false,
          enableHighResolution: true,
          enableZoom: false,
          width: BUBBLE_WIDTH,
          height: BUBBLE_HEIGHT,
          x: x,
          y: y,
        })
        setIsInitialized(true)
        setError(null)
        console.log('📹 Camera initialized (compact bubble)')
      } catch (err) {
        console.error('Failed to initialize camera:', err)
        setError(err.message || 'Failed to open camera')
      }
    }

    initCamera()

    return () => {
      if (CameraPreview) {
        CameraPreview.stop().catch(e => console.log('Error stopping camera:', e))
      }
      setIsInitialized(false)
      setIsRecording(false)
      setRecordingTime(0)
      setVideoPath(null)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen])

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isInitialized || !CameraPreview || isRecording) return

    try {
      hapticMedium()
      console.log('📹 Starting recording...')
      await CameraPreview.startRecordVideo({
        storeToFile: true,
        width: 1080,
        height: 1920,
        quality: 100,
      })
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)

      console.log('📹 Recording started!')
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Failed to start recording: ' + (err.message || err.errorMessage))
    }
  }, [isInitialized, isRecording])

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!isRecording || !CameraPreview) return

    try {
      hapticLight()
      console.log('📹 Stopping recording...')

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      const result = await CameraPreview.stopRecordVideo()
      console.log('📹 Recording stopped:', result)
      setIsRecording(false)

      await CameraPreview.stop().catch(e => console.log('Error stopping camera:', e))
      setIsInitialized(false)

      if (result.videoFilePath) {
        setVideoPath(result.videoFilePath)
      } else {
        setError('No video file received')
      }
    } catch (err) {
      console.error('Failed to stop recording:', err)
      setError('Failed to stop recording: ' + (err.message || err.errorMessage))
      setIsRecording(false)
    }
  }, [isRecording])

  // Send the recorded video
  const sendVideo = useCallback(() => {
    if (!videoPath) return
    hapticMedium()
    onVideoRecorded(videoPath)
  }, [videoPath, onVideoRecorded])

  // Retake
  const retake = useCallback(async () => {
    setVideoPath(null)
    setError(null)
    setRecordingTime(0)

    try {
      if (!CameraPreview) {
        const mod = await import('@capgo/camera-preview')
        CameraPreview = mod.CameraPreview
      }

      // Calculate exact position for camera bubble (same as init)
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      const x = Math.round((screenWidth - BUBBLE_WIDTH) / 2)
      const y = Math.round(screenHeight - 40 - 100 - BUBBLE_HEIGHT - 20)

      await CameraPreview.start({
        position: 'front',
        toBack: false,
        disableAudio: false,
        enableHighResolution: true,
        enableZoom: false,
        width: BUBBLE_WIDTH,
        height: BUBBLE_HEIGHT,
        x: x,
        y: y,
      })
      setIsInitialized(true)
      console.log('📹 Camera re-initialized for retake')
    } catch (err) {
      console.error('Failed to reinitialize camera:', err)
      setError(err.message || 'Failed to open camera')
    }
  }, [])

  // Handle close
  const handleClose = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (CameraPreview) {
      if (isRecording) {
        await CameraPreview.stopRecordVideo().catch(e => console.log('Error stopping record:', e))
      }
      await CameraPreview.stop().catch(e => console.log('Error stopping camera:', e))
    }

    setIsInitialized(false)
    setIsRecording(false)
    setRecordingTime(0)
    setVideoPath(null)
    onClose()
  }, [isRecording, onClose])

  // Format time
  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  const showPreview = videoPath && !isRecording && !isInitialized

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        // Semi-transparent dim overlay - chat visible behind!
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(2px)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: '40px',
      }}
    >
      {/* Close button - top right */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '50px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.15)',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
        }}
      >
        <svg width='20' height='20' viewBox='0 0 24 24' fill='white'>
          <path d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' />
        </svg>
      </button>

      {/* Loading state - only show before camera initializes */}
      {!showPreview && !isInitialized && !error && (
        <div
          style={{
            width: BUBBLE_WIDTH,
            height: BUBBLE_HEIGHT,
            borderRadius: '24px',
            border: '3px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000',
          }}
        >
          <span style={{ color: 'white', fontSize: '14px', opacity: 0.8 }}>Opening camera...</span>
        </div>
      )}

      {/* Border frame BEHIND the native camera - peeks out as a glowing border */}
      {!showPreview && isInitialized && (
        <div
          style={{
            // Asymmetric padding: less on top, slightly less on bottom, little less on sides
            width: BUBBLE_WIDTH + 10, // 5px each side (was 8px)
            height: BUBBLE_HEIGHT + 8, // 3px top + 5px bottom (was 8px each)
            borderRadius: '26px',
            border: isRecording ? '3px solid #ff3b30' : '3px solid rgba(255,255,255,0.5)',
            boxShadow: isRecording
              ? '0 0 40px rgba(255,59,48,0.7), 0 0 80px rgba(255,59,48,0.3)'
              : '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.15)',
            marginBottom: '14px',
            marginTop: '-2px', // Shift up slightly so less shows on top
            background: '#000',
          }}
        />
      )}

      {/* Recording indicator - floats above the native camera */}
      {isRecording && (
        <div
          style={{
            position: 'absolute',
            // Position just below the top of where camera bubble would be
            bottom: `${40 + 100 + BUBBLE_HEIGHT + 20 - 40}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(0,0,0,0.7)',
            padding: '8px 14px',
            borderRadius: '20px',
            backdropFilter: 'blur(10px)',
            zIndex: 10002,
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

      {/* Video preview after recording */}
      {showPreview && (
        <div
          style={{
            width: BUBBLE_WIDTH,
            height: BUBBLE_HEIGHT,
            borderRadius: '24px',
            border: '3px solid #7c3aed',
            boxShadow: '0 8px 32px rgba(124, 58, 237, 0.4)',
            marginBottom: '20px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <video
            src={Capacitor.convertFileSrc(videoPath)}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          {/* "Ready to send" badge */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(124, 58, 237, 0.9)',
              padding: '6px 12px',
              borderRadius: '16px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>
              Ready to send ✨
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            width: BUBBLE_WIDTH,
            height: BUBBLE_HEIGHT,
            borderRadius: '24px',
            border: '3px solid #ff6b6b',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
            padding: '20px',
          }}
        >
          <span style={{ color: '#ff6b6b', fontSize: '13px', textAlign: 'center' }}>{error}</span>
        </div>
      )}

      {/* Record / Stop button */}
      {isInitialized && !showPreview && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: isRecording ? '#ff3b30' : 'white',
              border: '4px solid rgba(255,255,255,0.3)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: isRecording
                ? '0 0 0 6px rgba(255,59,48,0.3)'
                : '0 4px 20px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
          <span
            style={{
              marginTop: '12px',
              color: 'white',
              fontSize: '13px',
              opacity: 0.8,
            }}
          >
            {isRecording ? 'Tap to stop' : 'Tap to record'}
          </span>
        </div>
      )}

      {/* Preview controls - Retake / Send */}
      {showPreview && (
        <div
          style={{
            display: 'flex',
            gap: '32px',
          }}
        >
          {/* Retake button */}
          <button
            onClick={retake}
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
              <svg width='24' height='24' viewBox='0 0 24 24' fill='white'>
                <path d='M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z' />
              </svg>
            </div>
            <span style={{ color: 'white', fontSize: '12px', opacity: 0.8 }}>Retake</span>
          </button>

          {/* Send button */}
          <button
            onClick={sendVideo}
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
              <svg width='24' height='24' viewBox='0 0 24 24' fill='white'>
                <path d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' />
              </svg>
            </div>
            <span style={{ color: 'white', fontSize: '12px', opacity: 0.8 }}>Send</span>
          </button>
        </div>
      )}

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
      `}</style>
    </div>,
    document.body
  )
}
