'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import MessageItem from './MessageItem'

/**
 * ThreadView - iMessage-style thread overlay
 * Shows threaded replies with a Gaussian blur on the background messages
 * The thread messages appear as if they're part of the regular message list
 */
export default function ThreadView({
  isOpen,
  onClose,
  originalMessage,
  threadMessages,
  allMessages,
  user,
  currentChat,
  allUsers,
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
  onSendThreadReply, // Function to send a reply directly from thread view
}) {
  const [mounted, setMounted] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const threadContainerRef = useRef(null)
  const inputRef = useRef(null)
  const messageRefs = useRef({})

  useEffect(() => {
    setMounted(true)
    // Detect mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => {
      setMounted(false)
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  // Scroll to bottom of thread when opened and focus input on desktop
  useEffect(() => {
    if (isOpen && threadContainerRef.current) {
      setTimeout(() => {
        threadContainerRef.current.scrollTop = threadContainerRef.current.scrollHeight
        // Auto-focus input on desktop
        if (!isMobile && inputRef.current) {
          inputRef.current.focus()
        }
      }, 100)
    }
  }, [isOpen, threadMessages.length, isMobile])

  // Handle escape key to close (only when not typing)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        // If input has focus and has text, first clear the input
        if (document.activeElement === inputRef.current && replyText.trim()) {
          setReplyText('')
          return
        }
        handleClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, replyText])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }, [onClose])

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }, [handleClose])

  // Send reply directly from thread view (desktop feature)
  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || sending || !onSendThreadReply) return
    
    setSending(true)
    try {
      await onSendThreadReply(replyText.trim(), {
        msgId: originalMessage.id,
        sender: originalMessage.sender,
        text: originalMessage.text || originalMessage.content || ''
      })
      setReplyText('')
      // Scroll to bottom after sending
      setTimeout(() => {
        if (threadContainerRef.current) {
          threadContainerRef.current.scrollTop = threadContainerRef.current.scrollHeight
        }
      }, 100)
    } catch (error) {
      console.error('Error sending thread reply:', error)
    } finally {
      setSending(false)
    }
  }, [replyText, sending, onSendThreadReply, originalMessage])

  // Handle Enter key to send (desktop)
  const handleInputKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendReply()
    }
  }, [handleSendReply])

  // Handle reply within thread - for mobile, opens the main reply interface
  const handleThreadReply = useCallback((msgId, sender, text) => {
    // Always reply to the original message, not to replies
    onReply({
      msgId: originalMessage.id,
      sender: originalMessage.sender,
      text: originalMessage.text || originalMessage.content || '',
      imageUrl: originalMessage.imageUrl || null,
      imageUrls: originalMessage.imageUrls || null,
      audioUrl: originalMessage.audioUrl || null,
      audioDuration: originalMessage.audioDuration || null,
      muxPlaybackIds: originalMessage.muxPlaybackIds || null,
    })
    handleClose()
  }, [originalMessage, onReply, handleClose])

  const handleThreadVideoReply = useCallback((msgId, sender, text) => {
    // Always reply to the original message
    onVideoReply(originalMessage.id, originalMessage.sender, originalMessage.text || originalMessage.content || '')
    handleClose()
  }, [originalMessage, onVideoReply, handleClose])

  if (!isOpen || !mounted) return null

  // Combine original message with thread replies
  const allThreadMessages = [originalMessage, ...threadMessages].sort((a, b) => {
    const aTime = a.timestamp?.seconds || 0
    const bTime = b.timestamp?.seconds || 0
    return aTime - bTime
  })

  const portalContent = (
    <div 
      className={`thread-view-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleBackdropClick}
    >
      {/* Thread container - looks like a floating message list */}
      <div className="thread-view-container">
        {/* Thread header */}
        <div className="thread-view-header">
          <button 
            className="thread-view-close-btn"
            onClick={handleClose}
            aria-label="Close thread"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="thread-view-title">
            <span className="thread-view-title-text">Thread</span>
            <span className="thread-view-count">{threadMessages.length} {threadMessages.length === 1 ? 'reply' : 'replies'}</span>
          </div>
          <div className="thread-view-spacer" />
        </div>

        {/* Thread messages - styled exactly like the main message list */}
        <div 
          ref={threadContainerRef}
          className="thread-view-messages"
        >
          {allThreadMessages.map((msg, index) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              index={index}
              messages={allThreadMessages}
              totalMessages={allThreadMessages.length}
              user={user}
              currentChat={currentChat}
              allUsers={allUsers}
              replyingTo={null}
              topReactions={topReactions}
              onReply={handleThreadReply}
              onVideoReply={handleThreadVideoReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onPromote={onPromote}
              onAddToTeamMemory={onAddToTeamMemory}
              onAddReaction={onAddReaction}
              onImageClick={onImageClick}
              onScrollToMessage={onScrollToMessage}
              messageRef={(el) => (messageRefs.current[msg.id] = el)}
              isInThreadView={true}
              isOriginalInThread={msg.id === originalMessage?.id}
            />
          ))}
        </div>

        {/* Reply input at bottom */}
        <div className="thread-view-reply-area">
          {isMobile ? (
            // Mobile: tap to open main reply interface
            <div className="thread-view-reply-prompt" onClick={() => handleThreadReply()}>
              <div className="thread-view-reply-input-fake">
                <span>Reply to thread...</span>
              </div>
            </div>
          ) : (
            // Desktop: real input field
            <div className="thread-view-reply-input-container">
              <textarea
                ref={inputRef}
                className="thread-view-reply-input"
                placeholder="Reply to thread..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleInputKeyDown}
                rows={1}
                disabled={sending}
              />
              <button
                className={`thread-view-send-btn ${replyText.trim() ? 'active' : ''}`}
                onClick={handleSendReply}
                disabled={!replyText.trim() || sending}
                aria-label="Send reply"
              >
                {sending ? (
                  <div className="thread-view-sending-spinner" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(portalContent, document.body)
}
