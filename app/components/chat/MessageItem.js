'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import MessageTimestamp from './MessageTimestamp'
import MessageActionSheet from './MessageActionSheet'
import StoriesViewer from './StoriesViewer'
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

  // Handle triple-tap: open video reply directly
  const handleTripleTap = useCallback(() => {
    hapticHeavy()
    onVideoReply?.(msg.id, msg.sender, msg.text || msg.content || '')
  }, [msg.id, msg.sender, msg.text, msg.content, onVideoReply])

  // Handle video reply from action sheet
  const handleVideoReply = useCallback(() => {
    onVideoReply?.(msg.id, msg.sender, msg.text || msg.content || '')
  }, [msg.id, msg.sender, msg.text, msg.content, onVideoReply])

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
      const timeSinceSecondLastTap = now - secondLastTapTime.current

      // Triple tap detection (3 taps within 600ms total)
      if (timeSinceSecondLastTap < 600 && timeSinceLastTap < 350 && timeSinceLastTap > 50) {
        e.preventDefault()
        e.stopPropagation()
        handleTripleTap()
        lastTapTime.current = 0
        secondLastTapTime.current = 0
        return
      }

      // Double tap detection
      if (timeSinceLastTap < 350 && timeSinceLastTap > 50) {
        e.preventDefault()
        e.stopPropagation()
        handleDoubleTap()
        secondLastTapTime.current = lastTapTime.current
        lastTapTime.current = 0
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

  // Mouse long-press for desktop (quick reactions)
  const handleMouseDown = useCallback(
    e => {
      // Only handle left mouse button
      if (e.button !== 0) return

      isLongPressTriggered.current = false
      longPressTimer.current = setTimeout(() => {
        isLongPressTriggered.current = true
        handleDoubleTap() // Show quick reactions on long-click
      }, 500)
    },
    [handleDoubleTap]
  )

  const handleMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

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
        }`}
        onContextMenu={handleContextMenuWrapper}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
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
          onReply={() => onReply(msg.id, msg.sender, msg.text)}
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
      } ${actionSheetOpen ? 'message-selected' : ''}`}
      onContextMenu={handleContextMenuWrapper}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchMove}
    >
      {/* Reply quote - shows above the message bubble like iMessage */}
      {msg.replyTo && (
        <div className='reply-quote-container' onClick={() => onScrollToMessage(msg.replyTo.msgId)}>
          <div className='reply-quote'>
            <div className='reply-quote-line'></div>
            <div className='reply-quote-content'>
              <div className='reply-quote-sender'>{msg.replyTo.sender}</div>
              <div className='reply-quote-text'>{msg.replyTo.text}</div>
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
      <div className='message'>
        {/* Mux videos - special styling for video replies */}
        {msg.muxPlaybackIds && msg.muxPlaybackIds.length > 0 && (
          <div className={`message-videos ${msg.replyTo ? 'video-reply' : ''}`}>
            {msg.muxPlaybackIds.map((playbackId, idx) => (
              msg.replyTo ? (
                // Video reply - compact bubble with play button
                <div key={idx} className='video-reply-bubble' onClick={(e) => {
                  e.stopPropagation();
                  // Collect all video replies to the SAME original message
                  const repliestoSameMessage = messages
                    .filter(m => m.muxPlaybackIds && m.muxPlaybackIds.length > 0 && m.replyTo?.msgId === msg.replyTo?.msgId)
                    .flatMap(m => m.muxPlaybackIds.map(pid => ({
                      playbackId: pid,
                      sender: m.sender,
                      timestamp: m.timestamp,
                      msgId: m.id
                    })));
                  // Find the index of the clicked video
                  const currentIdx = repliestoSameMessage.findIndex(v => v.playbackId === playbackId);
                  setStoriesVideos(repliestoSameMessage);
                  setStoriesInitialIndex(currentIdx >= 0 ? currentIdx : 0);
                  setStoriesOpen(true);
                }}>
                  <img 
                    src={`https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`}
                    alt='Video reply'
                    className='video-reply-thumbnail'
                  />
                  <div className='video-reply-play'>
                    <svg width='24' height='24' viewBox='0 0 24 24' fill='white'>
                      <path d='M8 5v14l11-7z'/>
                    </svg>
                  </div>
                  <div className='video-reply-badge'>🎬</div>
                </div>
              ) : (
                // Regular video - use native video for better mobile compatibility
                <video
                  key={idx}
                  className='message-mux-video'
                  controls
                  playsInline
                  preload='metadata'
                  poster={`https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`}
                  style={{ 
                    width: '100%', 
                    maxWidth: '300px',
                    borderRadius: '12px',
                    marginBottom: '8px'
                  }}
                >
                  <source 
                    src={`https://stream.mux.com/${playbackId}.m3u8`} 
                    type='application/x-mpegURL' 
                  />
                  <source 
                    src={`https://stream.mux.com/${playbackId}/high.mp4`} 
                    type='video/mp4' 
                  />
                </video>
              )
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
                )
              )
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
        onReply={() => onReply(msg.id, msg.sender, msg.text)}
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
