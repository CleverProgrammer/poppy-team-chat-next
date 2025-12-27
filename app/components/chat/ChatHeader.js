'use client'

import { useMemo, useState } from 'react'
import ChannelStoryRing from './ChannelStoryRing'
import DMStoryRing from './DMStoryRing'
import TasksModal from './TasksModal'
import { useDevMode } from '../../contexts/DevModeContext'

export default function ChatHeader({
  currentChat,
  isSidebarOpen,
  setIsSidebarOpen,
  viewMode,
  onViewModeChange,
  onBack,
  allUsers,
  currentUserId, // Current logged-in user's ID for DM stories
  currentUser = null, // Current user object for story view tracking
  messages = [], // Messages for cost calculation
}) {
  const { isDevMode } = useDevMode()
  const [showTasksModal, setShowTasksModal] = useState(false)

  // Calculate today's tagging cost from messages
  const todayCost = useMemo(() => {
    if (!isDevMode) return 0
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.getTime() / 1000 // Firestore timestamp in seconds
    
    return messages.reduce((total, msg) => {
      const msgTime = msg.timestamp?.seconds || 0
      if (msgTime >= todayStart && msg.aiTags?._cost) {
        return total + msg.aiTags._cost
      }
      return total
    }, 0)
  }, [messages, isDevMode])
  const getIcon = () => {
    if (currentChat.type === 'channel') return '#'
    if (currentChat.type === 'ai')
      return <img src='/poppy-icon.png' alt='Poppy' style={{ width: '20px', height: '20px' }} />
    return '💬'
  }

  const getSubtitle = () => {
    if (currentChat.type === 'channel') return 'Team chat'
    if (currentChat.type === 'ai') return 'AI Assistant'
    return ''
  }

  // Get user photo for DMs
  const getUserPhoto = () => {
    if (currentChat.type === 'dm' && currentChat.id && allUsers) {
      const dmUser = allUsers.find(u => u.uid === currentChat.id)
      return dmUser?.photoURL || null
    }
    return null
  }

  // Get avatar/icon for mobile header
  const getMobileAvatar = () => {
    if (currentChat.type === 'ai') {
      return (
        <img
          src='/poppy-icon.png'
          alt='Poppy'
          className='chat-header-avatar'
          style={{ width: '36px', height: '36px' }}
        />
      )
    }
    if (currentChat.type === 'dm') {
      const photo = getUserPhoto()
      const avatarContent = photo ? (
        <img src={photo} alt={currentChat.name} className='chat-header-avatar' />
      ) : (
        <div className='chat-header-avatar chat-header-avatar-initials'>
          {currentChat.name?.substring(0, 2).toUpperCase() || '??'}
        </div>
      )
      // Wrap with DMStoryRing for private stories
      return (
        <DMStoryRing
          currentUserId={currentUserId}
          otherUserId={currentChat.id}
          currentUser={currentUser}
          size="medium"
        >
          {avatarContent}
        </DMStoryRing>
      )
    }
    // Channel - wrap with story ring for all channels
    const channelAvatar = <div className='chat-header-avatar chat-header-avatar-channel'>#</div>
    return (
      <ChannelStoryRing channelId={currentChat.id} size="medium" currentUser={currentUser}>
        {channelAvatar}
      </ChannelStoryRing>
    )
  }

  // Get avatar for desktop header (iMessage style)
  const getDesktopAvatar = () => {
    if (currentChat.type === 'ai') {
      return (
        <img
          src='/poppy-icon.png'
          alt='Poppy'
          className='chat-header-avatar-desktop'
        />
      )
    }
    if (currentChat.type === 'dm') {
      const photo = getUserPhoto()
      const avatarContent = photo ? (
        <img src={photo} alt={currentChat.name} className='chat-header-avatar-desktop' />
      ) : (
        <div className='chat-header-avatar-desktop chat-header-avatar-initials'>
          {currentChat.name?.substring(0, 2).toUpperCase() || '??'}
        </div>
      )
      // Wrap with DMStoryRing for private stories
      return (
        <DMStoryRing
          currentUserId={currentUserId}
          otherUserId={currentChat.id}
          currentUser={currentUser}
          size="small"
        >
          {avatarContent}
        </DMStoryRing>
      )
    }
    // Channel - wrap with story ring for all channels
    const channelAvatar = <div className='chat-header-avatar-desktop chat-header-avatar-channel'>#</div>
    return (
      <ChannelStoryRing channelId={currentChat.id} size="small" currentUser={currentUser}>
        {channelAvatar}
      </ChannelStoryRing>
    )
  }

  return (
    <>
      {/* Desktop Header - iMessage style with avatar and name pill */}
      <div className='chat-header'>
        <button
          className='mobile-menu-button'
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label='Toggle menu'
        >
          <svg
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
            <line x1='3' y1='12' x2='21' y2='12'></line>
            <line x1='3' y1='6' x2='21' y2='6'></line>
            <line x1='3' y1='18' x2='21' y2='18'></line>
          </svg>
        </button>
        
        {/* iMessage-style header content */}
        <div className='chat-header-imessage'>
          {getDesktopAvatar()}
          <div className='chat-header-name-pill'>
            <span className='chat-header-name-text'>
              {currentChat.name?.replace('🤖 ', '').replace('🤖', '')}
            </span>
            <span className='chat-header-subtitle-text'>{getSubtitle()}</span>
          </div>
          {isDevMode && todayCost > 0 && (
            <span className='ml-2 text-[9px] text-gray-500 font-mono whitespace-nowrap'>
              ${todayCost.toFixed(3)}
            </span>
          )}
          
          {/* Tasks button - only show for DMs and channels, not AI */}
          {currentChat.type !== 'ai' && (
            <button
              onClick={() => setShowTasksModal(true)}
              className='ml-3 px-3 py-1.5 text-xs font-medium rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-1.5'
              title='View tasks'
            >
              <span>📋</span>
              <span>Tasks</span>
            </button>
          )}
        </div>

        {viewMode && onViewModeChange && (
          <div className='view-mode-toggle'>
            <button
              className={`toggle-btn ${viewMode === 'messages' ? 'active' : ''}`}
              onClick={() => onViewModeChange('messages')}
            >
              Messages
            </button>
            <button
              className={`toggle-btn ${viewMode === 'posts' ? 'active' : ''}`}
              onClick={() => onViewModeChange('posts')}
            >
              Posts
            </button>
          </div>
        )}
      </div>

      {/* Mobile iMessage-style Header */}
      <div className='chat-header-mobile'>
        <button className='back-button' onClick={onBack}>
          <svg width='12' height='20' viewBox='0 0 12 20' fill='none'>
            <path
              d='M10 2L2 10L10 18'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
          <span>Back</span>
        </button>
        {getMobileAvatar()}
        <div className='chat-header-name'>
          {currentChat.name?.replace('🤖 ', '').replace('🤖', '')}
        </div>
        <div className='chat-header-status'>{getSubtitle()}</div>
        
        {/* Mobile tasks button */}
        {currentChat.type !== 'ai' && (
          <button
            onClick={() => setShowTasksModal(true)}
            className='absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors'
            title='View tasks'
          >
            📋
          </button>
        )}
      </div>

      {/* Tasks Modal */}
      <TasksModal
        isOpen={showTasksModal}
        onClose={() => setShowTasksModal(false)}
        user={currentUser}
        currentChat={currentChat}
      />
    </>
  )
}
