'use client';

import { useState, useRef, useEffect } from 'react';
import {
  KnockProvider,
  KnockFeedProvider,
  NotificationIconButton,
  NotificationFeedPopover,
  useKnockFeed,
} from '@knocklabs/react';
import { useAuth } from '../../contexts/AuthContext';

function NotificationBellInner({ onUnreadChatsChange, onMarkChatRead }) {
  const [isVisible, setIsVisible] = useState(false);
  const buttonRef = useRef(null);
  const { feedClient } = useKnockFeed();
  const prevUnseenCountRef = useRef(0);
  const [hasUnreads, setHasUnreads] = useState(false);

  useEffect(() => {
    if (!feedClient) return;

    // Listen for new notifications
    const handleNotificationsReceived = (data) => {
      const currentUnseenCount = data.metadata.unread_count || 0;
      const prevUnseenCount = prevUnseenCountRef.current;

      // Update hasUnreads state
      setHasUnreads(currentUnseenCount > 0);

      // Extract unread chats from notification items
      const unreadChatIds = new Set();
      if (data.items) {
        data.items.forEach(item => {
          if (!item.read_at && item.data) {
            // Extract chat identifier from notification data
            if (item.data.channelId) {
              unreadChatIds.add(`channel:${item.data.channelId}`);
            } else if (item.data.senderId) {
              unreadChatIds.add(`dm:${item.data.senderId}`);
            }
          }
        });
      }

      // Notify parent component of unread chats
      if (onUnreadChatsChange) {
        onUnreadChatsChange(Array.from(unreadChatIds));
      }

      // Play sound if unseen count increased and tab is not focused
      if (currentUnseenCount > prevUnseenCount && document.hidden) {
        console.log('🔔 Playing notification sound');
        playNotificationSound();
      }

      prevUnseenCountRef.current = currentUnseenCount;
    };

    feedClient.on('items.received.realtime', handleNotificationsReceived);

    return () => {
      feedClient.off('items.received.realtime', handleNotificationsReceived);
    };
  }, [feedClient, onUnreadChatsChange]);

  // Expose mark as read function to parent
  useEffect(() => {
    if (!feedClient || !onMarkChatRead) return;

    const markChatAsRead = async (chatType, chatId) => {
      try {
        const feed = await feedClient.fetch();
        const itemsToMark = feed.entries.filter(item => {
          if (chatType === 'channel') {
            return item.data?.channelId === chatId && !item.read_at;
          } else {
            return item.data?.senderId === chatId && !item.read_at;
          }
        });

        if (itemsToMark.length > 0) {
          const itemIds = itemsToMark.map(item => item.id);
          await feedClient.markAsRead(itemIds);
        }
      } catch (error) {
        console.error('Error marking chat as read:', error);
      }
    };

    onMarkChatRead(markChatAsRead);
  }, [feedClient, onMarkChatRead]);

  const playNotificationSound = () => {
    // Create a simple notification sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  return (
    <div className="notification-bell-wrapper">
      <NotificationIconButton
        ref={buttonRef}
        onClick={() => setIsVisible(!isVisible)}
      />
      <NotificationFeedPopover
        buttonRef={buttonRef}
        isVisible={isVisible}
        onClose={() => setIsVisible(false)}
      />
    </div>
  );
}

export default function NotificationBell({ onUnreadChatsChange, onMarkChatRead }) {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <KnockProvider
      apiKey={process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY}
      userId={user.uid}
    >
      <KnockFeedProvider feedId={process.env.NEXT_PUBLIC_KNOCK_FEED_ID}>
        <NotificationBellInner
          onUnreadChatsChange={onUnreadChatsChange}
          onMarkChatRead={onMarkChatRead}
        />
      </KnockFeedProvider>
    </KnockProvider>
  );
}
