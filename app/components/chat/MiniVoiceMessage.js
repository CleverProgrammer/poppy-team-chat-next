'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useWavesurfer } from '@wavesurfer/react'

const SPEED_OPTIONS = [1, 1.5, 2, 2.5, 3]

/**
 * Mini version of VoiceMessage for inline audio attachments
 * Uses wavesurfer for proper audio format support and waveform display
 * Designed to fit 2 per row when multiple audio files are attached
 */
export default function MiniVoiceMessage({ audioUrl, audioDuration, isSent }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(audioDuration || 0)
  const [speedIndex, setSpeedIndex] = useState(0)
  const containerRef = useRef(null)

  const { wavesurfer, isReady } = useWavesurfer({
    container: containerRef,
    url: audioUrl,
    height: 32,
    waveColor: isSent ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)',
    progressColor: isSent ? 'rgba(255,255,255,1)' : '#ff3b30',
    barWidth: 2,
    barGap: 1,
    barRadius: 1,
    cursorWidth: 0,
    normalize: true,
  })

  // Update duration when wavesurfer loads the audio
  useEffect(() => {
    if (wavesurfer && isReady) {
      const actualDuration = wavesurfer.getDuration()
      if (actualDuration > 0) {
        setDuration(actualDuration)
      }
    }
  }, [wavesurfer, isReady])

  // Set playback rate when speed changes or wavesurfer is ready
  useEffect(() => {
    if (wavesurfer) {
      wavesurfer.setPlaybackRate(SPEED_OPTIONS[speedIndex])
    }
  }, [wavesurfer, speedIndex])

  useEffect(() => {
    if (!wavesurfer) return

    const subscriptions = [
      wavesurfer.on('play', () => setIsPlaying(true)),
      wavesurfer.on('pause', () => setIsPlaying(false)),
      wavesurfer.on('finish', () => setIsPlaying(false)),
      wavesurfer.on('timeupdate', time => setCurrentTime(time)),
      wavesurfer.on('ready', () => {
        const actualDuration = wavesurfer.getDuration()
        if (actualDuration > 0) {
          setDuration(actualDuration)
        }
      }),
    ]

    return () => {
      subscriptions.forEach(unsub => unsub())
    }
  }, [wavesurfer])

  const handlePlayPause = useCallback((e) => {
    e.stopPropagation()
    if (wavesurfer) {
      wavesurfer.playPause()
    }
  }, [wavesurfer])

  const handleSpeedChange = useCallback((e) => {
    e.stopPropagation()
    setSpeedIndex(prev => (prev + 1) % SPEED_OPTIONS.length)
  }, [])

  const formatTime = seconds => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Show current time while playing, otherwise show duration
  const displayTime = isPlaying ? currentTime : duration
  const currentSpeed = SPEED_OPTIONS[speedIndex]

  return (
    <div className={`mini-voice-message ${isSent ? 'sent' : 'received'}`}>
      <button
        className='mini-voice-play-button'
        onClick={handlePlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width='14' height='14' viewBox='0 0 16 16' fill='currentColor'>
            <path d='M5 3h2v10H5V3zm4 0h2v10H9V3z' />
          </svg>
        ) : (
          <svg width='14' height='14' viewBox='0 0 16 16' fill='currentColor'>
            <path d='M5 3l8 5-8 5V3z' />
          </svg>
        )}
      </button>

      <div className='mini-voice-waveform' ref={containerRef} />

      <div className='mini-voice-duration'>{formatTime(displayTime)}</div>

      {isPlaying && (
        <button
          className='mini-voice-speed-button'
          onClick={handleSpeedChange}
          aria-label={`Playback speed ${currentSpeed}x`}
        >
          {currentSpeed}x
        </button>
      )}
    </div>
  )
}
