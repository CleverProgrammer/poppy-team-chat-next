'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import MuxPlayer from '@mux/mux-player-react'
import { markStoryAsViewed, subscribeToStoryViewers } from '../../lib/firestore'

export default function StoriesViewer({
  isOpen,
  onClose,
  videos = [], // Array of { id, playbackId, sender, senderId, photoURL, timestamp, msgId, isViewed }
  initialIndex = 0,
  chatType = 'channel', // 'channel' or 'dm'
  chatId = 'general', // channel ID or DM ID
  currentUser = null, // Current user object { uid, displayName, photoURL }
  onStoryViewed = null, // Callback when a story is marked as viewed
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isSpeedUp, setIsSpeedUp] = useState(false)
  const [isHorizontal, setIsHorizontal] = useState(false)
  const [viewers, setViewers] = useState([])
  const [showViewersModal, setShowViewersModal] = useState(false)
  const [hasMarkedViewed, setHasMarkedViewed] = useState(new Set())
  const playerRef = useRef(null)
  const touchStartY = useRef(0)
  const speedZoneRef = useRef(null)
  const viewTimerRef = useRef(null)

  // Reset index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setProgress(0)
      setIsHorizontal(false)
      setHasMarkedViewed(new Set())
    }
  }, [isOpen, initialIndex])

  // Reset horizontal state when changing videos
  useEffect(() => {
    setIsHorizontal(false)
  }, [currentIndex])

  // Mark story as viewed after 2 seconds of viewing
  useEffect(() => {
    if (!isOpen || videos.length === 0 || !currentUser) return

    const currentVideo = videos[currentIndex]
    if (!currentVideo || !currentVideo.id) return

    // Don't mark again if already marked in this session
    if (hasMarkedViewed.has(currentVideo.id)) return

    // Clear any existing timer
    if (viewTimerRef.current) {
      clearTimeout(viewTimerRef.current)
    }

    // Set timer to mark as viewed after 2 seconds
    viewTimerRef.current = setTimeout(() => {
      markStoryAsViewed(
        currentVideo.id,
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        currentUser.photoURL || '',
        chatType,
        chatId
      )
      setHasMarkedViewed(prev => new Set([...prev, currentVideo.id]))
      onStoryViewed?.(currentVideo.id)
    }, 2000)

    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current)
      }
    }
  }, [isOpen, currentIndex, videos, currentUser, chatType, chatId, hasMarkedViewed, onStoryViewed])

  // Subscribe to viewers for current story
  useEffect(() => {
    if (!isOpen || videos.length === 0) {
      setViewers([])
      return
    }

    const currentVideo = videos[currentIndex]
    if (!currentVideo || !currentVideo.id) {
      setViewers([])
      return
    }

    const unsubscribe = subscribeToStoryViewers(
      currentVideo.id,
      chatType,
      chatId,
      (viewersList) => {
        setViewers(viewersList)
      }
    )

    return () => unsubscribe()
  }, [isOpen, currentIndex, videos, chatType, chatId])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = e => {
      if (!isOpen) return

      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, currentIndex, videos.length])

  // Navigation functions
  const goNext = useCallback(() => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setProgress(0)
    } else {
      onClose()
    }
  }, [currentIndex, videos.length, onClose])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setProgress(0)
    }
  }, [currentIndex])

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    const player = playerRef.current
    if (player && duration > 0) {
      const currentTime = player.currentTime || 0
      setProgress((currentTime / duration) * 100)
    }
  }, [duration])

  const handleLoadedMetadata = useCallback(() => {
    const player = playerRef.current
    if (player) {
      setDuration(player.duration || 0)
      
      // Detect if video is horizontal (landscape) or vertical (portrait)
      // MuxPlayer wraps the video - need to find the actual video element
      setTimeout(() => {
        const videoEl = player.shadowRoot?.querySelector('video') || 
                        player.querySelector?.('video') || 
                        player.media
        
        if (videoEl) {
          const vw = videoEl.videoWidth
          const vh = videoEl.videoHeight
          if (vw && vh && vw > vh) {
            setIsHorizontal(true)
          }
        }
      }, 100) // Small delay to ensure video dimensions are available
    }
  }, [])

  const handleEnded = useCallback(() => {
    goNext()
  }, [goNext])

  // 2x Speed handlers
  const handleSpeedStart = useCallback(e => {
    e.preventDefault()
    e.stopPropagation()
    setIsSpeedUp(true)
    if (playerRef.current) {
      playerRef.current.playbackRate = 2
    }
  }, [])

  const handleSpeedEnd = useCallback(() => {
    setIsSpeedUp(false)
    if (playerRef.current) {
      playerRef.current.playbackRate = 1
    }
  }, [])

  // Tap zones - left 30% for prev, right 70% for next
  const handleTapZone = useCallback(
    e => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = x / rect.width

      if (percentage < 0.3) {
        goPrev()
      } else {
        goNext()
      }
    },
    [goPrev, goNext]
  )

  // Swipe down to close
  const handleTouchStart = useCallback(e => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback(
    e => {
      const touchEndY = e.changedTouches[0].clientY
      const deltaY = touchEndY - touchStartY.current

      if (deltaY > 100) {
        onClose()
      }
    },
    [onClose]
  )

  if (!isOpen || videos.length === 0) return null

  const currentVideo = videos[currentIndex]
  const formattedTime = currentVideo?.timestamp
    ? new Date(currentVideo.timestamp?.seconds * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''

  return createPortal(
    <div
      className='stories-overlay'
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: isHorizontal ? '95vw' : '500px',
          height: '100%',
          background: '#000',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Progress bars */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            gap: '4px',
            padding: '8px 8px 0',
            zIndex: 10,
          }}
        >
          {videos.map((_, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                height: '3px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#fff',
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
                  transition: idx === currentIndex ? 'width 0.1s linear' : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 16px',
            zIndex: 10,
          }}
        >
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>
              {currentVideo?.sender || 'Video Reply'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{formattedTime}</div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width='18' height='18' viewBox='0 0 24 24' fill='white'>
              <path d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' />
            </svg>
          </button>
        </div>

        {/* Video Player */}
        <MuxPlayer
          key={currentVideo?.playbackId} // Force remount on video change
          ref={playerRef}
          playbackId={currentVideo?.playbackId}
          streamType='on-demand'
          autoPlay
          muted={false}
          loop={false}
          style={{
            width: '100%',
            height: isHorizontal ? 'auto' : '100%',
            maxHeight: '100%',
            '--controls': 'none',
            // Vertical: cover to fill screen like stories, Horizontal: contain to show full video
            '--media-object-fit': isHorizontal ? 'contain' : 'cover',
          }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={goNext}
        />

        {/* Tap zones for navigation */}
        <div
          onClick={handleTapZone}
          style={{
            position: 'absolute',
            inset: 0,
            top: isHorizontal ? '60px' : '80px', // Below header
            bottom: isHorizontal ? '20px' : '0',
            zIndex: 5,
          }}
        />

        {/* 2x Speed zone - compact top right area */}
        <div
          ref={speedZoneRef}
          onTouchStart={handleSpeedStart}
          onTouchEnd={handleSpeedEnd}
          onTouchCancel={handleSpeedEnd}
          onMouseDown={handleSpeedStart}
          onMouseUp={handleSpeedEnd}
          onMouseLeave={handleSpeedEnd}
          style={{
            position: 'absolute',
            top: '70px',
            right: '10px',
            width: '80px',
            height: '80px',
            zIndex: 6,
            borderRadius: '12px',
            // Uncomment to debug: background: 'rgba(255, 0, 0, 0.2)',
          }}
        />

        {/* 2x Speed indicator - top right */}
        {isSpeedUp && (
          <div
            style={{
              position: 'absolute',
              top: '75px',
              right: '16px',
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '16px',
              fontSize: '14px',
              fontWeight: 'bold',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ⚡ 2x
          </div>
        )}

        {/* Viewers display - bottom left */}
        {viewers.length > 0 && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              setShowViewersModal(true)
            }}
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              zIndex: 10,
              background: 'rgba(0, 0, 0, 0.5)',
              padding: '8px 12px',
              borderRadius: '20px',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Stacked avatars */}
            <div style={{ display: 'flex', marginLeft: '4px' }}>
              {viewers.slice(0, 3).map((viewer, idx) => (
                <div
                  key={viewer.id}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '2px solid #000',
                    marginLeft: idx > 0 ? '-8px' : '0',
                    overflow: 'hidden',
                    background: '#333',
                    zIndex: 3 - idx,
                  }}
                >
                  {viewer.viewerPhotoURL ? (
                    <img
                      src={viewer.viewerPhotoURL}
                      alt={viewer.viewerName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 600,
                        color: '#fff',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      }}
                    >
                      {viewer.viewerName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <span style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>
              {viewers.length === 1
                ? '1 view'
                : `${viewers.length} views`}
            </span>
          </div>
        )}
      </div>

      {/* Viewers Modal */}
      {showViewersModal && (
        <div
          onClick={() => setShowViewersModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1e1e2f',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '320px',
              maxHeight: '60vh',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
                Viewed by
              </h3>
              <button
                onClick={() => setShowViewersModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '20px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Viewers list */}
            <div
              style={{
                padding: '8px 0',
                maxHeight: 'calc(60vh - 60px)',
                overflowY: 'auto',
              }}
            >
              {viewers.map((viewer) => (
                <div
                  key={viewer.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 20px',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: '#333',
                      flexShrink: 0,
                    }}
                  >
                    {viewer.viewerPhotoURL ? (
                      <img
                        src={viewer.viewerPhotoURL}
                        alt={viewer.viewerName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          fontWeight: 600,
                          color: '#fff',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        }}
                      >
                        {viewer.viewerName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {viewer.viewerName || 'Unknown'}
                    </div>
                    {viewer.viewedAt && (
                      <div style={{ color: '#888', fontSize: '12px' }}>
                        {new Date(viewer.viewedAt?.seconds * 1000).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
          }
        }
      `}</style>
    </div>,
    document.body
  )
}
