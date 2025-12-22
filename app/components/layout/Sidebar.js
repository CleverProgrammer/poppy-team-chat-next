'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import SignOutButton from '../auth/SignOutButton'

export default function Sidebar({
  currentChat,
  onSelectChat,
  activeDMs = [],
  allUsers = [],
  unreadChats = [],
  lastMessages = {},
  channelLastMessages = {},
  aiLastMessage = null,
  isOpen = false,
  onOpenSearch,
}) {
  const { user, setPasswordForAccount } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
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

  const handleChannelClick = channelId => {
    onSelectChat({ type: 'channel', id: channelId, name: channelId })
  }

  const handleDMClick = dmUser => {
    onSelectChat({
      type: 'dm',
      id: dmUser.uid,
      name: dmUser.displayName || dmUser.email,
      user: dmUser,
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
    
    const dmUser = allUsers.find(u => u.uid === dmUserId)
    const isSentByMe = message.senderId === user?.uid
    const prefix = isSentByMe ? 'You: ' : ''
    
    if (message.imageUrl || message.imageUrls?.length > 0) {
      const imageCount = message.imageUrls?.length || 1
      return `${prefix}Attachments: ${imageCount} Photo${imageCount > 1 ? 's' : ''}`
    }
    
    if (message.muxPlaybackIds?.length > 0) {
      return `${prefix}Video message`
    }
    
    const text = message.text || ''
    const maxLength = 80 // Allow more text for 2 lines
    const truncated = text.length > maxLength ? text.substring(0, maxLength) + '...' : text
    return prefix + truncated
  }

  // Sort DMs by most recent message
  const sortedDMs = [...activeDMs].sort((a, b) => {
    const msgA = lastMessages[a]
    const msgB = lastMessages[b]
    
    const timeA = msgA?.timestamp?.seconds || 0
    const timeB = msgB?.timestamp?.seconds || 0
    
    return timeB - timeA // Most recent first
  })

  // Collapsed view - only show avatars
  if (isCollapsed) {
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
        
        {/* User avatar */}
        <div className="collapsed-item" onClick={() => setShowUserMenu(!showUserMenu)}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt='Profile' className='collapsed-avatar' />
          ) : (
            <div className='collapsed-avatar-fallback'>
              {(user?.displayName || user?.email || '?')[0].toUpperCase()}
            </div>
          )}
        </div>
        
        {/* Divider - separates user profile from conversations */}
        <div className="collapsed-divider" />
        
        {/* Channels */}
        {['general', 'test'].map(channelId => {
          const isActive = currentChat?.type === 'channel' && currentChat?.id === channelId
          const isUnread = unreadChats.includes(`channel:${channelId}`)
          
          return (
            <div
              key={`channel-${channelId}`}
              className={`collapsed-item ${isActive ? 'active' : ''}`}
              onClick={() => handleChannelClick(channelId)}
            >
              {isUnread && <div className="collapsed-unread-dot" />}
              <div className='collapsed-avatar-fallback channel-avatar'>
                #
              </div>
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
          
          return (
            <div
              key={dmUserId}
              className={`collapsed-item ${isActive ? 'active' : ''}`}
              onClick={() => handleDMClick(dmUser)}
            >
              {isUnread && <div className="collapsed-unread-dot" />}
              {dmUser.photoURL ? (
                <img src={dmUser.photoURL} alt={dmUser.displayName} className='collapsed-avatar' />
              ) : (
                <div className='collapsed-avatar-fallback'>
                  {(dmUser.displayName || dmUser.email || '?')[0].toUpperCase()}
                </div>
              )}
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
      style={{ width: `${sidebarWidth}px` }}
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
          {user?.photoURL && (
            <img src={user.photoURL} alt='Profile' className='header-avatar' />
          )}
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
                setShowPasswordModal(true)
                setShowUserMenu(false)
              }}
            >
              Set Password
            </button>
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
        {['general', 'test'].map(channelId => {
          const isActive = currentChat?.type === 'channel' && currentChat?.id === channelId
          const isUnread = unreadChats.includes(`channel:${channelId}`)
          const lastMsg = channelLastMessages[channelId]
          
          return (
            <div
              key={`channel-${channelId}`}
              className={`dm-item-imessage ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
              onClick={() => handleChannelClick(channelId)}
            >
              <div className={`dm-unread-dot ${isUnread ? 'visible' : ''}`} />
              
              <div className='dm-avatar-container'>
                <div className='dm-avatar-fallback channel-avatar'>
                  #
                </div>
              </div>
              
              <div className='dm-content'>
                <div className='dm-header-row'>
                  <span className='dm-name'>#{channelId}</span>
                  <span className='dm-timestamp'>{formatTimestamp(lastMsg?.timestamp)}</span>
                </div>
                <div className='dm-preview'>
                  {lastMsg ? `${lastMsg.sender}: ${lastMsg.text?.substring(0, 50) || 'Attachment'}` : 'No messages yet'}
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
                  {aiLastMessage ? (aiLastMessage.role === 'user' ? 'You: ' : 'Poppy: ') + (aiLastMessage.content?.substring(0, 50) || '') : 'Chat with AI assistant'}
                </div>
              </div>
            </div>
          )
        })()}
        
        {/* Direct Messages */}
        {sortedDMs.map(dmUserId => {
          const dmUser = allUsers.find(u => u.uid === dmUserId)
          if (!dmUser) return null

          const isActive = currentChat?.type === 'dm' && currentChat?.id === dmUserId
          const isUnread = unreadChats.includes(`dm:${dmUserId}`)
          const lastMsg = lastMessages[dmUserId]
          
          return (
            <div
              key={dmUserId}
              className={`dm-item-imessage ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
              onClick={() => handleDMClick(dmUser)}
            >
              <div className={`dm-unread-dot ${isUnread ? 'visible' : ''}`} />
              
              <div className='dm-avatar-container'>
                {dmUser.photoURL ? (
                  <img src={dmUser.photoURL} alt={dmUser.displayName} className='dm-avatar' />
                ) : (
                  <div className='dm-avatar-fallback'>
                    {(dmUser.displayName || dmUser.email || '?')[0].toUpperCase()}
                  </div>
                )}
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
    </div>
  )
}
