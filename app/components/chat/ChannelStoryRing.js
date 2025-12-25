'use client'

import { useState } from 'react'
import StoriesViewer from './StoriesViewer'
import { useChannelStories } from '../../hooks/useChannelStories'

/**
 * A wrapper component that adds an Instagram-style story ring around a channel avatar
 * When clicked (if stories exist), it opens the StoriesViewer
 */
export default function ChannelStoryRing({
  channelId = 'general',
  children,
  size = 'medium', // 'small' | 'medium' | 'large'
  className = '',
  onClick, // Optional callback when ring is clicked
}) {
  const [storiesOpen, setStoriesOpen] = useState(false)
  const { stories, hasStories, getStoriesForViewer } = useChannelStories(channelId)

  // Show ring for any channel that has stories
  const showRing = hasStories

  const handleClick = e => {
    if (hasStories) {
      e.stopPropagation()
      setStoriesOpen(true)
      onClick?.()
    }
  }

  const handleCloseStories = () => {
    setStoriesOpen(false)
  }

  // Get ring size based on prop
  const getRingSize = () => {
    switch (size) {
      case 'small':
        return 'story-ring-small'
      case 'large':
        return 'story-ring-large'
      default:
        return 'story-ring-medium'
    }
  }

  return (
    <>
      <div
        className={`channel-story-ring-wrapper ${showRing ? 'has-stories' : ''} ${getRingSize()} ${className}`}
        onClick={showRing ? handleClick : undefined}
        style={{ cursor: showRing ? 'pointer' : 'default' }}
      >
        {showRing && <div className="story-ring-gradient" />}
        <div className="story-ring-content">
          {children}
        </div>
      </div>

      {/* Stories Viewer */}
      <StoriesViewer
        isOpen={storiesOpen}
        onClose={handleCloseStories}
        videos={getStoriesForViewer()}
        initialIndex={0}
      />
    </>
  )
}
