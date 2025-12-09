'use client';

import { useEffect } from 'react';

export function useKeyboardShortcuts({
  user,
  messages,
  previewModalImage,
  setPreviewModalImage,
  replyingTo,
  editingMessage,
  setIsPaletteOpen,
  startReply,
  startEdit,
  cancelReply
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K: Open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(true);
      }

      // Escape: Close modals/states
      if (e.key === 'Escape') {
        if (previewModalImage) {
          setPreviewModalImage(null);
        } else if (replyingTo) {
          cancelReply();
        }
      }

      // Cmd+R: Reply to most recent message from another person
      if ((e.metaKey || e.ctrlKey) && e.key === 'r' && !editingMessage && !replyingTo) {
        e.preventDefault();
        const otherPersonMessages = messages.filter(msg => msg.senderId !== user?.uid);
        if (otherPersonMessages.length > 0) {
          const lastMsg = otherPersonMessages[otherPersonMessages.length - 1];
          startReply(lastMsg.id, lastMsg.sender, lastMsg.text);
        }
      }

      // Cmd+E: Edit most recently sent message
      if ((e.metaKey || e.ctrlKey) && e.key === 'e' && !editingMessage && !replyingTo) {
        e.preventDefault();
        const myMessages = messages.filter(msg => msg.senderId === user?.uid);
        if (myMessages.length > 0) {
          const lastMyMsg = myMessages[myMessages.length - 1];
          startEdit(lastMyMsg.id, lastMyMsg.text);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    user,
    messages,
    previewModalImage,
    setPreviewModalImage,
    replyingTo,
    editingMessage,
    setIsPaletteOpen,
    startReply,
    startEdit,
    cancelReply
  ]);
}
