'use client'

import { useState, useEffect, useRef } from 'react'
import ChannelStoryRing from '../chat/ChannelStoryRing'
import DMStoryRing from '../chat/DMStoryRing'

/**
 * PinnedGrid - A 3x3 grid of pinned chats (DMs, groups, channels)
 * Displays at the top of the sidebar for quick access
 */
export default function PinnedGrid({
  pinnedItems = [],
  currentChat,
  onSelectChat,
  onUnpin,
  allUsers = [],
  groups = [],
  user,
  unreadChats = [],
}) {
  const [contextMenu, setContextMenu] = useState(null)
  const contextMenuRef = useRef(null)

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Handle right-click on pinned item
  const handleContextMenu = (e, item) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
    })
  }

  // Handle clicking on a pinned item
  const handleClick = (item) => {
    if (item.type === 'channel') {
      onSelectChat({ type: 'channel', id: item.id, name: item.name })
    } else if (item.type === 'dm') {
      const dmUser = allUsers.find(u => u.uid === item.id)
      onSelectChat({
        type: 'dm',
        id: item.id,
        name: item.name,
        user: dmUser,
      })
    } else if (item.type === 'group') {
      const group = groups.find(g => g.id === item.id)
      onSelectChat({
        type: 'group',
        id: item.id,
        name: item.name,
        group: group,
      })
    }
  }

  // Sort items by position for the grid
  const sortedItems = [...pinnedItems].sort((a, b) => a.position - b.position)

  // Create grid with 9 slots (3x3)
  const gridSlots = Array(9).fill(null)
  sortedItems.forEach(item => {
    if (item.position >= 0 && item.position < 9) {
      gridSlots[item.position] = item
    }
  })

  // Check if grid has any items
  if (pinnedItems.length === 0) {
    return null
  }

  // Render a single pinned item (skip empty slots for iMessage-like appearance)
  const renderPinnedItem = (item, index) => {
    if (!item) {
      return null // Don't render empty slots - iMessage style
    }

    const isActive = 
      currentChat?.type === item.type && 
      currentChat?.id === item.id

    const isUnread = 
      unreadChats.includes(`${item.type}:${item.id}`)

    // Get avatar content based on type
    let avatarContent = null
    let storyRingWrapper = null

    if (item.type === 'channel') {
      avatarContent = (
        <div className="pinned-avatar-fallback channel-avatar">
          #
        </div>
      )
      storyRingWrapper = (
        <ChannelStoryRing channelId={item.id} size="small" currentUser={user}>
          {avatarContent}
        </ChannelStoryRing>
      )
    } else if (item.type === 'dm') {
      const dmUser = allUsers.find(u => u.uid === item.id)
      const photoURL = dmUser?.photoURL || item.photoURL
      
      avatarContent = photoURL ? (
        <img src={photoURL} alt={item.name} className="pinned-avatar" />
      ) : (
        <div className="pinned-avatar-fallback">
          {(item.name || '?')[0].toUpperCase()}
        </div>
      )
      
      storyRingWrapper = (
        <DMStoryRing
          currentUserId={user?.uid}
          otherUserId={item.id}
          currentUser={user}
          size="small"
        >
          {avatarContent}
        </DMStoryRing>
      )
    } else if (item.type === 'group') {
      const group = groups.find(g => g.id === item.id)
      const photoURL = group?.photoURL || item.photoURL
      
      if (photoURL && photoURL.length <= 4) {
        // Emoji
        avatarContent = (
          <div className="pinned-avatar-fallback group-emoji-avatar">
            {photoURL}
          </div>
        )
      } else if (photoURL) {
        avatarContent = (
          <img src={photoURL} alt={item.name} className="pinned-avatar" />
        )
      } else {
        // Show stacked member avatars
        const memberAvatars = group?.memberAvatars?.slice(0, 3) || []
        if (memberAvatars.length > 0) {
          avatarContent = (
            <div className="pinned-group-avatars">
              {memberAvatars.map((avatar, idx) => (
                avatar ? (
                  <img 
                    key={idx}
                    src={avatar} 
                    alt="Member" 
                    className="pinned-group-avatar-mini"
                    style={{ 
                      zIndex: 3 - idx,
                      marginLeft: idx > 0 ? '-6px' : '0'
                    }}
                  />
                ) : null
              ))}
            </div>
          )
        } else {
          avatarContent = (
            <div className="pinned-avatar-fallback group-avatar">
              👥
            </div>
          )
        }
      }
      storyRingWrapper = avatarContent
    }

    // Get display name (truncated)
    const displayName = item.name || 'Unknown'
    const truncatedName = displayName.length > 12 
      ? displayName.substring(0, 10) + '...' 
      : displayName

    // Check for status badge (like the ones in the image)
    const statusBadge = item.statusBadge || null

    return (
      <div
        key={`${item.type}-${item.id}`}
        className={`pinned-grid-slot ${isActive ? 'active' : ''}`}
        onClick={() => handleClick(item)}
        onContextMenu={(e) => handleContextMenu(e, item)}
      >
        {isUnread && <div className="pinned-unread-dot" />}
        
        <div className="pinned-avatar-container">
          {storyRingWrapper}
          {statusBadge && (
            <div className="pinned-status-badge">
              {statusBadge}
            </div>
          )}
        </div>
        
        <span className="pinned-name">{truncatedName}</span>
      </div>
    )
  }

  return (
    <div className="pinned-grid-container">
      <div className="pinned-grid">
        {gridSlots.map((item, index) => renderPinnedItem(item, index))}
      </div>

      {/* Context menu for unpinning */}
      {contextMenu && (
        <div 
          ref={contextMenuRef}
          className="pinned-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            className="pinned-context-menu-item"
            onClick={() => {
              onUnpin(contextMenu.item.type, contextMenu.item.id)
              setContextMenu(null)
            }}
          >
            📌 Unpin
          </button>
        </div>
      )}
    </div>
  )
}

