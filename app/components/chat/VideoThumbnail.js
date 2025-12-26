'use client'

import { useState, useEffect, useRef } from 'react'
import SkeletonView from './SkeletonView'
import { cn } from '../../utils/cn'

// Maximum dimensions for video thumbnails
const MAX_VIDEO_WIDTH = 240
const MAX_VIDEO_HEIGHT = 280

export default function VideoThumbnail({
  playbackId,
  onClick,
  isReply = false,
  // Pre-stored dimensions from upload (prevents layout shift)
  width: storedWidth,
  height: storedHeight,
  // For on-demand migration of old videos without dimensions
  onDimensionsMigrate,
  videoIndex = 0,
}) {
  // Calculate initial values from props to avoid cascading renders
  const hasStoredDimensions = !!(storedWidth && storedHeight)
  const initialVertical = hasStoredDimensions ? storedHeight > storedWidth : true
  
  const [loaded, setLoaded] = useState(false)
  const [isVertical, setIsVertical] = useState(initialVertical)
  const [dimensions, setDimensions] = useState(
    hasStoredDimensions ? { width: storedWidth, height: storedHeight } : null
  )
  
  // Track if migration has been called to avoid duplicates
  const migrationCalledRef = useRef(false)

  // For replies, we don't need dimensions - they have fixed styling
  // For regular videos without stored dimensions, detect from thumbnail
  useEffect(() => {
    if (!playbackId || isReply || hasStoredDimensions) return

    // Fallback: detect dimensions from thumbnail
    const img = new Image()
    img.onload = () => {
      const newDimensions = { width: img.naturalWidth, height: img.naturalHeight }
      setIsVertical(img.naturalHeight > img.naturalWidth)
      setDimensions(newDimensions)
      
      // On-demand migration: notify parent about detected dimensions
      if (!migrationCalledRef.current && onDimensionsMigrate) {
        migrationCalledRef.current = true
        onDimensionsMigrate(videoIndex, newDimensions)
      }
    }
    img.onerror = () => {
      setIsVertical(false)
    }
    img.src = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`
  }, [playbackId, isReply, hasStoredDimensions, onDimensionsMigrate, videoIndex])

  // Get the appropriate animated GIF URL
  const getAnimatedUrl = () => {
    if (isReply) {
      return `https://image.mux.com/${playbackId}/animated.gif?start=0&end=4&height=200&fps=12`
    }
    if (isVertical) {
      return `https://image.mux.com/${playbackId}/animated.gif?start=0&end=4&height=200&fps=12`
    } else {
      return `https://image.mux.com/${playbackId}/animated.gif?start=0&end=4&width=200&fps=12`
    }
  }

  const handleLoad = () => {
    setLoaded(true)
  }

  // Reply-style videos have their own fixed layout
  if (isReply) {
    return (
      <div className='video-reply-bubble' onClick={onClick}>
        <img
          src={getAnimatedUrl()}
          alt='Video'
          className='video-reply-thumbnail'
          onLoad={handleLoad}
        />
        <div className='video-reply-play'>
          <svg width='24' height='24' viewBox='0 0 24 24' fill='white'>
            <path d='M8 5v14l11-7z' />
          </svg>
        </div>
        <div className='video-reply-badge'>🎬</div>
      </div>
    )
  }

  // Calculate actual display width to prevent flex collapse
  const displayWidth = dimensions
    ? Math.min(MAX_VIDEO_WIDTH, dimensions.width)
    : MAX_VIDEO_WIDTH

  // Regular videos use SkeletonView with parent max-width and max-height
  return (
    <div 
      className={cn('rounded-xl overflow-hidden cursor-pointer relative')}
      style={{ width: displayWidth, maxWidth: MAX_VIDEO_WIDTH, maxHeight: MAX_VIDEO_HEIGHT }}
      onClick={onClick}
    >
      <SkeletonView
        width={dimensions?.width}
        height={dimensions?.height}
        loaded={loaded}
      >
        <img
          src={getAnimatedUrl()}
          alt='Video'
          className='w-full h-full object-cover block'
          onLoad={handleLoad}
        />
        <div className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'bg-black/50 rounded-full w-12 h-12',
          'flex items-center justify-center pointer-events-none'
        )}>
          <svg width='28' height='28' viewBox='0 0 24 24' fill='white'>
            <path d='M8 5v14l11-7z' />
          </svg>
        </div>
      </SkeletonView>
    </div>
  )
}
