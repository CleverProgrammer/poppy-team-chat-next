'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useDevMode } from '../../contexts/DevModeContext'
import SignOutButton from '../auth/SignOutButton'
import ChannelStoryRing from '../chat/ChannelStoryRing'
import DMStoryRing from '../chat/DMStoryRing'
import MyStoriesRing from '../chat/MyStoriesRing'
import MyTasksModal from '../profile/MyTasksModal'

export default function Sidebar({
  currentChat,
  onSelectChat,
  activeDMs = [],
  allUsers = [],
  unreadChats = [],
  lastMessages = {},
  channelLastMessages = {},
  groupLastMessages = {},
  groups = [],
  aiLastMessage = null,
  isOpen = false,
  onOpenSearch,
  onCreateGroup,
}) {
  const { user, setPasswordForAccount } = useAuth()
  const { isDevMode, toggleDevMode, canAccessDevMode } = useDevMode()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showMyTasks, setShowMyTasks] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const menuRef = useRef(null)
  const sidebarRef = useRef(null)
  
  const COLLAPSED_WIDTH = 72
  const MIN_EXPANDED_WIDTH = 260
  const COLLAPSE_THRESHOLD = 150

  // Handle sidebar resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return
      const newWidth = e.clientX
      
      // If dragging below threshold, collapse
      if (newWidth < COLLAPSE_THRESHOLD) {
        setIsCollapsed(true)
        setSidebarWidth(COLLAPSED_WIDTH)
      } else {
        // Expanding from collapsed or normal resize
        setIsCollapsed(false)
        const clampedWidth = Math.max(MIN_EXPANDED_WIDTH, Math.min(500, newWidth))
        setSidebarWidth(clampedWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])
  
  // Double-click to toggle collapse
  const handleDoubleClick = () => {
    if (isCollapsed) {
      setIsCollapsed(false)
      setSidebarWidth(320)
    } else {
      setIsCollapsed(true)
      setSidebarWidth(COLLAPSED_WIDTH)
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSetPassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setSettingPassword(true)
    try {
      await setPasswordForAccount(password)
      setPasswordSuccess(
        'Password set! You can now log in with email & password.'
      )
      setPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        setShowPasswordModal(false)
        setPasswordSuccess('')
      }, 2000)
    } catch (error) {
      if (error.code === 'auth/provider-already-linked') {
        setPasswordError('You already have a password set for this account')
      } else {
        setPasswordError(error.message || 'Failed to set password')
      }
    } finally {
      setSettingPassword(false)
    }
  }

  const handleChannelClick = (channelId, channelName) => {
    onSelectChat({ type: 'channel', id: channelId, name: channelName || channelId })
  }

  const handleDMClick = dmUser => {
    onSelectChat({
      type: 'dm',
      id: dmUser.uid,
      name: dmUser.displayName || dmUser.email,
      user: dmUser,
    })
  }

  const handleGroupClick = group => {
    onSelectChat({
      type: 'group',
      id: group.id,
      name: group.displayName || group.name || 'Group Chat',
      group: group,
    })
  }

  // Format timestamp for sidebar (iMessage style)
  const formatTimestamp = timestamp => {
    if (!timestamp) return ''
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      // Within a week - show day name
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      // Older - show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  // Get preview text for a message (allow 2 lines worth)
  const getPreviewText = (message, dmUserId) => {
    if (!message) return 'No messages yet'
    
    if (message.imageUrl || message.imageUrls?.length > 0) {
      const imageCount = message.imageUrls?.length || 1
      const photoLabel = imageCount > 1 ? 'Photos' : 'Photo'
      
      // Try to extract TLDR from imageAnalysis
      if (message.imageAnalysis) {
        const tldrMatch = message.imageAnalysis.match(/tldr:\s*(.+?)(?:\n|$)/i)
        if (tldrMatch) {
          const tldr = tldrMatch[1].trim()
          const maxLength = 60
          const truncatedTldr = tldr.length > maxLength ? tldr.substring(0, maxLength) + '...' : tldr
          return `✨ ${photoLabel}: ${truncatedTldr}`
        }
      }
      
      // Fallback if no analysis yet
      return `📷 ${imageCount} ${photoLabel}`
    }
    
    // Audio/Voice messages - show TLDR if available
    if (message.audioUrl) {
      if (message.transcription?.tldr) {
        const maxLength = 60
        const tldr = message.transcription.tldr
        const truncatedTldr = tldr.length > maxLength ? tldr.substring(0, maxLength) + '...' : tldr
        return `✨ 🎙️ ${truncatedTldr}`
      }
      // Fallback if no transcription yet
      return '🎙️ Voice message'
    }
    
    if (message.muxPlaybackIds?.length > 0) {
      return 'Video message'
    }
    
    const text = message.text || ''
    const maxLength = 80 // Allow more text for 2 lines
    const truncated = text.length > maxLength ? text.substring(0, maxLength) + '...' : text
    return truncated
  }

  // Sort DMs by most recent message
  // Use Date.now() / 1000 as fallback for messages without timestamp (being sent)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const sortedDMs = [...activeDMs].sort((a, b) => {
    const msgA = lastMessages[a]
    const msgB = lastMessages[b]
    
    // If no timestamp yet (message being sent), treat as "right now"
    const timeA = msgA?.timestamp?.seconds ?? (msgA ? nowSeconds : 0)
    const timeB = msgB?.timestamp?.seconds ?? (msgB ? nowSeconds : 0)
    
    return timeB - timeA // Most recent first
  })

  // Compute active DM IDs for MyStoriesRing (sorted user ID pairs)
  const activeDMIds = useMemo(() => {
    if (!user?.uid) return []
    return activeDMs.map(otherUserId => {
      return [user.uid, otherUserId].sort().join('_')
    })
  }, [user?.uid, activeDMs])

  // Collapsed view - only show avatars (but NOT on mobile when sidebar is open)
  // On mobile, isOpen means full-screen sidebar, so never show collapsed
  if (isCollapsed && !isOpen) {
    return (
      <div 
        ref={sidebarRef}
        className={`sidebar sidebar-collapsed ${isOpen ? 'open' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ width: `${COLLAPSED_WIDTH}px` }}
      >
        {/* Resize Handle */}
        <div 
          className="sidebar-resize-handle"
          onMouseDown={() => setIsResizing(true)}
          onDoubleClick={handleDoubleClick}
        />
        
        {/* User avatar with story ring if user has posted videos today */}
        <div className="collapsed-item" onClick={() => setShowUserMenu(!showUserMenu)}>
          <MyStoriesRing
            currentUser={user}
            activeDMIds={activeDMIds}
            size="medium"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt='Profile' className='collapsed-avatar' />
            ) : (
              <div className='collapsed-avatar-fallback'>
                {(user?.displayName || user?.email || '?')[0].toUpperCase()}
              </div>
            )}
          </MyStoriesRing>
        </div>
        
        {/* Divider - separates user profile from conversations */}
        <div className="collapsed-divider" />
        
        {/* Channels */}
        {[
          { id: 'general', name: 'general' },
          { id: 'dev-gang', name: 'Dev Gang 💯' },
          { id: 'test', name: 'test' }
        ].map(channel => {
          const channelId = channel.id
          const isActive = currentChat?.type === 'channel' && currentChat?.id === channelId
          const isUnread = unreadChats.includes(`channel:${channelId}`)
          
          const avatarContent = (
            <div className='collapsed-avatar-fallback channel-avatar'>
              #
            </div>
          )
          
          return (
            <div
              key={`channel-${channelId}`}
              className={`collapsed-item ${isActive ? 'active' : ''}`}
              onClick={() => handleChannelClick(channelId, channel.name)}
            >
              {isUnread && <div className="collapsed-unread-dot" />}
              <ChannelStoryRing channelId={channelId} size="medium" currentUser={user}>
                {avatarContent}
              </ChannelStoryRing>
            </div>
          )
        })}
        
        {/* Poppy AI */}
        <div 
          className={`collapsed-item ${currentChat?.type === 'ai' ? 'active' : ''}`}
          onClick={() => onSelectChat({ type: 'ai', id: 'poppy-ai', name: 'Poppy AI' })}
        >
          <img src="/poppy-icon.png" alt="Poppy" className='collapsed-avatar' />
        </div>
        
        {/* DM avatars */}
        {sortedDMs.map(dmUserId => {
          const dmUser = allUsers.find(u => u.uid === dmUserId)
          if (!dmUser) return null
          
          const isActive = currentChat?.type === 'dm' && currentChat?.id === dmUserId
          const isUnread = unreadChats.includes(`dm:${dmUserId}`)
          
          const avatarContent = dmUser.photoURL ? (
            <img src={dmUser.photoURL} alt={dmUser.displayName} className='collapsed-avatar' />
          ) : (
            <div className='collapsed-avatar-fallback'>
              {(dmUser.displayName || dmUser.email || '?')[0].toUpperCase()}
            </div>
          )
          
          return (
            <div
              key={dmUserId}
              className={`collapsed-item ${isActive ? 'active' : ''}`}
              onClick={() => handleDMClick(dmUser)}
            >
              {isUnread && <div className="collapsed-unread-dot" />}
              <DMStoryRing
                currentUserId={user?.uid}
                otherUserId={dmUserId}
                currentUser={user}
                size="medium"
              >
                {avatarContent}
              </DMStoryRing>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div 
      ref={sidebarRef}
      className={`sidebar ${isOpen ? 'open' : ''} ${isResizing ? 'resizing' : ''}`}
      style={isOpen ? {} : { width: `${sidebarWidth}px` }}
    >
      {/* Resize Handle */}
      <div 
        className="sidebar-resize-handle"
        onMouseDown={() => setIsResizing(true)}
        onDoubleClick={handleDoubleClick}
      />
      {/* Sidebar Header - User Profile */}
      <div className='sidebar-header' ref={menuRef}>
        <div
          className='user-panel-clickable'
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <MyStoriesRing
            currentUser={user}
            activeDMIds={activeDMIds}
            size="small"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt='Profile' className='header-avatar' />
            ) : (
              <div className='header-avatar header-avatar-fallback'>
                {(user?.displayName || user?.email || '?')[0].toUpperCase()}
              </div>
            )}
          </MyStoriesRing>
          <div className='user-panel-info'>
            <div className='user-panel-name'>
              {user?.displayName || user?.email}
            </div>
            <div className='user-panel-status'>Online</div>
          </div>
        </div>

        {/* User Menu Dropdown */}
        {showUserMenu && (
          <div className='user-menu user-menu-header'>
            <button
              className='user-menu-item'
              onClick={() => {
                setShowMyTasks(true)
                setShowUserMenu(false)
              }}
            >
              📋 My Tasks
            </button>
            <button
              className='user-menu-item'
              onClick={() => {
                setShowPasswordModal(true)
                setShowUserMenu(false)
              }}
            >
              Set Password
            </button>
            {canAccessDevMode && (
              <button
                className='user-menu-item'
                onClick={() => {
                  toggleDevMode()
                  setShowUserMenu(false)
                }}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  fontSize: '12px',
                  opacity: 0.7
                }}
              >
                <span>🛠️ Dev Mode</span>
                <span style={{ 
                  fontSize: '10px', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  background: isDevMode ? '#22c55e' : '#374151',
                  color: isDevMode ? '#fff' : '#9ca3af'
                }}>
                  {isDevMode ? 'ON' : 'OFF'}
                </span>
              </button>
            )}
            <SignOutButton />
          </div>
        )}
      </div>

      {/* Search & New Chat Button - Mobile friendly */}
      <div className='sidebar-search-bar' onClick={onOpenSearch}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span>Search or start new chat</span>
      </div>

      {/* All Conversations - iMessage Style */}
      <div className='sidebar-section dm-section'>
        {/* Channels */}
        {[
          { id: 'general', name: 'general' },
          { id: 'dev-gang', name: 'Dev Gang 💯' },
          { id: 'test', name: 'test' }
        ].map(channel => {
          const channelId = channel.id
          const isActive = currentChat?.type === 'channel' && currentChat?.id === channelId
          const isUnread = unreadChats.includes(`channel:${channelId}`)
          const lastMsg = channelLastMessages[channelId]
          
          const avatarContent = (
            <div className='dm-avatar-fallback channel-avatar'>
              #
            </div>
          )
          
          return (
            <div
              key={`channel-${channelId}`}
              className={`dm-item-imessage ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
              onClick={() => handleChannelClick(channelId, channel.name)}
            >
              <div className={`dm-unread-dot ${isUnread ? 'visible' : ''}`} />
              
              <div className='dm-avatar-container'>
                <ChannelStoryRing channelId={channelId} size="small" currentUser={user}>
                  {avatarContent}
                </ChannelStoryRing>
              </div>
              
              <div className='dm-content'>
                <div className='dm-header-row'>
                  <span className='dm-name'>#{channel.name}</span>
                  <span className='dm-timestamp'>{formatTimestamp(lastMsg?.timestamp)}</span>
                </div>
                <div className='dm-preview'>
                  {getPreviewText(lastMsg)}
                </div>
              </div>
            </div>
          )
        })}
        
        {/* Poppy AI */}
        {(() => {
          const isActive = currentChat?.type === 'ai'
          const isUnread = unreadChats.includes('ai:poppy-ai')
          
          return (
            <div
              className={`dm-item-imessage ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
              onClick={() => onSelectChat({ type: 'ai', id: 'poppy-ai', name: 'Poppy AI' })}
            >
              <div className={`dm-unread-dot ${isUnread ? 'visible' : ''}`} />
              
              <div className='dm-avatar-container'>
                <img src="/poppy-icon.png" alt="Poppy" className='dm-avatar' />
              </div>
              
              <div className='dm-content'>
                <div className='dm-header-row'>
                  <span className='dm-name'>Poppy AI</span>
                  <span className='dm-timestamp'>{formatTimestamp(aiLastMessage?.timestamp)}</span>
                </div>
                <div className='dm-preview'>
                  {aiLastMessage ? (aiLastMessage.content?.substring(0, 80) || '') : 'Chat with AI assistant'}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Groups Section */}
        {groups.length > 0 && (
          <>
            {groups.map(group => {
              const isActive = currentChat?.type === 'group' && currentChat?.id === group.id
              const isUnread = unreadChats.includes(`group:${group.id}`)
              const lastMsg = groupLastMessages[group.id]
              
              // Generate stacked avatars (up to 3)
              const memberAvatars = (group.memberAvatars || []).slice(0, 3)
              const memberNames = (group.memberNames || []).slice(0, 3)
              
              return (
                <div
                  key={`group-${group.id}`}
                  className={`dm-item-imessage ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                  onClick={() => handleGroupClick(group)}
                >
                  <div className={`dm-unread-dot ${isUnread ? 'visible' : ''}`} />
                  
                  <div className='dm-avatar-container group-avatar-stack'>
                    {memberAvatars.length > 0 ? (
                      <div className='group-avatars'>
                        {memberAvatars.map((avatar, idx) => (
                          avatar ? (
                            <img 
                              key={idx}
                              src={avatar} 
                              alt={memberNames[idx] || 'Member'} 
                              className='group-avatar-mini'
                              style={{ 
                                zIndex: 3 - idx,
                                marginLeft: idx > 0 ? '-8px' : '0'
                              }}
                            />
                          ) : (
                            <div 
                              key={idx}
                              className='group-avatar-mini-fallback'
                              style={{ 
                                zIndex: 3 - idx,
                                marginLeft: idx > 0 ? '-8px' : '0'
                              }}
                            >
                              {(memberNames[idx] || '?')[0].toUpperCase()}
                            </div>
                          )
                        ))}
                      </div>
                    ) : (
                      <div className='dm-avatar-fallback group-avatar'>
                        👥
                      </div>
                    )}
                  </div>
                  
                  <div className='dm-content'>
                    <div className='dm-header-row'>
                      <span className='dm-name'>{group.displayName || group.name || 'Group Chat'}</span>
                      <span className='dm-timestamp'>{formatTimestamp(lastMsg?.timestamp)}</span>
                    </div>
                    <div className='dm-preview'>
                      {getPreviewText(lastMsg)}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
        
        {/* Create Group Button */}
        {onCreateGroup && (
          <div
            className='dm-item-imessage create-group-item'
            onClick={onCreateGroup}
          >
            <div className='dm-avatar-container'>
              <div className='dm-avatar-fallback create-group-icon'>
                ＋
              </div>
            </div>
            <div className='dm-content'>
              <div className='dm-header-row'>
                <span className='dm-name'>New Group</span>
              </div>
              <div className='dm-preview'>
                Start a group conversation
              </div>
            </div>
          </div>
        )}
        
        {/* Direct Messages */}
        {sortedDMs.map(dmUserId => {
          const dmUser = allUsers.find(u => u.uid === dmUserId)
          if (!dmUser) return null

          const isActive = currentChat?.type === 'dm' && currentChat?.id === dmUserId
          const isUnread = unreadChats.includes(`dm:${dmUserId}`)
          const lastMsg = lastMessages[dmUserId]
          
          const avatarContent = dmUser.photoURL ? (
            <img src={dmUser.photoURL} alt={dmUser.displayName} className='dm-avatar' />
          ) : (
            <div className='dm-avatar-fallback'>
              {(dmUser.displayName || dmUser.email || '?')[0].toUpperCase()}
            </div>
          )
          
          return (
            <div
              key={dmUserId}
              className={`dm-item-imessage ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
              onClick={() => handleDMClick(dmUser)}
            >
              <div className={`dm-unread-dot ${isUnread ? 'visible' : ''}`} />
              
              <div className='dm-avatar-container'>
                <DMStoryRing
                  currentUserId={user?.uid}
                  otherUserId={dmUserId}
                  currentUser={user}
                  size="small"
                >
                  {avatarContent}
                </DMStoryRing>
              </div>
              
              <div className='dm-content'>
                <div className='dm-header-row'>
                  <span className='dm-name'>{dmUser.displayName || dmUser.email}</span>
                  <span className='dm-timestamp'>{formatTimestamp(lastMsg?.timestamp)}</span>
                </div>
                <div className='dm-preview'>
                  {getPreviewText(lastMsg, dmUserId)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div
          className='modal-overlay'
          onClick={() => setShowPasswordModal(false)}
        >
          <div className='modal-content' onClick={e => e.stopPropagation()}>
            <h3>Set Password for Email Login</h3>
            <p className='modal-description'>
              Set a password to log in with your email ({user?.email}) on any
              device.
            </p>
            <input
              type='password'
              placeholder='New password (min 6 characters)'
              value={password}
              onChange={e => setPassword(e.target.value)}
              className='modal-input'
              disabled={settingPassword}
            />
            <input
              type='password'
              placeholder='Confirm password'
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className='modal-input'
              disabled={settingPassword}
            />
            {passwordError && <p className='modal-error'>{passwordError}</p>}
            {passwordSuccess && (
              <p className='modal-success'>{passwordSuccess}</p>
            )}
            <div className='modal-buttons'>
              <button
                className='modal-btn cancel'
                onClick={() => {
                  setShowPasswordModal(false)
                  setPassword('')
                  setConfirmPassword('')
                  setPasswordError('')
                }}
                disabled={settingPassword}
              >
                Cancel
              </button>
              <button
                className='modal-btn confirm'
                onClick={handleSetPassword}
                disabled={settingPassword}
              >
                {settingPassword ? 'Setting...' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Tasks Modal */}
      {showMyTasks && (
        <MyTasksModal
          user={user}
          allUsers={allUsers}
          onClose={() => setShowMyTasks(false)}
          onSelectChat={onSelectChat}
        />
      )}
    </div>
  )
}
