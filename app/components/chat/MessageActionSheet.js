'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { hapticLight } from '../../utils/haptics';

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
  onEdit,
  onDelete,
  onPromote,
  onDemote,
  onAddToTeamMemory,
}) {
  const openTimeRef = useRef(0);

  // Track when menu opens to prevent immediate close from synthetic click
  useEffect(() => {
    if (isOpen) {
      openTimeRef.current = Date.now();
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

  // Copy message text
  const handleCopy = async () => {
    const text = message?.text || message?.content;
    if (text) {
      try {
        await navigator.clipboard.writeText(text.trim());
        hapticLight();
      } catch (err) {
        console.error('Failed to copy:', err);
      }
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
        {!isPost && topReactions.length > 0 && (
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
            {isOwnMessage && (
              <button className="action-sheet-action-btn" onClick={() => handleAction(onAddToTeamMemory)}>
                <span className="action-icon">🧠</span>
                <span>Add to Team AI Memory</span>
              </button>
            )}
            {/* Copy - only if message has text */}
            {(message?.text || message?.content) && (
              <button className="action-sheet-action-btn" onClick={handleCopy}>
                <span className="action-icon">📋</span>
                <span>Copy</span>
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
