'use client'

import { useState, useEffect } from 'react'
import StoriesViewer from './StoriesViewer'
import { useMyStories } from '../../hooks/useMyStories'

/**
 * A wrapper component that adds an Instagram-style story ring around the current user's avatar
 * Shows their own videos from the last 24 hours so they can review them and see view counts
 *
 * Features:
 * - Shows a ring if the user has made any videos today (channel or DM)
 * - Ring is always colorful (their own content, not about viewed/unviewed)
 * - Clicking opens the StoriesViewer to see their videos and view counts
 *
 * @param {object} currentUser - Current user object { uid, displayName, photoURL }
 * @param {string[]} activeDMIds - Array of active DM conversation IDs
 * @param {React.ReactNode} children - The avatar component to wrap
 * @param {string} size - Size variant: 'small' | 'medium' | 'large'
 * @param {string} className - Additional CSS classes
 * @param {function} onClick - Optional callback when ring is clicked
 */
export default function MyStoriesRing({
  currentUser,
  activeDMIds = [],
  children,
  size = 'medium',
  className = '',
  onClick,
}) {
  const [storiesOpen, setStoriesOpen] = useState(false)
  const [currentStoryContext, setCurrentStoryContext] = useState({ chatType: 'channel', chatId: 'general' })
  const {
    stories,
    hasStories,
    getStoriesForViewer,
  } = useMyStories(currentUser?.uid, ['general', 'dev-gang', 'test'], activeDMIds)

  const showRing = hasStories

  const handleClick = e => {
    if (hasStories) {
      e.stopPropagation()
      // Set the context to the first story's chat
      if (stories.length > 0) {
        setCurrentStoryContext({
          chatType: stories[0].chatType,
          chatId: stories[0].chatId,
        })
      }
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
        className={`channel-story-ring-wrapper ${showRing ? 'has-stories my-stories' : ''} ${getRingSize()} ${className}`}
        onClick={showRing ? handleClick : undefined}
        style={{ cursor: showRing ? 'pointer' : 'default' }}
      >
        {showRing && <div className="story-ring-gradient my-story-ring" />}
        <div className="story-ring-content">
          {children}
        </div>
      </div>

      {/* Stories Viewer - shows user's own stories with view counts */}
      <StoriesViewer
        isOpen={storiesOpen}
        onClose={handleCloseStories}
        videos={getStoriesForViewer()}
        initialIndex={0}
        chatType={currentStoryContext.chatType}
        chatId={currentStoryContext.chatId}
        currentUser={currentUser}
      />
    </>
  )
}

