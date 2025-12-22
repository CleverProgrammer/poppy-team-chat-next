'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import MessageTimestamp from './MessageTimestamp'
import MessageActionSheet from './MessageActionSheet'
import StoriesViewer from './StoriesViewer'
import VideoThumbnail from './VideoThumbnail'
import {
  linkifyText,
  isSingleEmoji,
  isLoomUrl,
  getLoomEmbedUrl,
} from '../../utils/messageFormatting'
import { hapticHeavy, hapticLight, hapticSuccess } from '../../utils/haptics'

export default function MessageItem({
  msg,
  index,
  messages,
  totalMessages,
  user,
  currentChat,
  allUsers,
  replyingTo,
  topReactions,
  onReply,
  onVideoReply,
  onEdit,
  onDelete,
  onPromote,
  onAddToTeamMemory,
  onAddReaction,
  onImageClick,
  onScrollToMessage,
  messageRef,
}) {
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  const [actionSheetReactionsOnly, setActionSheetReactionsOnly] = useState(false)
  const [actionSheetPosition, setActionSheetPosition] = useState(null)
  const [animatingEmoji, setAnimatingEmoji] = useState(null)
  const [storiesOpen, setStoriesOpen] = useState(false)
  const [storiesVideos, setStoriesVideos] = useState([])
  const [storiesInitialIndex, setStoriesInitialIndex] = useState(0)
  const lastTapTime = useRef(0)
  const secondLastTapTime = useRef(0) // For triple-tap detection
  const doubleTapTimer = useRef(null) // Delay double-tap to check for triple-tap
  const elementRef = useRef(null)
  const longPressTimer = useRef(null)
  const isLongPressTriggered = useRef(false)
  const prevReactionsRef = useRef(null)

  const isOwnMessage = msg.senderId === user?.uid

  // Track reaction changes and trigger animation for new reactions
  useEffect(() => {
    const currentReactions = msg.reactions || {}
    const prevReactions = prevReactionsRef.current

    // Skip on initial mount
    if (prevReactions !== null) {
      // Find new or increased reactions
      Object.entries(currentReactions).forEach(([userId, emoji]) => {
        const prevEmoji = prevReactions[userId]
        if (prevEmoji !== emoji) {
          // New reaction or changed reaction - trigger animation
          setAnimatingEmoji(emoji)
          hapticSuccess()

          // Clear animation after it completes
          setTimeout(() => setAnimatingEmoji(null), 900)
        }
      })
    }

    prevReactionsRef.current = { ...currentReactions }
  }, [msg.reactions])

  // Handle double-tap/double-click: show reactions
  const handleDoubleTap = useCallback(() => {
    hapticLight()
    // Get message position for contextual placement
    const rect = elementRef.current?.getBoundingClientRect()
    if (rect) {
      setActionSheetPosition({
        top: rect.top,
        left: rect.left + rect.width / 2,
      })
    }
    setActionSheetReactionsOnly(true)
    setActionSheetOpen(true)
  }, [])

  // Get the original message to reply to (if this message is already a reply, use its parent)
  const getOriginalReplyTarget = useCallback(() => {
    if (msg.replyTo?.msgId) {
      // This message is a reply - reply to the ORIGINAL message instead
      return {
        msgId: msg.replyTo.msgId,
        sender: msg.replyTo.sender,
        text: msg.replyTo.text || ''
      }
    }
    // This is an original message - reply to it directly
    return {
      msgId: msg.id,
      sender: msg.sender,
      text: msg.text || msg.content || ''
    }
  }, [msg.id, msg.sender, msg.text, msg.content, msg.replyTo])

  // Handle triple-tap: open video reply directly
  const handleTripleTap = useCallback(() => {
    hapticHeavy()
    const target = getOriginalReplyTarget()
    onVideoReply?.(target.msgId, target.sender, target.text)
  }, [getOriginalReplyTarget, onVideoReply])

  // Handle video reply from action sheet
  const handleVideoReply = useCallback(() => {
    const target = getOriginalReplyTarget()
    onVideoReply?.(target.msgId, target.sender, target.text)
  }, [getOriginalReplyTarget, onVideoReply])

  // Handle long-press/right-click: show full actions (centered)
  const handleLongPress = useCallback(() => {
    hapticHeavy()
    setActionSheetPosition(null) // Center for full menu
    setActionSheetReactionsOnly(false)
    setActionSheetOpen(true)
  }, [])

  // Touch start - start long press timer
  const handleTouchStart = useCallback(
    e => {
      isLongPressTriggered.current = false

      longPressTimer.current = setTimeout(() => {
        isLongPressTriggered.current = true
        handleLongPress()
      }, 400)
    },
    [handleLongPress]
  )

  // Touch end - check for double tap and triple tap
  const handleTouchEnd = useCallback(
    e => {
      // Clear long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }

      // Skip if long press was triggered
      if (isLongPressTriggered.current) {
        return
      }

      // Tap detection
      const now = Date.now()
      const timeSinceLastTap = now - lastTapTime.current

      // Check if this is a potential triple-tap (3rd tap after a pending double-tap)
      if (doubleTapTimer.current && timeSinceLastTap < 350 && timeSinceLastTap > 50) {
        // Cancel the pending double-tap and do triple-tap instead!
        clearTimeout(doubleTapTimer.current)
        doubleTapTimer.current = null
        e.preventDefault()
        e.stopPropagation()
        handleTripleTap()
        lastTapTime.current = 0
        secondLastTapTime.current = 0
        return
      }

      // Double tap detection - but delay execution to check for triple-tap
      if (timeSinceLastTap < 350 && timeSinceLastTap > 50) {
        e.preventDefault()
        e.stopPropagation()

        // Store the second tap time
        secondLastTapTime.current = lastTapTime.current
        lastTapTime.current = now

        // Delay double-tap to see if a third tap is coming
        doubleTapTimer.current = setTimeout(() => {
          doubleTapTimer.current = null
          handleDoubleTap()
          lastTapTime.current = 0
          secondLastTapTime.current = 0
        }, 200) // 200ms window for third tap
      } else {
        secondLastTapTime.current = lastTapTime.current
        lastTapTime.current = now
      }
    },
    [handleDoubleTap, handleTripleTap]
  )

  // Touch move - cancel long press
  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // Right-click handler - show full action sheet
  const handleContextMenuWrapper = useCallback(
    e => {
      e.preventDefault()
      handleLongPress() // Full menu
    },
    [handleLongPress]
  )

  // Desktop uses right-click only (no long-press)
  // Long-press is only for mobile touch interactions

  // Handle AI typing indicator
  if (msg.isTyping) {
    return (
      <div className='message-wrapper received ai-typing'>
        <div className='message-sender'>{msg.sender}</div>
        <div className='message'>
          <div className='ai-typing-with-status'>
            <div className='ai-typing-indicator'>
              <span></span>
              <span></span>
              <span></span>
            </div>
            {msg.text && <div className='ai-status-text'>{msg.text}</div>}
          </div>
        </div>
      </div>
    )
  }

  const isSent = msg.senderId === user?.uid
  const reactions = msg.reactions || {}
  const reactionCounts = {}
  const userReactedWith = {}
  const hasImages = msg.imageUrl || (msg.imageUrls && msg.imageUrls.length > 0)
  const isJumboEmoji = msg.text && !hasImages && isSingleEmoji(msg.text)

  // Count reactions
  Object.entries(reactions).forEach(([userId, emoji]) => {
    if (!reactionCounts[emoji]) {
      reactionCounts[emoji] = { count: 0, userIds: [] }
    }
    reactionCounts[emoji].count++
    reactionCounts[emoji].userIds.push(userId)
    if (userId === user?.uid) {
      userReactedWith[emoji] = true
    }
  })

  // Count replies to this message
  const replyCount = messages.filter(m => m.replyTo?.msgId === msg.id).length

  const isReplyTarget = replyingTo?.msgId === msg.id
  const isLastMessage = index === totalMessages - 1

  // Find the last message from this specific sender
  let isLastMessageFromSender = true
  for (let i = index + 1; i < totalMessages; i++) {
    if (messages[i].senderId === msg.senderId) {
      isLastMessageFromSender = false
      break
    }
  }

  // Render jumbo emoji differently (no bubble)
  if (isJumboEmoji) {
    return (
      <div
        ref={el => {
          messageRef(el)
          elementRef.current = el
        }}
        data-msg-id={msg.id}
        className={`message-wrapper ${isSent ? 'sent' : 'received'} jumbo-emoji-wrapper ${
          actionSheetOpen ? 'message-selected' : ''
        } ${msg.senderId === 'ai' ? 'ai-message' : ''}`}
        onContextMenu={handleContextMenuWrapper}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchCancel={handleTouchMove}
      >
        <div className='jumbo-emoji'>{msg.text}</div>
        {isSent && (
          <div className='message-timestamp-sent'>
            <MessageTimestamp timestamp={msg.timestamp} />
          </div>
        )}
        {!isSent && (
          <div className='message-timestamp-received'>
            <MessageTimestamp timestamp={msg.timestamp} />
          </div>
        )}

        {/* Reaction Badges */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className='reactions-display'>
            {Object.entries(reactionCounts).map(([emoji, data]) => (
              <div
                key={emoji}
                className={`reaction-badge ${userReactedWith[emoji] ? 'user-reacted' : ''} ${
                  animatingEmoji === emoji ? 'reaction-pop' : ''
                }`}
                onClick={() => onAddReaction(msg.id, emoji)}
              >
                <span className='reaction-emoji'>{emoji}</span>
                <span className='reaction-count'>{data.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Mobile Action Sheet (vaul) */}
        <MessageActionSheet
          isOpen={actionSheetOpen}
          onClose={() => setActionSheetOpen(false)}
          message={msg}
          isOwnMessage={isOwnMessage}
          isPost={false}
          topReactions={topReactions}
          position={actionSheetPosition}
          onReaction={emoji => onAddReaction(msg.id, emoji)}
          onReply={() => {
            const target = getOriginalReplyTarget()
            onReply(target.msgId, target.sender, target.text)
          }}
          onVideoReply={handleVideoReply}
          onEdit={() => onEdit(msg.id, msg.text)}
          onDelete={() => onDelete?.(msg.id)}
          onPromote={() => onPromote?.(msg.id)}
          onAddToTeamMemory={() => onAddToTeamMemory?.(msg)}
          reactionsOnly={actionSheetReactionsOnly}
        />
      </div>
    )
  }

  return (
    <div
      ref={el => {
        messageRef(el)
        elementRef.current = el
      }}
      data-msg-id={msg.id}
      className={`message-wrapper ${isSent ? 'sent' : 'received'} ${
        isReplyTarget ? 'reply-target' : ''
      } ${actionSheetOpen ? 'message-selected' : ''} ${
        msg.replyTo &&
        msg.muxPlaybackIds?.length > 0 &&
        !msg.text &&
        !msg.imageUrl &&
        !msg.imageUrls?.length
          ? 'video-only-reply'
          : ''
      } ${msg.senderId === 'ai' ? 'ai-message' : ''}`}
      onContextMenu={handleContextMenuWrapper}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchMove}
    >
      {/* Channel avatar - positioned to the left of the message like iMessage */}
      {!isSent && currentChat.type === 'channel' && msg.senderId !== 'ai' && (() => {
        const photoURL = msg.photoURL || allUsers.find(u => u.uid === msg.senderId)?.photoURL
        const initial = (msg.sender || '?')[0].toUpperCase()
        return photoURL ? (
          <img
            src={photoURL}
            alt={msg.sender}
            className='message-avatar'
          />
        ) : (
          <div className='message-avatar-fallback'>
            {initial}
          </div>
        )
      })()}

      {/* Message content wrapper */}
      <div className='message-content-wrapper'>
        {/* Reply quote - shows above the message bubble like iMessage */}
        {msg.replyTo && (
          <div className='reply-quote-container' onClick={() => onScrollToMessage(msg.replyTo.msgId)}>
            {(() => {
              const replyUser = allUsers.find(u => u.displayName === msg.replyTo.sender || u.email === msg.replyTo.sender)
              return replyUser?.photoURL ? (
                <img src={replyUser.photoURL} alt={msg.replyTo.sender} className='reply-quote-avatar' />
              ) : (
                <div className='reply-quote-avatar-fallback'>
                  {(msg.replyTo.sender || '?')[0].toUpperCase()}
                </div>
              )
            })()}
            <div className='reply-quote'>
              <div className='reply-quote-text'>
                {msg.replyTo.text?.length > 500 
                  ? `${msg.replyTo.text.slice(0, 500)}...` 
                  : msg.replyTo.text}
              </div>
            </div>
          </div>
        )}
        {!isSent && (
          <div className='message-sender'>
            {msg.senderId === 'ai' && (
              <img
                src='/poppy-icon.png'
                alt='Poppy'
                className='ai-sender-icon'
                style={{ width: '24px', height: '24px', maxWidth: '24px', maxHeight: '24px' }}
              />
            )}
            {msg.senderId === 'ai' ? msg.sender?.replace('🤖 ', '').replace('🤖', '') : msg.sender}
            <MessageTimestamp timestamp={msg.timestamp} />
          </div>
        )}
      {/* Video replies - render OUTSIDE the message bubble for proper positioning */}
      {msg.muxPlaybackIds && msg.muxPlaybackIds.length > 0 && msg.replyTo && (
        <div className='message-videos video-reply'>
          {msg.muxPlaybackIds.map((playbackId, idx) => (
            <VideoThumbnail
              key={idx}
              playbackId={playbackId}
              isReply={true}
              onClick={e => {
                e.stopPropagation()
                // Collect all video replies to the SAME original message
                const repliestoSameMessage = messages
                  .filter(
                    m =>
                      m.muxPlaybackIds &&
                      m.muxPlaybackIds.length > 0 &&
                      m.replyTo?.msgId === msg.replyTo?.msgId
                  )
                  .flatMap(m =>
                    m.muxPlaybackIds.map(pid => ({
                      playbackId: pid,
                      sender: m.sender,
                      timestamp: m.timestamp,
                      msgId: m.id,
                    }))
                  )
                // Find the index of the clicked video
                const currentIdx = repliestoSameMessage.findIndex(v => v.playbackId === playbackId)
                setStoriesVideos(repliestoSameMessage)
                setStoriesInitialIndex(currentIdx >= 0 ? currentIdx : 0)
                setStoriesOpen(true)
              }}
            />
          ))}
        </div>
      )}
      <div className='message'>
        {/* Regular Mux videos (not replies) - clickable thumbnail that opens modal */}
        {msg.muxPlaybackIds && msg.muxPlaybackIds.length > 0 && !msg.replyTo && (
          <div className='message-videos'>
            {msg.muxPlaybackIds.map((playbackId, idx) => (
              <VideoThumbnail
                key={idx}
                playbackId={playbackId}
                isReply={false}
                onClick={e => {
                  e.stopPropagation()
                  // Create video data for StoriesViewer
                  const videoData = msg.muxPlaybackIds.map(pid => ({
                    playbackId: pid,
                    sender: msg.sender,
                    timestamp: msg.timestamp,
                    msgId: msg.id,
                  }))
                  setStoriesVideos(videoData)
                  setStoriesInitialIndex(idx)
                  setStoriesOpen(true)
                }}
              />
            ))}
          </div>
        )}
        {/* Support multiple images or single image */}
        {(msg.imageUrls || msg.imageUrl) && (
          <div
            className={`message-images ${(msg.imageUrls?.length || 1) > 1 ? 'multi-image' : ''}`}
          >
            {(() => {
              const allImages = (msg.imageUrls || [msg.imageUrl]).filter(Boolean)
              return allImages.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Shared image ${idx + 1}`}
                  className='message-image'
                  onClick={e => {
                    e.stopPropagation()
                    onImageClick(allImages, idx)
                  }}
                />
              ))
            })()}
          </div>
        )}
        {/* Loom video embed */}
        {msg.text && isLoomUrl(msg.text) && (
          <div className='loom-container'>
            <iframe
              src={getLoomEmbedUrl(msg.text)}
              loading='lazy'
              allowFullScreen
              title='Loom video'
            />
          </div>
        )}
        {msg.text && (
          <div className='text'>
            {linkifyText(msg.text)}
            {msg.edited && <span className='edited-indicator'> (edited)</span>}
          </div>
        )}
      </div>
      {isSent && (
        <div className='message-timestamp-sent'>
          <MessageTimestamp timestamp={msg.timestamp} />
        </div>
      )}

      {/* Reactions Display */}
      {Object.keys(reactionCounts).length > 0 && (
        <div className='reactions-display'>
          {Object.entries(reactionCounts).map(([emoji, data]) => {
            const reactedUsers = data.userIds
              .map(uid => allUsers.find(u => u.uid === uid))
              .filter(Boolean)

            return (
              <div
                key={emoji}
                className={`reaction-badge ${userReactedWith[emoji] ? 'mine' : ''} ${
                  animatingEmoji === emoji ? 'reaction-pop' : ''
                }`}
                onClick={() => onAddReaction(msg.id, emoji)}
              >
                <span className='reaction-emoji'>{emoji}</span>
                <span className='count'>{data.count}</span>

                {/* Reaction tooltip with user avatars */}
                <div className='reaction-tooltip'>
                  <div className='reaction-tooltip-avatars'>
                    {reactedUsers.map(reactedUser => (
                      <img
                        key={reactedUser.uid}
                        src={reactedUser.photoURL || ''}
                        alt={reactedUser.displayName}
                        className='reaction-tooltip-avatar'
                        title={reactedUser.displayName || reactedUser.email}
                      />
                    ))}
                  </div>
                  <div className='reaction-tooltip-names'>
                    {reactedUsers.map(u => u.displayName || u.email).join(', ')}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reply Count Indicator */}
      {replyCount > 0 && (
        <div className={`reply-count-indicator ${isSent ? 'sent' : 'received'}`}>
          {replyCount} {replyCount === 1 ? 'Reply' : 'Replies'}
        </div>
      )}

      {/* Read Receipt - Only show on messages I sent that were read by the other person */}
      {isSent &&
        currentChat.type === 'dm' &&
        msg.readBy &&
        msg.readBy[currentChat.id] &&
        isLastMessageFromSender &&
        (() => {
          const otherUser = allUsers.find(u => u.uid === currentChat.id)
          return (
            <div className='read-receipt'>
              <span className='read-text'>
                Read{' '}
                {new Date(msg.readBy[currentChat.id].seconds * 1000).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <img
                src={otherUser?.photoURL || ''}
                alt={otherUser?.displayName || 'User'}
                className='read-receipt-avatar'
              />
            </div>
          )
        })()}
      </div>
      {/* End message-content-wrapper */}

      {/* Mobile Action Sheet (vaul) */}
      <MessageActionSheet
        isOpen={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        message={msg}
        isOwnMessage={isOwnMessage}
        isPost={false}
        topReactions={topReactions}
        position={actionSheetPosition}
        onReaction={emoji => onAddReaction(msg.id, emoji)}
        onReply={() => {
          const target = getOriginalReplyTarget()
          onReply(target.msgId, target.sender, target.text)
        }}
        onVideoReply={handleVideoReply}
        onEdit={() => onEdit(msg.id, msg.text)}
        onDelete={() => onDelete?.(msg.id)}
        onPromote={() => onPromote?.(msg.id)}
        onAddToTeamMemory={() => onAddToTeamMemory?.(msg)}
        reactionsOnly={actionSheetReactionsOnly}
      />

      {/* Stories Viewer for video replies */}
      <StoriesViewer
        isOpen={storiesOpen}
        onClose={() => setStoriesOpen(false)}
        videos={storiesVideos}
        initialIndex={storiesInitialIndex}
      />
    </div>
  )
}
