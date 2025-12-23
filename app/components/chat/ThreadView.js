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
}) {
  const [mounted, setMounted] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const threadContainerRef = useRef(null)
  const messageRefs = useRef({})

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Scroll to bottom of thread when opened
  useEffect(() => {
    if (isOpen && threadContainerRef.current) {
      setTimeout(() => {
        threadContainerRef.current.scrollTop = threadContainerRef.current.scrollHeight
      }, 100)
    }
  }, [isOpen, threadMessages.length])

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

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

  // Handle reply within thread - replies to original message
  const handleThreadReply = useCallback((msgId, sender, text) => {
    // Always reply to the original message, not to replies
    onReply(originalMessage.id, originalMessage.sender, originalMessage.text || originalMessage.content || '')
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

        {/* Reply prompt at bottom */}
        <div className="thread-view-reply-prompt" onClick={() => handleThreadReply()}>
          <div className="thread-view-reply-input-fake">
            <span>Reply to thread...</span>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(portalContent, document.body)
}
