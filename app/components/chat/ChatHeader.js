'use client'

import { useEffect, useMemo, useState } from 'react'
import ChannelStoryRing from './ChannelStoryRing'
import DMStoryRing from './DMStoryRing'
import TasksModal from './TasksModal'
import { useDevMode } from '../../contexts/DevModeContext'
import { subscribeToHasUnviewedTasks, markTasksAsViewed, getDMId } from '../../lib/firestore'

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
  onOpenGroupInfo, // Callback to open GroupInfoModal
}) {
  const { isDevMode } = useDevMode()
  const [showTasksModal, setShowTasksModal] = useState(false)
  const [hasUnviewedTasks, setHasUnviewedTasks] = useState(false)

  // Subscribe to check for unviewed tasks
  useEffect(() => {
    if (!currentChat || !currentUserId || currentChat.type === 'ai') return

    const chatId =
      currentChat.type === 'dm' ? getDMId(currentUserId, currentChat.id) : currentChat.id

    const unsubscribe = subscribeToHasUnviewedTasks(
      currentUserId,
      chatId,
      currentChat.type,
      hasUnviewed => {
        setHasUnviewedTasks(hasUnviewed)
      }
    )

    return () => unsubscribe()
  }, [currentChat, currentUserId])

  // Handle opening tasks modal - mark as viewed BEFORE opening to prevent flash
  const handleOpenTasks = () => {
    if (currentChat && currentUserId && currentChat.type !== 'ai') {
      const chatId =
        currentChat.type === 'dm' ? getDMId(currentUserId, currentChat.id) : currentChat.id
      // Mark as viewed immediately to prevent blue dot flash
      markTasksAsViewed(currentUserId, chatId, currentChat.type)
      // Clear local state immediately too
      setHasUnviewedTasks(false)
    }
    setShowTasksModal(true)
  }

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

  const getSubtitle = () => {
    if (currentChat.type === 'channel') return 'Team chat'
    if (currentChat.type === 'ai') return 'AI Assistant'
    if (currentChat.type === 'group') {
      // Use computed groupMembers length (more reliable than denormalized memberCount)
      const memberCount =
        groupMembers.length || Object.keys(currentChat.group?.members || {}).length || 0
      return `${memberCount} People`
    }
    return ''
  }

  // Compute group members from the members map (more reliable than denormalized arrays)
  const groupMembers = useMemo(() => {
    if (currentChat.type !== 'group' || !currentChat.group?.members) return []

    return Object.entries(currentChat.group.members).map(([uid, memberData]) => {
      // Try to find latest user data from allUsers
      const fullUser = allUsers?.find(u => u.uid === uid)
      return {
        uid,
        displayName:
          fullUser?.displayName ||
          memberData.displayName ||
          memberData.email?.split('@')[0] ||
          'Unknown',
        photoURL: fullUser?.photoURL || memberData.photoURL || '',
      }
    })
  }, [currentChat.type, currentChat.group?.members, allUsers])

  // Get group member avatars for stacked display
  const getGroupAvatars = () => {
    if (currentChat.type !== 'group') return null
    const displayMembers = groupMembers.slice(0, 3)

    return (
      <div className='group-header-avatars'>
        {displayMembers.map((member, idx) =>
          member.photoURL ? (
            <img
              key={member.uid}
              src={member.photoURL}
              alt={member.displayName}
              className='group-header-avatar-mini'
              style={{
                zIndex: 3 - idx,
                marginLeft: idx > 0 ? '-10px' : '0',
              }}
            />
          ) : (
            <div
              key={member.uid}
              className='group-header-avatar-mini-fallback'
              style={{
                zIndex: 3 - idx,
                marginLeft: idx > 0 ? '-10px' : '0',
              }}
            >
              {(member.displayName || '?')[0].toUpperCase()}
            </div>
          )
        )}
      </div>
    )
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
          size='medium'
        >
          {avatarContent}
        </DMStoryRing>
      )
    }
    if (currentChat.type === 'group') {
      return getGroupAvatars()
    }
    // Channel - wrap with story ring for all channels
    const channelAvatar = <div className='chat-header-avatar chat-header-avatar-channel'>#</div>
    return (
      <ChannelStoryRing channelId={currentChat.id} size='medium' currentUser={currentUser}>
        {channelAvatar}
      </ChannelStoryRing>
    )
  }

  // Get avatar for desktop header (iMessage style)
  const getDesktopAvatar = () => {
    if (currentChat.type === 'ai') {
      return <img src='/poppy-icon.png' alt='Poppy' className='chat-header-avatar-desktop' />
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
          size='small'
        >
          {avatarContent}
        </DMStoryRing>
      )
    }
    if (currentChat.type === 'group') {
      return getGroupAvatars()
    }
    // Channel - wrap with story ring for all channels
    const channelAvatar = (
      <div className='chat-header-avatar-desktop chat-header-avatar-channel'>#</div>
    )
    return (
      <ChannelStoryRing channelId={currentChat.id} size='small' currentUser={currentUser}>
        {channelAvatar}
      </ChannelStoryRing>
    )
  }

  // Tasks button with blue dot indicator for unviewed tasks
  const TasksButton = ({ className }) => (
    <button onClick={handleOpenTasks} className={`relative ${className}`}>
      Tasks
      {hasUnviewedTasks && (
        <span
          className='absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full'
          style={{ backgroundColor: '#3b82f6' }}
        />
      )}
    </button>
  )

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
            {currentChat.type === 'group' ? (
              <button
                className='chat-header-group-pill'
                onClick={() => onOpenGroupInfo && onOpenGroupInfo()}
              >
                {getSubtitle()} <span className='group-pill-chevron'>›</span>
              </button>
            ) : (
              <span className='chat-header-subtitle-text'>{getSubtitle()}</span>
            )}
          </div>
          {isDevMode && todayCost > 0 && (
            <span className='ml-2 text-[9px] text-gray-500 font-mono whitespace-nowrap'>
              ${todayCost.toFixed(3)}
            </span>
          )}
        </div>

        {/* Right side buttons - Posts & Tasks */}
        <div className='flex items-center gap-2'>
          {viewMode && onViewModeChange && (
            <button
              onClick={() => onViewModeChange(viewMode === 'posts' ? 'messages' : 'posts')}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                viewMode === 'posts'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Posts
            </button>
          )}

          {currentChat.type !== 'ai' && (
            <TasksButton className='px-3 py-1 text-[11px] font-medium rounded-md text-gray-500 hover:text-gray-300 transition-colors' />
          )}
        </div>
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
        {currentChat.type === 'group' ? (
          <button
            className='chat-header-group-pill-mobile'
            onClick={() => onOpenGroupInfo && onOpenGroupInfo()}
          >
            {getSubtitle()} <span className='group-pill-chevron'>›</span>
          </button>
        ) : (
          <div className='chat-header-status'>{getSubtitle()}</div>
        )}

        {/* Mobile buttons - right side */}
        <div className='absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2'>
          {viewMode && onViewModeChange && (
            <button
              onClick={() => onViewModeChange(viewMode === 'posts' ? 'messages' : 'posts')}
              className={`text-[11px] font-medium ${
                viewMode === 'posts' ? 'text-white' : 'text-gray-500'
              }`}
            >
              Posts
            </button>
          )}
          {currentChat.type !== 'ai' && (
            <TasksButton className='text-[11px] font-medium text-gray-500' />
          )}
        </div>
      </div>

      {/* Tasks Modal */}
      <TasksModal
        isOpen={showTasksModal}
        onClose={() => setShowTasksModal(false)}
        user={currentUser}
        currentChat={currentChat}
        allUsers={allUsers}
      />
    </>
  )
}
