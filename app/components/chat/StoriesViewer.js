'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Stories from 'react-insta-stories'

export default function StoriesViewer({ 
  isOpen, 
  onClose, 
  videos = [], // Array of { playbackId, sender, timestamp }
  initialIndex = 0 
}) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || videos.length === 0) return null

  // Transform videos to react-insta-stories format
  const stories = videos.map(video => ({
    url: `https://stream.mux.com/${video.playbackId}/high.mp4`,
    type: 'video',
    header: {
      heading: video.sender || 'Video Reply',
      subheading: video.timestamp 
        ? new Date(video.timestamp?.seconds * 1000).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
          })
        : '',
      profileImage: '', // Could add user avatar here
    },
    preloadResource: true,
  }))

  return createPortal(
    <div 
      className="stories-viewer-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '400px',
          height: '100%',
          maxHeight: '100vh',
        }}
      >
        {/* Close button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 10001,
            background: 'rgba(0, 0, 0, 0.5)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>

        <Stories
          stories={stories}
          currentIndex={initialIndex}
          defaultInterval={15000}
          width="100%"
          height="100%"
          onAllStoriesEnd={onClose}
          onStoryEnd={() => {}}
          storyContainerStyles={{
            borderRadius: '12px',
            overflow: 'hidden',
          }}
          storyStyles={{
            objectFit: 'contain',
          }}
          progressContainerStyles={{
            padding: '10px 10px 0',
          }}
          progressStyles={{
            background: 'rgba(255, 255, 255, 0.5)',
          }}
          progressWrapperStyles={{
            background: 'rgba(255, 255, 255, 0.3)',
          }}
          loop={false}
          keyboardNavigation={true}
          isPaused={false}
        />
      </div>
    </div>,
    document.body
  )
}
