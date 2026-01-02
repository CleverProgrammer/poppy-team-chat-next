'use client'

import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react'
import MessageTimestamp from './MessageTimestamp'
import MessageActionSheet from './MessageActionSheet'
import StoriesViewer from './StoriesViewer'
import VideoThumbnail from './VideoThumbnail'
import VoiceMessage from './VoiceMessage'
import SkeletonView from './SkeletonView'
import {
  linkifyText,
  linkifyAIText,
  isSingleEmoji,
  isLoomUrl,
  getLoomEmbedUrl,
  extractFirstUrl,
  containsMindmap,
  splitTextAndMindmaps,
} from '../../utils/messageFormatting'
import MindmapView from './MindmapView'
import { updateMessageMediaDimensions, updateMessageLinkPreview, getDMId } from '../../lib/firestore'
import LinkPreview from './LinkPreview'
import { useDevMode } from '../../contexts/DevModeContext'
import { hapticHeavy, hapticLight, hapticSuccess } from '../../utils/haptics'
import DevTagInfo from './DevTagInfo'
import AICostBreakdown from './AICostBreakdown'
import { cn } from '../../utils/cn'

// Maximum dimensions for single images/videos
const MAX_MEDIA_WIDTH = 240
const MAX_MEDIA_HEIGHT = 280
// Maximum dimensions for images in multi-image grid
const MAX_MULTI_IMAGE_WIDTH = 120
const MAX_MULTI_IMAGE_HEIGHT = 120

/**
 * ImageWithSkeleton - Wraps an image with SkeletonView for loading state.
 * Parent div controls max-width, SkeletonView fills 100% and maintains aspect ratio.
 * 
 * Also handles on-demand migration: if image loads without stored dimensions,
 * it captures them and updates Firestore for future loads.
 */
function ImageWithSkeleton({ 
  src, 
  alt, 
  width, 
  height, 
  maxWidth, 
  maxHeight,
  onClick,
  // For on-demand migration
  onDimensionsMigrate,
  imageIndex = 0,
}) {
  const [loaded, setLoaded] = useState(false)
  const [displayDimensions, setDisplayDimensions] = useState(
    width && height ? { width, height } : null
  )

  const handleLoad = (e) => {
    const img = e.target
    setLoaded(true)
    
    // On-demand migration: if no stored dimensions, capture and migrate
    if (!width || !height) {
      const actualDimensions = { 
        width: img.naturalWidth, 
        height: img.naturalHeight 
      }
      setDisplayDimensions(actualDimensions)
      
      // Notify parent to update Firestore
      onDimensionsMigrate?.(imageIndex, actualDimensions)
    }
  }

  // Handle touch end to ensure immediate response on mobile
  // Stops propagation to prevent parent's double-tap detection from interfering
  const handleTouchEnd = (e) => {
    e.stopPropagation()
    // Trigger click immediately on touch for responsive mobile experience
    onClick?.()
  }

  return (
    <div 
      className={cn(
        'rounded-xl overflow-hidden cursor-pointer relative',
        'hover:scale-[1.02] transition-transform'
      )}
      style={{ maxWidth, maxHeight }}
      onClick={onClick}
      onTouchEnd={handleTouchEnd}
      data-image-tap="true"
    >
      <SkeletonView
        width={displayDimensions?.width}
        height={displayDimensions?.height}
        loaded={loaded}
      >
        <img
          src={src}
          alt={alt}
          className='w-full h-full object-cover block'
          onLoad={handleLoad}
        />
      </SkeletonView>
    </div>
  )
}

