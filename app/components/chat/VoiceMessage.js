'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useWavesurfer } from '@wavesurfer/react'

const SPEED_OPTIONS = [1, 1.5, 2, 2.5, 3]

export default function VoiceMessage({ audioUrl, audioDuration, isSent }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(0)
  const containerRef = useRef(null)

  const { wavesurfer, isReady } = useWavesurfer({
    container: containerRef,
    url: audioUrl,
    height: 40,
    waveColor: isSent ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
    progressColor: isSent ? 'rgba(255,255,255,1)' : '#ff3b30',
    barWidth: 3,
    barGap: 2,
    barRadius: 2,
    cursorWidth: 0,
    normalize: true,
  })

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
    ]

    return () => {
      subscriptions.forEach(unsub => unsub())
    }
  }, [wavesurfer])

  const handlePlayPause = useCallback(() => {
    if (wavesurfer) {
      wavesurfer.playPause()
    }
  }, [wavesurfer])

  const handleSpeedChange = useCallback(() => {
    setSpeedIndex(prev => (prev + 1) % SPEED_OPTIONS.length)
  }, [])

  const formatTime = seconds => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Show current time while playing, otherwise show duration
  const displayTime = isPlaying ? currentTime : audioDuration
  const currentSpeed = SPEED_OPTIONS[speedIndex]

  return (
    <div className={`voice-message ${isSent ? 'sent' : 'received'}`}>
      <button
        className='voice-play-button'
        onClick={handlePlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width='20' height='20' viewBox='0 0 16 16' fill='currentColor'>
            <path d='M5 3h2v10H5V3zm4 0h2v10H9V3z' />
          </svg>
        ) : (
          <svg width='20' height='20' viewBox='0 0 16 16' fill='currentColor'>
            <path d='M5 3l8 5-8 5V3z' />
          </svg>
        )}
      </button>

      <div className='voice-waveform-container' ref={containerRef} />

      <div className='voice-duration'>{formatTime(displayTime)}</div>

      {isPlaying && (
        <button
          className='voice-speed-button'
          onClick={handleSpeedChange}
          aria-label={`Playback speed ${currentSpeed}x`}
        >
          {currentSpeed}x
        </button>
      )}
    </div>
  )
}
