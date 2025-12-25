'use client'

import ChannelStoryRing from './ChannelStoryRing'

export default function ChatHeader({
  currentChat,
  isSidebarOpen,
  setIsSidebarOpen,
  viewMode,
  onViewModeChange,
  onBack,
  allUsers,
}) {
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

  // Check if this is the general channel (for stories)
  const isGeneralChannel = currentChat.type === 'channel' && currentChat.id === 'general'

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
      if (photo) {
        return <img src={photo} alt={currentChat.name} className='chat-header-avatar' />
      }
      // Fallback to initials
      const initials = currentChat.name?.substring(0, 2).toUpperCase() || '??'
      return <div className='chat-header-avatar chat-header-avatar-initials'>{initials}</div>
    }
    // Channel - wrap with story ring if general
    const channelAvatar = <div className='chat-header-avatar chat-header-avatar-channel'>#</div>
    
    if (isGeneralChannel) {
      return (
        <ChannelStoryRing channelId={currentChat.id} size="medium">
          {channelAvatar}
        </ChannelStoryRing>
      )
    }
    
    return channelAvatar
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
      if (photo) {
        return <img src={photo} alt={currentChat.name} className='chat-header-avatar-desktop' />
      }
      // Fallback to initials
      const initials = currentChat.name?.substring(0, 2).toUpperCase() || '??'
      return <div className='chat-header-avatar-desktop chat-header-avatar-initials'>{initials}</div>
    }
    // Channel - wrap with story ring if general
    const channelAvatar = <div className='chat-header-avatar-desktop chat-header-avatar-channel'>#</div>
    
    if (isGeneralChannel) {
      return (
        <ChannelStoryRing channelId={currentChat.id} size="small">
          {channelAvatar}
        </ChannelStoryRing>
      )
    }
    
    return channelAvatar
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
      </div>
    </>
  )
}