function MessageItem({
  msg,
  index,
  messages,
  totalMessages,
  replyCount,
  isLastMessageFromSender,
  userMap,
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
  onOpenThread,
  onMakePublic,
  isInThreadView = false,
  isOriginalInThread = false,
}) {
  const { isDevMode } = useDevMode()
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  const [actionSheetReactionsOnly, setActionSheetReactionsOnly] = useState(false)
  const [actionSheetPosition, setActionSheetPosition] = useState(null)
  const [animatingEmoji, setAnimatingEmoji] = useState(null)
  const [storiesOpen, setStoriesOpen] = useState(false)
  const [storiesVideos, setStoriesVideos] = useState([])
  const [storiesInitialIndex, setStoriesInitialIndex] = useState(0)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const lastTapTime = useRef(0)
  const secondLastTapTime = useRef(0) // For triple-tap detection
  const doubleTapTimer = useRef(null) // Delay double-tap to check for triple-tap
  const elementRef = useRef(null)
  const longPressTimer = useRef(null)
  const isLongPressTriggered = useRef(false)
  const prevReactionsRef = useRef(null)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const isDragging = useRef(false)
  const actionSheetClosedAt = useRef(0) // Track when action sheet closed to prevent phantom touches
  const SWIPE_THRESHOLD = 60 // pixels to trigger reply
  const MAX_SWIPE = 100 // max pixels to drag

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
        text: msg.replyTo.text || '',
        imageUrl: msg.replyTo.imageUrl || null,
        imageUrls: msg.replyTo.imageUrls || null,
        audioUrl: msg.replyTo.audioUrl || null,
        audioDuration: msg.replyTo.audioDuration || null,
        muxPlaybackIds: msg.replyTo.muxPlaybackIds || null,
      }
    }
    // This is an original message - reply to it directly
    return {
      msgId: msg.id,
      sender: msg.sender,
      text: msg.text || msg.content || '',
      imageUrl: msg.imageUrl || null,
      imageUrls: msg.imageUrls || null,
      audioUrl: msg.audioUrl || null,
      audioDuration: msg.audioDuration || null,
      muxPlaybackIds: msg.muxPlaybackIds || null,
    }
  }, [msg.id, msg.sender, msg.text, msg.content, msg.replyTo, msg.imageUrl, msg.imageUrls, msg.audioUrl, msg.audioDuration, msg.muxPlaybackIds])

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

  // Handle swipe/drag start (touch or mouse)
  const handleSwipeStart = useCallback((clientX, clientY) => {
    swipeStartX.current = clientX
    swipeStartY.current = clientY
    isDragging.current = true
    setIsSwiping(true)
    setSwipeOffset(0)
    // Cancel long press timer when starting swipe
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // Handle swipe/drag move
  const handleSwipeMove = useCallback((clientX, clientY) => {
    if (!isDragging.current) return

    const deltaX = clientX - swipeStartX.current
    const deltaY = Math.abs(clientY - swipeStartY.current)

    // Only allow rightward swipes (positive deltaX)
    // And ensure it's more horizontal than vertical (prevent accidental swipes during scroll)
    // Require at least 10px horizontal movement to start swiping
    if (deltaX > 10 && deltaX > deltaY * 0.7) {
      // Cap the swipe at MAX_SWIPE
      const offset = Math.min(deltaX, MAX_SWIPE)
      setSwipeOffset(offset)
      // Add resistance after threshold
      if (offset > SWIPE_THRESHOLD) {
        const extra = offset - SWIPE_THRESHOLD
        const resistance = SWIPE_THRESHOLD + extra * 0.3 // Add resistance
        setSwipeOffset(Math.min(resistance, MAX_SWIPE))
      }
    } else if (deltaX < -10 || deltaY > deltaX * 0.7) {
      // Reset if swiping left or if vertical movement dominates (scrolling)
      setSwipeOffset(0)
      // Cancel drag if scrolling vertically
      if (deltaY > deltaX * 0.7) {
        isDragging.current = false
        setIsSwiping(false)
      }
    }
  }, [])

  // Handle swipe/drag end
  const handleSwipeEnd = useCallback(() => {
    if (!isDragging.current) return

    const currentOffset = swipeOffset
    const shouldReply = currentOffset >= SWIPE_THRESHOLD

    // Reset swipe state first
    isDragging.current = false
    setIsSwiping(false)
    setSwipeOffset(0)

    if (shouldReply) {
      // Trigger thread view or reply after a brief delay for smooth animation
      setTimeout(() => {
        hapticSuccess()
        // If we're in thread view, use the regular reply behavior
        // Otherwise, open the thread view for this message
        if (isInThreadView) {
          const target = getOriginalReplyTarget()
          onReply(target)
        } else if (onOpenThread) {
          // Open thread view with this message as the root (or find root if this is a reply)
          const rootMessage = msg.replyTo?.msgId 
            ? messages.find(m => m.id === msg.replyTo.msgId) || msg
            : msg
          onOpenThread(rootMessage)
        }
      }, 100)
    }
  }, [swipeOffset, getOriginalReplyTarget, onReply, isInThreadView, onOpenThread, msg, messages])

  // Touch start - start long press timer or swipe
  const handleTouchStart = useCallback(
    e => {
      // Ignore touches that happen within 300ms of action sheet closing
      // This prevents phantom touch events from re-triggering the menu
      const timeSinceActionSheetClosed = Date.now() - actionSheetClosedAt.current
      if (timeSinceActionSheetClosed < 300) {
        return
      }
      
      isLongPressTriggered.current = false
      handleSwipeStart(e.touches[0].clientX, e.touches[0].clientY)

      longPressTimer.current = setTimeout(() => {
        // Fire long press if user hasn't moved significantly (not swiping)
        // Note: swipeOffset would be > 0 if user started swiping
        isLongPressTriggered.current = true
        handleLongPress()
      }, 400)
    },
    [handleLongPress, handleSwipeStart]
  )

  // Touch end - check for double tap and triple tap
  const handleTouchEnd = useCallback(
    e => {
      // Clear long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }

      // Skip if long press was triggered or if we were swiping
      if (isLongPressTriggered.current || isDragging.current) {
        return
      }

      // Skip double-tap/triple-tap detection for images - let them open on single tap
      const target = e.target
      if (target.tagName === 'IMG' || target.closest('[data-image-tap]')) {
        // Reset tap timers so next non-image tap works correctly
        lastTapTime.current = 0
        secondLastTapTime.current = 0
        if (doubleTapTimer.current) {
          clearTimeout(doubleTapTimer.current)
          doubleTapTimer.current = null
        }
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

  // Touch move - handle swipe or cancel long press
  const handleTouchMove = useCallback(
    e => {
      if (isDragging.current) {
        handleSwipeMove(e.touches[0].clientX, e.touches[0].clientY)
        // Prevent default only if we're actually swiping horizontally
        if (swipeOffset > 10) {
          e.preventDefault()
        }
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
    },
    [handleSwipeMove, swipeOffset]
  )

  // Touch end - handle swipe end or tap detection
  const handleTouchEndWithSwipe = useCallback(
    e => {
      // ALWAYS clear the long press timer first to prevent it from firing
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
      
      // Check if we actually swiped (moved significantly)
      const didSwipe = swipeOffset > 10
      
      if (isDragging.current) {
        handleSwipeEnd()
        // Only skip tap detection if we actually swiped
        if (didSwipe) {
          return
        }
      }
      
      // Process tap detection if we didn't swipe
      handleTouchEnd(e)
    },
    [handleSwipeEnd, handleTouchEnd, swipeOffset]
  )

  // Trackpad gesture handlers for Mac
  const handleWheel = useCallback(
    e => {
      // Detect horizontal scroll (trackpad swipe)
      // Negative deltaX means swiping right (scrolling content right)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 30) {
        // Rightward swipe (negative deltaX means scrolling right, which is swipe right)
        if (e.deltaX < -30 && !isDragging.current) {
          e.preventDefault()
          e.stopPropagation()
          hapticSuccess()
          setTimeout(() => {
            // If we're in thread view, use regular reply behavior
            // Otherwise, open thread view
            if (isInThreadView) {
              const target = getOriginalReplyTarget()
              onReply(target)
            } else if (onOpenThread) {
              const rootMessage = msg.replyTo?.msgId 
                ? messages.find(m => m.id === msg.replyTo.msgId) || msg
                : msg
              onOpenThread(rootMessage)
            }
          }, 50)
        }
      }
    },
    [getOriginalReplyTarget, onReply, isInThreadView, onOpenThread, msg, messages]
  )

  // Mouse handlers for desktop drag (disabled - using trackpad gestures instead)
  const handleMouseDown = useCallback(() => {
    // Disabled - we use trackpad gestures instead
  }, [])

  const handleMouseMove = useCallback(() => {
    // Disabled
  }, [])

  const handleMouseUp = useCallback(() => {
    // Disabled
  }, [])

  // Trackpad gesture detection for Mac
  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    // Use wheel event to detect trackpad swipes
    element.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

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

  const isSent = msg.senderId === user?.uid
  const reactions = msg.reactions || {}

  // Memoize reaction aggregates to avoid recomputing per render
  const { reactionCounts, userReactedWith } = useMemo(() => {
    const counts = {}
    const mine = {}
    Object.entries(reactions).forEach(([userId, emoji]) => {
      if (!counts[emoji]) {
        counts[emoji] = { count: 0, userIds: [] }
      }
      counts[emoji].count++
      counts[emoji].userIds.push(userId)
      if (userId === user?.uid) {
        mine[emoji] = true
      }
    })
    return { reactionCounts: counts, userReactedWith: mine }
  }, [reactions, user?.uid])
  const hasImages = msg.imageUrl || (msg.imageUrls && msg.imageUrls.length > 0)
  const isJumboEmoji = msg.text && !hasImages && isSingleEmoji(msg.text)

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

  // Use precomputed reply counts when provided to avoid O(n^2) scans
  const originalMsgId = msg.replyTo?.msgId || msg.id
  const replyCountValue = typeof replyCount === 'number'
    ? replyCount
    : messages.filter(m => m.replyTo?.msgId === originalMsgId).length

  const isReplyTarget = replyingTo?.msgId === msg.id

  // Use precomputed sender-tail flag when provided to avoid scanning forward each render
  let isLastMessageFromSenderValue = isLastMessageFromSender
  if (typeof isLastMessageFromSenderValue !== 'boolean') {
    isLastMessageFromSenderValue = true
    for (let i = index + 1; i < totalMessages; i++) {
      if (messages[i].senderId === msg.senderId) {
        isLastMessageFromSenderValue = false
        break
      }
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
        } ${msg.senderId === 'ai' ? 'ai-message' : ''} ${isSwiping ? 'swiping' : ''}`}
        style={{
          transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : 'none',
          transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        onContextMenu={handleContextMenuWrapper}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEndWithSwipe}
        onTouchMove={handleTouchMove}
        onTouchCancel={handleTouchMove}
      >
        <div className='jumbo-emoji'>{msg.text}</div>
        {isSent && (
          <div className='message-timestamp-sent'>
            <MessageTimestamp timestamp={msg.timestamp} />
            {isDevMode && msg.aiTags && <DevTagInfo aiTags={msg.aiTags} />}
          </div>
        )}
        {!isSent && (
          <div className='message-timestamp-received'>
            <MessageTimestamp timestamp={msg.timestamp} />
            {isDevMode && msg.aiTags && <DevTagInfo aiTags={msg.aiTags} />}
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
          onClose={() => {
            actionSheetClosedAt.current = Date.now()
            setActionSheetOpen(false)
          }}
          message={msg}
          isOwnMessage={isOwnMessage}
          isPost={false}
          topReactions={topReactions}
          position={actionSheetPosition}
          currentUserId={user?.uid}
          onReaction={emoji => onAddReaction(msg.id, emoji)}
          onReply={() => {
            // If we're in thread view, use regular reply behavior
            // Otherwise, open thread view
            if (isInThreadView) {
              const target = getOriginalReplyTarget()
              onReply(target)
            } else if (onOpenThread) {
              const rootMessage = msg.replyTo?.msgId 
                ? messages.find(m => m.id === msg.replyTo.msgId) || msg
                : msg
              onOpenThread(rootMessage)
            }
          }}
          onVideoReply={handleVideoReply}
          onEdit={() => onEdit(msg.id, msg.text)}
          onDelete={() => onDelete?.(msg.id)}
          onPromote={() => onPromote?.(msg.id)}
          onAddToTeamMemory={() => onAddToTeamMemory?.(msg)}
          onMakePublic={() => onMakePublic?.(msg.id)}
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
      data-is-original={isOriginalInThread ? 'true' : undefined}
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
      } ${msg.senderId === 'ai' ? 'ai-message' : ''} ${isSwiping ? 'swiping' : ''} ${
        isOriginalInThread ? 'thread-original' : ''
      } ${msg.isPrivate ? 'private-message' : ''}`}
      style={{
        transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : 'none',
        transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
      onContextMenu={handleContextMenuWrapper}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEndWithSwipe}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchMove}
    >
      {/* Channel avatar - positioned to the left of the message like iMessage */}
      {/* Only show for messages WITHOUT replies - for replies, avatar shows next to actual message */}
      {!isSent &&
        currentChat.type === 'channel' &&
        msg.senderId !== 'ai' &&
        !msg.replyTo &&
        (() => {
          const senderUser = userMap?.[msg.senderId]
          const photoURL = msg.photoURL || senderUser?.photoURL
          const initial = (msg.sender || senderUser?.displayName || '?')[0].toUpperCase()
          return photoURL ? (
            <img src={photoURL} alt={msg.sender} className='message-avatar' />
          ) : (
            <div className='message-avatar-fallback'>{initial}</div>
          )
        })()}

      {/* Message content wrapper */}
      <div className='message-content-wrapper'>
        {/* Reply quote - shows above the message bubble like iMessage */}
        {msg.replyTo && (() => {
          // Look up the original message to get media (for old messages that don't have media in replyTo)
          const originalMsg = messages.find(m => m.id === msg.replyTo.msgId)
          
          // Get media from replyTo first, fallback to looking up the original message
          const replyImageUrl = msg.replyTo.imageUrl || originalMsg?.imageUrl
          const replyImageUrls = msg.replyTo.imageUrls || originalMsg?.imageUrls
          const replyMuxPlaybackIds = msg.replyTo.muxPlaybackIds || originalMsg?.muxPlaybackIds
          const replyAudioUrl = msg.replyTo.audioUrl || originalMsg?.audioUrl
          const replyAudioDuration = msg.replyTo.audioDuration || originalMsg?.audioDuration
          const replyText = msg.replyTo.text || originalMsg?.text
          
          const hasImages = replyImageUrl || replyImageUrls?.length > 0
          const hasVideos = replyMuxPlaybackIds?.length > 0
          const hasAudio = !!replyAudioUrl
          
          return (
          <div
            className='reply-quote-container'
            onClick={(e) => {
              e.stopPropagation()
              // Click on reply count opens thread, click elsewhere scrolls to message
              if (e.target.classList.contains('reply-quote-count')) {
                const rootMessage = messages.find(m => m.id === msg.replyTo.msgId)
                if (rootMessage && onOpenThread) {
                  onOpenThread(rootMessage)
                }
              } else {
                onScrollToMessage(msg.replyTo.msgId)
              }
            }}
          >
            {(() => {
              const replyUser = userMap?.[msg.replyTo.senderId] || allUsers.find(
                u => u.displayName === msg.replyTo.sender || u.email === msg.replyTo.sender
              )
              return replyUser?.photoURL ? (
                <img
                  src={replyUser.photoURL}
                  alt={msg.replyTo.sender}
                  className='reply-quote-avatar'
                />
              ) : (
                <div className='reply-quote-avatar-fallback'>
                  {(msg.replyTo.sender || '?')[0].toUpperCase()}
                </div>
              )
            })()}
            <div className='reply-quote'>
              {/* Image preview in reply */}
              {hasImages && (
                <div className='reply-quote-media'>
                  <img
                    src={replyImageUrls?.[0] || replyImageUrl}
                    alt='Reply image'
                    className='reply-quote-image'
                  />
                  {replyImageUrls?.length > 1 && (
                    <span className='reply-quote-image-count'>
                      +{replyImageUrls.length - 1}
                    </span>
                  )}
                </div>
              )}
              {/* Video preview in reply */}
              {hasVideos && (
                <div className='reply-quote-media'>
                  <img
                    src={`https://image.mux.com/${replyMuxPlaybackIds[0]}/thumbnail.jpg?width=80&height=80&fit_mode=crop`}
                    alt='Reply video'
                    className='reply-quote-video'
                  />
                  <div className='reply-quote-video-icon'>
                    <svg width='16' height='16' viewBox='0 0 16 16' fill='currentColor'>
                      <path d='M5 3l8 5-8 5V3z' />
                    </svg>
                  </div>
                </div>
              )}
              {/* Audio preview in reply - static waveform visualization */}
              {hasAudio && (
                <div className='reply-quote-audio'>
                  <div className='reply-quote-audio-icon'>
                    <svg width='14' height='14' viewBox='0 0 16 16' fill='currentColor'>
                      <path d='M3 5h2l3-3v12l-3-3H3V5z' />
                      <path d='M10.5 4.5a4 4 0 0 1 0 7M12 2a7 7 0 0 1 0 12' stroke='currentColor' strokeWidth='1.2' fill='none' />
                    </svg>
                  </div>
                  <div className='reply-quote-waveform'>
                    {/* Static waveform bars */}
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className='reply-quote-waveform-bar'
                        style={{ height: `${20 + Math.sin(i * 0.8) * 15 + Math.random() * 10}%` }}
                      />
                    ))}
                  </div>
                  {replyAudioDuration && (
                    <span className='reply-quote-audio-duration'>
                      {Math.floor(replyAudioDuration / 60)}:{String(Math.floor(replyAudioDuration % 60)).padStart(2, '0')}
                    </span>
                  )}
                </div>
              )}
              {/* Text preview */}
              {replyText && (
                <div className='reply-quote-text'>
                  {replyText.length > 500
                    ? `${replyText.slice(0, 500)}...`
                    : replyText}
                </div>
              )}
              {/* Fallback for empty text with no media */}
              {!replyText && !hasImages && !hasVideos && !hasAudio && (
                <div className='reply-quote-text reply-quote-empty'>
                  Message
                </div>
              )}
            </div>
          </div>
        )})()}
        {/* Reply count - outside and underneath the reply quote bubble */}
        {msg.replyTo && !isInThreadView && replyCountValue > 0 && (
          <div 
            className={`reply-count-indicator ${isSent ? 'sent' : 'received'}`}
            onClick={(e) => {
              e.stopPropagation()
              const rootMessage = messages.find(m => m.id === msg.replyTo.msgId)
              if (rootMessage && onOpenThread) {
                onOpenThread(rootMessage)
              }
            }}
          >
            {replyCountValue} {replyCountValue === 1 ? 'Reply' : 'Replies'}
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
            {msg.senderId === 'ai'
              ? msg.sender?.replace('🤖 ', '').replace('🤖', '')
              : userMap?.[msg.senderId]?.displayName || msg.sender}
            <MessageTimestamp timestamp={msg.timestamp} />
            {/* For AI messages: show combined cost breakdown (response + tagging) */}
            {msg.senderId === 'ai' && (msg.costBreakdown || msg.aiTags?._cost) && (
              <AICostBreakdown costBreakdown={msg.costBreakdown} aiTags={msg.aiTags} />
            )}
            {/* For non-AI messages: show tagging info separately */}
            {msg.senderId !== 'ai' && isDevMode && msg.aiTags && <DevTagInfo aiTags={msg.aiTags} />}
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
                  const currentIdx = repliestoSameMessage.findIndex(
                    v => v.playbackId === playbackId
                  )
                  setStoriesVideos(repliestoSameMessage)
                  setStoriesInitialIndex(currentIdx >= 0 ? currentIdx : 0)
                  setStoriesOpen(true)
                }}
              />
            ))}
          </div>
        )}
        {/* Sender avatar for received messages with replies - shows next to actual message */}
        <div className={`message-row ${msg.replyTo && !isSent ? 'with-avatar' : ''}`}>
          {!isSent && msg.replyTo && currentChat.type === 'channel' && msg.senderId !== 'ai' && (() => {
            const photoURL = msg.photoURL || allUsers.find(u => u.uid === msg.senderId)?.photoURL
            const initial = (msg.sender || '?')[0].toUpperCase()
            return photoURL ? (
              <img src={photoURL} alt={msg.sender} className='message-avatar reply-message-avatar' />
            ) : (
              <div className='message-avatar-fallback reply-message-avatar'>{initial}</div>
            )
          })()}
        <div className='message'>
          {/* Regular Mux videos (not replies) - clickable thumbnail that opens modal */}
          {msg.muxPlaybackIds && msg.muxPlaybackIds.length > 0 && !msg.replyTo && (
            <div className='message-videos'>
              {(() => {
                const imageCount = (msg.imageUrls?.length || (msg.imageUrl ? 1 : 0))
                const videoDimensions = msg.mediaDimensions || []
                const needsVideoMigration = !msg.mediaDimensions || msg.mediaDimensions.length <= imageCount
                
                // Handler for on-demand migration of video dimensions
                const handleVideoDimensionsMigrate = (videoIndex, newDimensions) => {
                  if (!needsVideoMigration) return
                  
                  // Build the full dimensions array (images + videos)
                  const existingDimensions = msg.mediaDimensions || []
                  const updatedDimensions = [...existingDimensions]
                  
                  // Video dimensions come after image dimensions
                  updatedDimensions[imageCount + videoIndex] = newDimensions
                  
                  // Only update if we have dimensions for all videos
                  const allVideosCollected = msg.muxPlaybackIds.every(
                    (_, i) => updatedDimensions[imageCount + i]
                  )
                  if (allVideosCollected) {
                    const chatType = currentChat.type // 'channel', 'dm', or 'group'
                    const chatId = chatType === 'dm' 
                      ? getDMId(user.uid, currentChat.id) 
                      : currentChat.id
                    
                    // Fire and forget - don't block UI
                    updateMessageMediaDimensions(chatId, msg.id, chatType, updatedDimensions)
                  }
                }
                
                return msg.muxPlaybackIds.map((playbackId, idx) => {
                  const dim = videoDimensions[imageCount + idx]
                  return (
                    <VideoThumbnail
                      key={idx}
                      playbackId={playbackId}
                      isReply={false}
                      width={dim?.width}
                      height={dim?.height}
                      videoIndex={idx}
                      onDimensionsMigrate={needsVideoMigration ? handleVideoDimensionsMigrate : undefined}
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
                  )
                })
              })()}
            </div>
          )}
          {/* Support multiple images or single image - with skeleton placeholders for layout stability */}
          {(msg.imageUrls || msg.imageUrl) && (
            <div
              className={`message-images ${(msg.imageUrls?.length || 1) > 1 ? 'multi-image' : ''}`}
            >
              {(() => {
                const allImages = (msg.imageUrls || [msg.imageUrl]).filter(Boolean)
                const dimensions = msg.mediaDimensions || []
                const isMultiImage = allImages.length > 1
                const needsMigration = !msg.mediaDimensions || msg.mediaDimensions.length === 0
                
                // Handler for on-demand migration of old messages without dimensions
                const handleDimensionsMigrate = (imageIndex, newDimensions) => {
                  if (!needsMigration) return
                  
                  // Build the full dimensions array
                  const updatedDimensions = [...dimensions]
                  updatedDimensions[imageIndex] = newDimensions
                  
                  // Only update if we have dimensions for all images
                  const allCollected = allImages.every((_, i) => updatedDimensions[i])
                  if (allCollected) {
                    const chatType = currentChat.type // 'channel', 'dm', or 'group'
                    const chatId = chatType === 'dm' 
                      ? getDMId(user.uid, currentChat.id) 
                      : currentChat.id
                    
                    // Fire and forget - don't block UI
                    updateMessageMediaDimensions(chatId, msg.id, chatType, updatedDimensions)
                  }
                }
                
                return allImages.map((url, idx) => {
                  // Get dimensions for this image (if available)
                  const dim = dimensions[idx]
                  const maxWidth = isMultiImage ? MAX_MULTI_IMAGE_WIDTH : MAX_MEDIA_WIDTH
                  const maxHeight = isMultiImage ? MAX_MULTI_IMAGE_HEIGHT : MAX_MEDIA_HEIGHT
                  
                  return (
                    <ImageWithSkeleton
                      key={idx}
                      src={url}
                      alt={`Shared image ${idx + 1}`}
                      width={dim?.width}
                      height={dim?.height}
                      maxWidth={maxWidth}
                      maxHeight={maxHeight}
                      imageIndex={idx}
                      onDimensionsMigrate={needsMigration ? handleDimensionsMigrate : undefined}
                      onClick={e => {
                        e.stopPropagation()
                        onImageClick(allImages, idx)
                      }}
                    />
                  )
                })
              })()}
            </div>
          )}
          
          {/* Voice message */}
          {msg.audioUrl && (
            <VoiceMessage
              audioUrl={msg.audioUrl}
              audioDuration={msg.audioDuration}
              isSent={isOwnMessage}
              transcription={msg.transcription}
            />
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
            <>
              {/* Check if message contains mindmap blocks */}
              {containsMindmap(msg.text) ? (
                // Split text into regular text and mindmap segments
                splitTextAndMindmaps(msg.text).map((segment, idx) => (
                  segment.type === 'mindmap' ? (
                    <MindmapView 
                      key={`mindmap-${idx}`}
                      markdown={segment.content}
                      title={segment.title}
                    />
                  ) : (
                    <div key={`text-${idx}`} className='text'>
                      {msg.senderId === 'ai' ?
                        linkifyAIText(segment.content, onImageClick, allUsers, user) :
                        linkifyText(segment.content, onImageClick, allUsers, user)
                      }
                    </div>
                  )
                ))
              ) : (
                // Regular text rendering
                <div className='text'>
                  {msg.senderId === 'ai' ?
                    linkifyAIText(msg.text, onImageClick, allUsers, user) :
                    linkifyText(msg.text, onImageClick, allUsers, user)
                  }
                  {msg.edited && <span className='edited-indicator'> (edited)</span>}
                  {msg.isPrivate && (
                    <span className='private-indicator' title='Only you can see this'>
                      <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                        <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'/>
                        <line x1='1' y1='1' x2='23' y2='23'/>
                      </svg>
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          {/* Link preview - show for URLs that aren't Loom videos */}
          {msg.text && extractFirstUrl(msg.text) && !isLoomUrl(msg.text) && (
            <LinkPreview 
              url={extractFirstUrl(msg.text)} 
              isSent={isOwnMessage}
              storedPreview={msg.linkPreview || null}
              onPreviewMigrate={!msg.linkPreview ? (previewData) => {
                // On-demand migration for old messages without stored link preview
                const chatType = currentChat.type // 'channel', 'dm', or 'group'
                const chatId = chatType === 'dm' 
                  ? getDMId(user.uid, currentChat.id) 
                  : currentChat.id
                updateMessageLinkPreview(chatId, msg.id, chatType, previewData)
              } : undefined}
            />
          )}
          
          {/* Image analysis TLDR - inside bubble, below user's caption */}
          {msg.imageAnalysis && (msg.imageUrl || msg.imageUrls?.length) && (() => {
            const tldrMatch = msg.imageAnalysis.match(/tldr:\s*(.+?)(?:\n|$)/i)
            const tldr = tldrMatch ? tldrMatch[1].trim() : null
            
            return tldr ? (
              <div className='image-analysis'>
                <span className='image-analysis-icon'>✨</span>
                <span className='image-analysis-content'>{tldr}</span>
              </div>
            ) : null
          })()}
        </div>
        </div>
        
        {/* End message-row */}
        {isSent && (
          <div className='message-timestamp-sent'>
            <MessageTimestamp timestamp={msg.timestamp} />
            {isDevMode && msg.aiTags && <DevTagInfo aiTags={msg.aiTags} />}
          </div>
        )}

        {/* Reactions Display */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className='reactions-display'>
            {Object.entries(reactionCounts).map(([emoji, data]) => {
              const reactedUsers = data.userIds
                .map(uid => userMap?.[uid])
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
                      {reactedUsers.map(reactedUser =>
                        reactedUser.photoURL ? (
                          <img
                            key={reactedUser.uid}
                            src={reactedUser.photoURL}
                            alt={reactedUser.displayName}
                            className='reaction-tooltip-avatar'
                            title={reactedUser.displayName || reactedUser.email}
                          />
                        ) : (
                          <div
                            key={reactedUser.uid}
                            className='reaction-tooltip-avatar-fallback'
                            title={reactedUser.displayName || reactedUser.email}
                          >
                            {(reactedUser.displayName || reactedUser.email || '?')[0].toUpperCase()}
                          </div>
                        )
                      )}
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
          isLastMessageFromSenderValue &&
          (() => {
            const otherUser = userMap?.[currentChat.id] || allUsers.find(u => u.uid === currentChat.id)
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
        onClose={() => {
          actionSheetClosedAt.current = Date.now()
          setActionSheetOpen(false)
        }}
        message={msg}
        isOwnMessage={isOwnMessage}
        isPost={false}
        topReactions={topReactions}
        position={actionSheetPosition}
        currentUserId={user?.uid}
        onReaction={emoji => onAddReaction(msg.id, emoji)}
        onReply={() => {
          // If we're in thread view, use regular reply behavior
          // Otherwise, open thread view
          if (isInThreadView) {
            const target = getOriginalReplyTarget()
            onReply(target)
          } else if (onOpenThread) {
            const rootMessage = msg.replyTo?.msgId 
              ? messages.find(m => m.id === msg.replyTo.msgId) || msg
              : msg
            onOpenThread(rootMessage)
          }
        }}
        onVideoReply={handleVideoReply}
        onEdit={() => onEdit(msg.id, msg.text)}
        onDelete={() => onDelete?.(msg.id)}
        onPromote={() => onPromote?.(msg.id)}
        onAddToTeamMemory={() => onAddToTeamMemory?.(msg)}
        onMakePublic={() => onMakePublic?.(msg.id)}
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

const areEqual = (prev, next) => {
  // Skip re-render when message reference and key props are unchanged
  if (
    prev.msg === next.msg &&
    prev.replyCount === next.replyCount &&
    prev.isLastMessageFromSender === next.isLastMessageFromSender &&
    prev.replyingTo?.msgId === next.replyingTo?.msgId &&
    prev.topReactions === next.topReactions &&
    prev.currentChat?.id === next.currentChat?.id &&
    prev.currentChat?.type === next.currentChat?.type &&
    prev.user?.uid === next.user?.uid
  ) {
    return true
  }
  return false
}

export default memo(MessageItem, areEqual)
