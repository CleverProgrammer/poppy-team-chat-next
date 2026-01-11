'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Compact audio player for inline audio attachments
 * Designed to be displayed in a grid like images
 */
export default function CompactAudioPlayer({ audioUrl, duration, transcription, isSent }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      setProgress((audio.currentTime / audio.duration) * 100 || 0)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setProgress(0)
      setCurrentTime(0)
    }

    const handleLoadedMetadata = () => {
      setIsLoaded(true)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [])

  const handlePlayPause = useCallback((e) => {
    e.stopPropagation()
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const displayTime = isPlaying ? currentTime : duration

  // Get transcription text (can be string or object with .text)
  const transcriptText = typeof transcription === 'string' 
    ? transcription 
    : transcription?.text || ''
  
  // Truncate transcription for compact display
  const truncatedTranscript = transcriptText.length > 50 
    ? transcriptText.substring(0, 50) + '...'
    : transcriptText

  // eslint-disable-next-line no-unused-vars
  const _ = isLoaded // Suppress unused variable warning

  return (
    <div className={`compact-audio-player ${isSent ? 'sent' : 'received'}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <button
        className="compact-audio-play-btn"
        onClick={handlePlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3h2v10H5V3zm4 0h2v10H9V3z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3l8 5-8 5V3z" />
          </svg>
        )}
      </button>

      <div className="compact-audio-content">
        {/* Progress bar */}
        <div className="compact-audio-progress-container">
          <div 
            className="compact-audio-progress-bar" 
            style={{ width: `${progress}%` }} 
          />
        </div>
        
        {/* Duration and transcript preview */}
        <div className="compact-audio-info">
          <span className="compact-audio-duration">{formatTime(displayTime)}</span>
          {truncatedTranscript && (
            <span className="compact-audio-transcript">{truncatedTranscript}</span>
          )}
        </div>
      </div>
    </div>
  )
}
