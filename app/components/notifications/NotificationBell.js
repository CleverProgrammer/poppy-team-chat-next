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

function NotificationBellInner() {
  const [isVisible, setIsVisible] = useState(false);
  const buttonRef = useRef(null);
  const { feedClient } = useKnockFeed();
  const prevUnseenCountRef = useRef(0);

  useEffect(() => {
    if (!feedClient) return;

    // Listen for new notifications
    const handleNotificationsReceived = (data) => {
      const currentUnseenCount = data.metadata.unread_count || 0;
      const prevUnseenCount = prevUnseenCountRef.current;

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
  }, [feedClient]);

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
    <div style={{ position: 'relative' }}>
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

export default function NotificationBell() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <KnockProvider
      apiKey={process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY}
      userId={user.uid}
    >
      <KnockFeedProvider feedId={process.env.NEXT_PUBLIC_KNOCK_FEED_ID}>
        <NotificationBellInner />
      </KnockFeedProvider>
    </KnockProvider>
  );
}
