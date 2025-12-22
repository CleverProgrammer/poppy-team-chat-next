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
  const menuRef = useRef(null)
  const sidebarRef = useRef(null)

  // Handle sidebar resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return
      const newWidth = e.clientX
      if (newWidth >= 260 && newWidth <= 500) {
        setSidebarWidth(newWidth)
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

      {/* Channels Section */}
      <div className='sidebar-section'>
        <div className='sidebar-section-title'>Channels</div>
        <div
          className={`channel-item ${
            currentChat?.type === 'channel' && currentChat?.id === 'general'
              ? 'active'
              : ''
          }`}
          onClick={() => handleChannelClick('general')}
        >
          <span className='hash'>#</span>
          <span>general</span>
          {unreadChats.includes('channel:general') && (
            <div className='unread-badge' />
          )}
        </div>
        <div
          className={`channel-item ${
            currentChat?.type === 'channel' && currentChat?.id === 'test'
              ? 'active'
              : ''
          }`}
          onClick={() => handleChannelClick('test')}
        >
          <span className='hash'>#</span>
          <span>test</span>
          {unreadChats.includes('channel:test') && (
            <div className='unread-badge' />
          )}
        </div>
      </div>

      {/* Poppy AI Chat Section */}
      <div className='sidebar-section'>
        <div className='sidebar-section-title'>AI Assistant</div>
        <div
          className={`dm-item ${currentChat?.type === 'ai' ? 'active' : ''}`}
          onClick={() =>
            onSelectChat({ type: 'ai', id: 'poppy-ai', name: 'Poppy AI' })
          }
        >
          <img src="/poppy-icon.png" alt="Poppy" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          <span>Poppy AI</span>
          {unreadChats.includes('ai:poppy-ai') && (
            <div className='unread-badge' />
          )}
        </div>
      </div>

      {/* Direct Messages Section - iMessage Style */}
      {activeDMs.length > 0 && (
        <div className='sidebar-section dm-section'>
          <div className='sidebar-section-title'>Messages</div>
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
                {/* Unread indicator - LEFT of avatar */}
                <div className={`dm-unread-dot ${isUnread ? 'visible' : ''}`} />
                
                {/* Avatar */}
                <div className='dm-avatar-container'>
                  {dmUser.photoURL ? (
                    <img src={dmUser.photoURL} alt={dmUser.displayName} className='dm-avatar' />
                  ) : (
                    <div className='dm-avatar-fallback'>
                      {(dmUser.displayName || dmUser.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                
                {/* Content - Name and Preview */}
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
      )}

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
