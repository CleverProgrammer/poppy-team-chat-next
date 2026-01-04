'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { hapticLight } from '../../utils/haptics';
import { ALL_EMOJIS } from '../../constants/emojis';
import { copyMessageRich, hasAnyContent } from '../../utils/copyMessage';

export default function MessageActionSheet({
  isOpen,
  onClose,
  message,
  isOwnMessage,
  isPost,
  reactionsOnly = false,
  topReactions = [],
  position = null, // { top, left } for contextual placement, null for centered
  onReaction,
  onReply,
  onVideoReply,
  onEdit,
  onDelete,
  onPromote,
  onDemote,
  onAddToTeamMemory,
  onAskAI,
  onUndoAIResponse,
  onMakePublic,
  currentUserId = null, // For checking private message ownership
}) {
  const openTimeRef = useRef(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Track when menu opens to prevent immediate close from synthetic click
  useEffect(() => {
    if (isOpen) {
      openTimeRef.current = Date.now();
      setShowEmojiPicker(false); // Reset when opening
    }
  }, [isOpen]);

  // Close handler with delay protection
  const handleOverlayClick = useCallback(() => {
    // Ignore clicks within 300ms of opening (iOS fires synthetic click after touch)
    const timeSinceOpen = Date.now() - openTimeRef.current;
    if (timeSinceOpen < 300) {
      return;
    }
    onClose();
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !message) return null;

  const handleReaction = (emoji) => {
    hapticLight();
    onReaction?.(emoji);
    onClose();
  };

  const handleAction = (action) => {
    hapticLight();
    action?.();
    onClose();
  };

  // Copy message with all content (text, images, videos)
  const handleCopy = async () => {
    try {
      const success = await copyMessageRich(message);
      if (success) {
        hapticLight();
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
    onClose();
  };

  // Calculate positioning style - always center horizontally
  const getPositionStyle = () => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
    
    if (reactionsOnly && position) {
      // Position above the message, but always centered horizontally
      return {
        position: 'fixed',
        top: `${Math.max(80, position.top - 60)}px`, // 60px above message, min 80px from top
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }
    // Centered for full menu
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  };

  const content = (
    <>
      {/* Backdrop - tap to close (with delay to prevent iOS synthetic click) */}
      <div className="action-sheet-overlay" onClick={handleOverlayClick} />
      
      {/* Floating pill */}
      <div 
        className={`action-sheet-content ${reactionsOnly ? 'reactions-only' : ''}`}
        style={getPositionStyle()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Reactions row */}
        {!isPost && topReactions.length > 0 && !showEmojiPicker && (
          <div className="action-sheet-reactions">
            {topReactions.slice(0, 6).map((emoji) => (
              <button
                key={emoji}
                className="action-sheet-reaction-btn"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </button>
            ))}
            {/* Plus button to show full emoji picker */}
            <button
              className="action-sheet-reaction-btn action-sheet-more-btn"
              onClick={() => {
                hapticLight();
                setShowEmojiPicker(true);
              }}
            >
              +
            </button>
          </div>
        )}

        {/* Full emoji picker */}
        {!isPost && showEmojiPicker && (
          <div className="action-sheet-emoji-picker">
            <div className="emoji-picker-header">
              <button 
                className="emoji-picker-back"
                onClick={() => setShowEmojiPicker(false)}
              >
                ←
              </button>
              <span>All Reactions</span>
            </div>
            <div className="emoji-picker-grid">
              {ALL_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-picker-btn"
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons - only show if not reactions-only */}
        {!reactionsOnly && (
          <div className="action-sheet-actions">
            {!isPost && (
              <button className="action-sheet-action-btn" onClick={() => handleAction(onReply)}>
                <span className="action-icon">↩</span>
                <span>Reply</span>
              </button>
            )}
            {!isPost && onVideoReply && (
              <button className="action-sheet-action-btn" onClick={() => handleAction(onVideoReply)}>
                <span className="action-icon">🎬</span>
                <span>Video Reply</span>
              </button>
            )}
            {/* Ask AI - available for any message with text or images */}
            {!isPost && (message?.text || message?.content || message?.imageUrl || message?.imageUrls?.length) && onAskAI && (
              <button className="action-sheet-action-btn" onClick={() => handleAction(onAskAI)}>
                <span className="action-icon">✨</span>
                <span>Ask AI</span>
              </button>
            )}
            {isOwnMessage && (
              <button className="action-sheet-action-btn" onClick={() => handleAction(onAddToTeamMemory)}>
                <span className="action-icon">🧠</span>
                <span>Team Memory</span>
              </button>
            )}
            {/* Copy - for any message with content (text, images, videos, audio) */}
            {hasAnyContent(message) && (
              <button className="action-sheet-action-btn" onClick={handleCopy}>
                <span className="action-icon">📋</span>
                <span>Copy</span>
              </button>
            )}
            {/* Make Public - for own private messages OR messages private for this user */}
            {message?.isPrivate && (isOwnMessage || message?.privateFor === currentUserId) && (
              <button className="action-sheet-action-btn make-public-btn" onClick={() => handleAction(onMakePublic)}>
                <span className="action-icon">👀</span>
                <span>Show to everyone</span>
              </button>
            )}
            {isOwnMessage && !isPost && (
              <button className="action-sheet-action-btn" onClick={() => handleAction(onEdit)}>
                <span className="action-icon">✏️</span>
                <span>Edit</span>
              </button>
            )}
            {!isPost && (
              <button className="action-sheet-action-btn" onClick={() => handleAction(onPromote)}>
                <span className="action-icon">📌</span>
                <span>Make it a post</span>
              </button>
            )}
            {isPost && (
              <button className="action-sheet-action-btn" onClick={() => handleAction(onDemote)}>
                <span className="action-icon">💬</span>
                <span>Make it a message</span>
              </button>
            )}
            {/* Undo AI Response - only for AI messages */}
            {message?.senderId === 'ai' && onUndoAIResponse && (
              <button className="action-sheet-action-btn" onClick={() => handleAction(onUndoAIResponse)}>
                <span className="action-icon">↩️</span>
                <span>Undo AI Response</span>
              </button>
            )}
            {isOwnMessage && !isPost && (
              <button className="action-sheet-action-btn" onClick={() => handleAction(onDelete)}>
                <span className="action-icon">💀</span>
                <span>Undo Send</span>
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );

  // Use portal to render at document body level
  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  
  return null;
}
