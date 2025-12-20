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
  const [videoPath, setVideoPath] = useState(null) // Recorded video path for preview
  const timerRef = useRef(null)

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

        await CameraPreview.start({
          position: 'front',
          parent: 'camera-preview-container',
          className: 'camera-preview',
          toBack: false,
          disableAudio: false,
          enableHighResolution: true,
          enableZoom: false,
        })
        setIsInitialized(true)
        setError(null)
        console.log('📹 Camera initialized')
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

  // Start recording (tap to start)
  const startRecording = useCallback(async () => {
    if (!isInitialized || !CameraPreview || isRecording) return

    try {
      hapticMedium()
      console.log('📹 Starting recording...')
      await CameraPreview.startRecordVideo({
        storeToFile: true,
        width: 1920,
        height: 1080,
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

  // Stop recording (tap to stop)
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

      // Stop camera preview
      await CameraPreview.stop().catch(e => console.log('Error stopping camera:', e))
      setIsInitialized(false)

      if (result.videoFilePath) {
        // Store the path for preview/send
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

  // Retake - re-initialize camera
  const retake = useCallback(async () => {
    setVideoPath(null)
    setError(null)
    setRecordingTime(0)

    try {
      if (!CameraPreview) {
        const mod = await import('@capgo/camera-preview')
        CameraPreview = mod.CameraPreview
      }

      await CameraPreview.start({
        position: 'front',
        parent: 'camera-preview-container',
        className: 'camera-preview',
        toBack: false,
        disableAudio: false,
        enableHighResolution: true,
        enableZoom: false,
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

  // Show video preview after recording
  const showPreview = videoPath && !isRecording && !isInitialized

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      {/* Camera preview container (hidden when showing video preview) */}
      <div
        id='camera-preview-container'
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000',
          display: showPreview ? 'none' : 'block',
        }}
      />

      {/* Video preview after recording */}
      {showPreview && (
        <video
          src={Capacitor.convertFileSrc(videoPath)}
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '50px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          borderRadius: '50%',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          cursor: 'pointer',
        }}
      >
        <svg width='24' height='24' viewBox='0 0 24 24' fill='white'>
          <path d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' />
        </svg>
      </button>

      {/* Loading/error state */}
      {!isInitialized && !error && !showPreview && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontSize: '18px',
            zIndex: 10001,
          }}
        >
          Opening camera...
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ff6b6b',
            fontSize: '16px',
            textAlign: 'center',
            padding: '20px',
            zIndex: 10001,
          }}
        >
          {error}
          <br />
          <button
            onClick={handleClose}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.5)',
            padding: '8px 16px',
            borderRadius: '20px',
            zIndex: 10001,
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              background: '#ff3b30',
              borderRadius: '50%',
              animation: 'pulse 1s infinite',
            }}
          />
          <span style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>
            {formatTime(recordingTime)}
          </span>
        </div>
      )}

      {/* Record/Stop button - only when camera is active */}
      {isInitialized && !showPreview && (
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10001,
          }}
        >
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: isRecording ? '#ff3b30' : 'white',
              border: '4px solid rgba(255,255,255,0.3)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: isRecording
                ? '0 0 0 8px rgba(255,59,48,0.3)'
                : '0 4px 20px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isRecording && (
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  background: 'white',
                }}
              />
            )}
          </button>
          <div
            style={{
              textAlign: 'center',
              marginTop: '12px',
              color: 'white',
              fontSize: '13px',
              opacity: 0.8,
            }}
          >
            {isRecording ? 'Tap to stop' : 'Tap to record'}
          </div>
        </div>
      )}

      {/* Preview controls - Retake / Send */}
      {showPreview && (
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: '40px',
            zIndex: 10001,
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
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width='28' height='28' viewBox='0 0 24 24' fill='white'>
                <path d='M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z' />
              </svg>
            </div>
            <span style={{ color: 'white', fontSize: '13px' }}>Retake</span>
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
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width='28' height='28' viewBox='0 0 24 24' fill='white'>
                <path d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' />
              </svg>
            </div>
            <span style={{ color: 'white', fontSize: '13px' }}>Send</span>
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
        .camera-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>
    </div>,
    document.body
  )
}
