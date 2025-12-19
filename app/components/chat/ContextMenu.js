'use client';

import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { hapticLight, hapticSelection } from '../../utils/haptics';
import { ALL_EMOJIS } from '../../constants/emojis';

export default function ContextMenu({
  contextMenu,
  setContextMenu,
  user,
  onReply,
  onVideoReply,
  onEdit,
  onDelete,
  onPromote,
  onDemote,
  onAddToTeamMemory,
  topReactions = [],
  onAddReaction,
  reactionsOnly = false  // When true, only show reactions (for double-tap)
}) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, isVisible: false });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Reset emoji picker when menu closes/opens
  useEffect(() => {
    if (!contextMenu) {
      setShowEmojiPicker(false);
    }
  }, [contextMenu]);
  
  // Position the menu centered and visible on screen
  useLayoutEffect(() => {
    if (!contextMenu) {
      setPosition(prev => ({ ...prev, isVisible: false }));
      return;
    }
    
    // Set visible immediately for reactions-only (simpler positioning)
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const padding = 20;
    
    // Center horizontally and vertically
    let left = viewportWidth / 2 - 150; // Approximate menu width
    let top = viewportHeight / 2 - 50;
    
    // Ensure bounds
    if (left < padding) left = padding;
    if (top < padding) top = padding;
    
    setPosition({ top, left, isVisible: true });
  }, [contextMenu]);
  
  if (!contextMenu) return null;

  const { message } = contextMenu;
  const isOwnMessage = message.senderId === user?.uid;
  const isPost = message.isPost;

  const handleReply = () => {
    onReply(message.id, message.sender, message.text || message.content);
    setContextMenu(null);
  };

  const handleVideoReply = () => {
    onVideoReply?.(message.id, message.sender, message.text || message.content || '');
    setContextMenu(null);
  };

  const handleEdit = () => {
    onEdit(message.id, message.text || message.content);
    setContextMenu(null);
  };

  const handleDelete = () => {
    onDelete(message.id);
    setContextMenu(null);
  };

  const handlePromote = () => {
    onPromote(message.id);
    setContextMenu(null);
  };

  const handleDemote = () => {
    onDemote(message.id);
    setContextMenu(null);
  };

  const handleAddToTeamMemory = () => {
    onAddToTeamMemory(message);
    setContextMenu(null);
  };

  const handleCopy = async () => {
    const text = message?.text || message?.content;
    if (text) {
      try {
        await navigator.clipboard.writeText(text.trim());
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
    setContextMenu(null);
  };

  const handleReaction = (emoji) => {
    hapticLight();
    if (onAddReaction) {
      onAddReaction(message.id, emoji);
    }
    setContextMenu(null);
  };

  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className="context-menu-backdrop"
        onClick={() => setContextMenu(null)}
      />
      
      {/* Simple centered menu */}
      <div
        ref={menuRef}
        className="context-menu"
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          opacity: position.isVisible ? 1 : 0,
          pointerEvents: position.isVisible ? 'auto' : 'none',
          zIndex: 10001,
        }}
        onClick={(e) => e.stopPropagation()}
      >
          {/* Reactions Row at the top */}
          {!isPost && topReactions.length > 0 && !showEmojiPicker && (
            <div className="context-menu-reactions">
              {topReactions.slice(0, 6).map(emoji => (
                <button
                  key={emoji}
                  className="context-menu-reaction-btn"
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
              {/* Plus button to show full emoji picker */}
              <button
                className="context-menu-reaction-btn context-menu-more-btn"
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
            <div className="context-menu-emoji-picker">
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
          
          {/* Divider between reactions and actions - only if not reactions-only mode */}
          {!reactionsOnly && !isPost && topReactions.length > 0 && (
            <div className="context-menu-divider" />
          )}
          
          {/* Action buttons - hidden in reactions-only mode */}
          {!reactionsOnly && (
            <div className="context-menu-actions">
              {/* 1. Reply */}
              {!isPost && <button onClick={handleReply}>↩ Reply</button>}
              {/* 2. Video Reply */}
              {!isPost && onVideoReply && <button onClick={handleVideoReply}>🎬 Video Reply</button>}
              {/* 3. Add to Team Memory */}
              {isOwnMessage && (
                <button onClick={handleAddToTeamMemory}>🧠 Add to Team AI Memory</button>
              )}
              {/* 3. Copy */}
              {(message?.text || message?.content) && (
                <button onClick={handleCopy}>📋 Copy</button>
              )}
              {/* 4. Edit */}
              {isOwnMessage && !isPost && (
                <button onClick={handleEdit}>✏️ Edit</button>
              )}
              {/* 4. Make it a post / Make it a message */}
              {!isPost && <button onClick={handlePromote}>📌 Make it a post</button>}
              {isPost && <button onClick={handleDemote}>💬 Make it a message</button>}
              {/* 5. Undo Send (last) */}
              {isOwnMessage && !isPost && (
                <button onClick={handleDelete}>💀 Undo Send</button>
              )}
            </div>
          )}
        </div>
    </>
  );
}
