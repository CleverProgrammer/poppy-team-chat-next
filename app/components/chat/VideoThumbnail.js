'use client'

import { useState, useEffect } from 'react'

export default function VideoThumbnail({
  playbackId,
  onClick,
  isReply = false,
  onLoad,
}) {
  const [isVertical, setIsVertical] = useState(true) // Default to vertical
  const [loaded, setLoaded] = useState(false)

  // Detect orientation by loading thumbnail and checking dimensions
  // Only for regular videos (not replies) - replies are always vertical story-style
  useEffect(() => {
    if (!playbackId) return

    // For replies, skip detection - always use vertical style
    if (isReply) {
      setLoaded(true)
      return
    }

    const img = new Image()
    img.onload = () => {
      setIsVertical(img.naturalHeight > img.naturalWidth)
      setLoaded(true)
    }
    img.onerror = () => {
      setIsVertical(false) // Default to horizontal on error for regular videos
      setLoaded(true)
    }
    // Use static thumbnail for faster loading and dimension detection
    img.src = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`
  }, [playbackId, isReply])

  // Get the appropriate animated GIF URL
  const getAnimatedUrl = () => {
    // Replies always use vertical-optimized GIF
    if (isReply) {
      return `https://image.mux.com/${playbackId}/animated.gif?start=0&end=4&height=200&fps=12`
    }
    // Regular videos use orientation-based sizing
    if (isVertical) {
      return `https://image.mux.com/${playbackId}/animated.gif?start=0&end=4&height=200&fps=12`
    } else {
      return `https://image.mux.com/${playbackId}/animated.gif?start=0&end=4&width=200&fps=12`
    }
  }

  // Determine classes based on orientation and type
  const getBubbleClass = () => {
    if (isReply) {
      return 'video-reply-bubble' // Always vertical style for replies
    }
    return `video-thumbnail-bubble ${isVertical ? 'vertical' : 'horizontal'}`
  }

  const getImgClass = () => {
    return isReply ? 'video-reply-thumbnail' : 'video-thumbnail-img'
  }

  const getPlayClass = () => {
    return isReply ? 'video-reply-play' : 'video-thumbnail-play'
  }

  // Show loading state while detecting orientation (only for non-replies)
  if (!loaded) {
    return (
      <div className={`${isReply ? 'video-reply-bubble' : 'video-thumbnail-bubble'} loading`}>
        <div className='video-thumbnail-loading'>
          <div className='loading-shimmer' />
        </div>
      </div>
    )
  }

  return (
    <div className={getBubbleClass()} onClick={onClick}>
      <img
        src={getAnimatedUrl()}
        alt='Video'
        className={getImgClass()}
        onLoad={onLoad}
      />
      <div className={getPlayClass()}>
        <svg 
          width={isReply ? '24' : '28'} 
          height={isReply ? '24' : '28'} 
          viewBox='0 0 24 24' 
          fill='white'
        >
          <path d='M8 5v14l11-7z' />
        </svg>
      </div>
      {isReply && <div className='video-reply-badge'>🎬</div>}
    </div>
  )
}

