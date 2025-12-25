'use client'

import { useState } from 'react'
import StoriesViewer from './StoriesViewer'
import { useChannelStories } from '../../hooks/useChannelStories'

/**
 * A wrapper component that adds an Instagram-style story ring around a channel avatar
 * When clicked (if stories exist), it opens the StoriesViewer
 * Shows colorful gradient ring for unviewed stories, gray ring for all viewed
 */
export default function ChannelStoryRing({
  channelId = 'general',
  currentUser = null, // Current user object { uid, displayName, photoURL }
  children,
  size = 'medium', // 'small' | 'medium' | 'large'
  className = '',
  onClick, // Optional callback when ring is clicked
}) {
  const [storiesOpen, setStoriesOpen] = useState(false)
  const {
    stories,
    hasStories,
    hasUnviewedStories,
    firstUnviewedIndex,
    getStoriesForViewer
  } = useChannelStories(channelId, currentUser?.uid)

  // Show ring for any channel that has stories
  const showRing = hasStories

  // Determine if ring should be gray (all stories viewed) or colorful (has unviewed)
  const isAllViewed = hasStories && !hasUnviewedStories

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
        className={`channel-story-ring-wrapper ${showRing ? 'has-stories' : ''} ${isAllViewed ? 'all-viewed' : ''} ${getRingSize()} ${className}`}
        onClick={showRing ? handleClick : undefined}
        style={{ cursor: showRing ? 'pointer' : 'default' }}
      >
        {showRing && <div className={`story-ring-gradient ${isAllViewed ? 'viewed' : ''}`} />}
        <div className="story-ring-content">
          {children}
        </div>
      </div>

      {/* Stories Viewer */}
      <StoriesViewer
        isOpen={storiesOpen}
        onClose={handleCloseStories}
        videos={getStoriesForViewer()}
        initialIndex={firstUnviewedIndex}
        chatType="channel"
        chatId={channelId}
        currentUser={currentUser}
      />
    </>
  )
}
