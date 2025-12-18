'use client';

import { useRef, useState, useLayoutEffect } from 'react';

export default function ContextMenu({
  contextMenu,
  setContextMenu,
  user,
  onReply,
  onEdit,
  onDelete,
  onPromote,
  onDemote,
  onAddToTeamMemory,
  topReactions = [],
  onAddReaction
}) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, isVisible: false });
  
  // Position the menu centered and visible on screen
  useLayoutEffect(() => {
    if (!contextMenu) {
      setPosition(prev => ({ ...prev, isVisible: false }));
      return;
    }
    
    const rafId = requestAnimationFrame(() => {
      if (!menuRef.current) return;
      
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const padding = 20;
      
      // Center horizontally
      let left = (viewportWidth - menuRect.width) / 2;
      
      // Center vertically (slightly above center looks better)
      let top = (viewportHeight - menuRect.height) / 2 - 40;
      
      // Ensure bounds
      if (left < padding) left = padding;
      if (left + menuRect.width > viewportWidth - padding) {
        left = viewportWidth - menuRect.width - padding;
      }
      if (top < padding) top = padding;
      if (top + menuRect.height > viewportHeight - padding) {
        top = viewportHeight - menuRect.height - padding;
      }
      
      setPosition({ top, left, isVisible: true });
    });
    
    return () => cancelAnimationFrame(rafId);
  }, [contextMenu]);
  
  if (!contextMenu) return null;

  const { message } = contextMenu;
  const isOwnMessage = message.senderId === user?.uid;
  const isPost = message.isPost;

  const handleReply = () => {
    onReply(message.id, message.sender, message.text || message.content);
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

  const handleReaction = (emoji) => {
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
          {!isPost && topReactions.length > 0 && (
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
            </div>
          )}
          
          {/* Divider between reactions and actions */}
          {!isPost && topReactions.length > 0 && (
            <div className="context-menu-divider" />
          )}
          
          {/* Action buttons */}
          <div className="context-menu-actions">
            {!isPost && <button onClick={handleReply}>↩ Reply</button>}
            {isOwnMessage && !isPost && (
              <>
                <button onClick={handleEdit}>✏️ Edit</button>
                <button onClick={handleDelete}>💀 Undo Send</button>
              </>
            )}
            {/* Promote/Demote options */}
            {!isPost && <button onClick={handlePromote}>📌 Make it a post</button>}
            {isPost && <button onClick={handleDemote}>💬 Make it a message</button>}
            {/* Team AI Memory - only for own messages */}
            {isOwnMessage && (
              <button onClick={handleAddToTeamMemory}>🧠 Add to Team AI Memory</button>
            )}
          </div>
        </div>
    </>
  );
}
