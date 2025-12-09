'use client';

import { useState, useEffect, useCallback } from 'react';
import { addReaction, getEmojiUsage, updateEmojiUsage, getDMId } from '../lib/firestore';
import { DEFAULT_EMOJIS, ALL_EMOJIS } from '../constants/emojis';

export function useReactions(user, currentChat) {
  const [emojiUsage, setEmojiUsage] = useState({});
  const [topReactions, setTopReactions] = useState(DEFAULT_EMOJIS);
  const [openEmojiPanel, setOpenEmojiPanel] = useState(null);

  // Load emoji usage from Firestore
  useEffect(() => {
    if (!user) return;

    getEmojiUsage(user.uid).then((usage) => {
      setEmojiUsage(usage);
    });
  }, [user]);

  // Sort topReactions based on emoji usage
  useEffect(() => {
    // Sort by usage count (descending)
    const sortedEmojis = [...ALL_EMOJIS].sort((a, b) => {
      const countA = emojiUsage[a] || 0;
      const countB = emojiUsage[b] || 0;
      return countB - countA;
    });

    // Take top 10
    setTopReactions(sortedEmojis.slice(0, 10));
  }, [emojiUsage]);

  // Close emoji panel on click outside or escape
  useEffect(() => {
    const handleClick = (e) => {
      if (e.target.closest('.emoji-panel') || e.target.closest('.more-reactions-btn')) {
        return;
      }
      setOpenEmojiPanel(null);
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setOpenEmojiPanel(null);
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleAddReaction = useCallback(async (messageId, emoji) => {
    if (!user) return;

    const isDM = currentChat.type === 'dm';
    const chatId = isDM ? getDMId(user.uid, currentChat.id) : currentChat.id;

    try {
      await addReaction(chatId, messageId, user.uid, emoji, isDM);
      setOpenEmojiPanel(null);

      // Update emoji usage count
      await updateEmojiUsage(user.uid, emoji);

      // Update local state to reflect new usage immediately
      setEmojiUsage(prev => ({
        ...prev,
        [emoji]: (prev[emoji] || 0) + 1
      }));
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  }, [user, currentChat]);

  const toggleEmojiPanel = useCallback((messageId) => {
    setOpenEmojiPanel(prev => prev === messageId ? null : messageId);
  }, []);

  return {
    emojiUsage,
    topReactions,
    openEmojiPanel,
    handleAddReaction,
    toggleEmojiPanel,
    setOpenEmojiPanel
  };
}
