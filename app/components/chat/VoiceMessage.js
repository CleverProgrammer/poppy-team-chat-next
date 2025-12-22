'use client'

import { useState, useRef, useEffect } from 'react'
import WaveSurfer from '@wavesurfer/react'

export default function VoiceMessage({ audioUrl, audioDuration, isSent }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const wavesurferRef = useRef(null)

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  return (
    <div className={`voice-message ${isSent ? 'sent' : 'received'}`}>
      <button
        className="voice-play-button"
        onClick={handlePlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3h2v10H5V3zm4 0h2v10H9V3z" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3l8 5-8 5V3z" />
          </svg>
        )}
      </button>

      <div className="voice-waveform-container">
        <WaveSurfer
          url={audioUrl}
          height={40}
          waveColor={isSent ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.4)"}
          progressColor={isSent ? "#fff" : "#ff3b30"}
          barWidth={3}
          barGap={1.5}
          cursorWidth={0}
          normalize={true}
          onReady={(ws) => {
            wavesurferRef.current = ws
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>

      <div className="voice-duration">
        {formatTime(audioDuration)}
      </div>
    </div>
  )
}

