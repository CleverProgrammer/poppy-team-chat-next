'use client'

import { useState } from 'react'
import StoriesViewer from './StoriesViewer'
import { useDMStories } from '../../hooks/useDMStories'

/**
 * A wrapper component that adds an Instagram-style story ring around a DM user avatar
 * 
 * Privacy logic:
 * - Only shows the story ring if the OTHER user has sent videos TO the current user
 * - If Rachel sends a video to Rafeh, only Rafeh sees the ring on Rachel's avatar
 * - This creates private stories that only the intended recipient can see
 * 
 * @param {string} currentUserId - The current logged-in user's ID
 * @param {string} otherUserId - The other user in the DM conversation
 * @param {React.ReactNode} children - The avatar component to wrap
 * @param {string} size - Size variant: 'small' | 'medium' | 'large'
 * @param {string} className - Additional CSS classes
 * @param {function} onClick - Optional callback when ring is clicked
 */
export default function DMStoryRing({
  currentUserId,
  otherUserId,
  children,
  size = 'medium',
  className = '',
  onClick,
}) {
  const [storiesOpen, setStoriesOpen] = useState(false)
  const { stories, hasStories, getStoriesForViewer } = useDMStories(currentUserId, otherUserId)

  // Show ring if this DM has stories (videos sent TO current user by other user)
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
