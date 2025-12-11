'use client';

import { useState, useEffect, useRef } from 'react';
import { Howl } from 'howler';
import {
  subscribeToMessages,
  subscribeToMessagesDM,
  subscribeToUsers,
  subscribeToActiveDMs,
  subscribeToAIMessages,
  subscribeToTypingStatus,
  discoverExistingDMs,
  getCurrentChat,
  addActiveDM,
  getDMId,
  markDMMessagesAsRead,
  markChatAsRead
} from '../lib/firestore';

export function useSubscriptions({
  user,
  currentChat,
  setCurrentChat,
  setMessages,
  messagesEndRef,
  inputRef
}) {
  const [allUsers, setAllUsers] = useState([]);
  const [activeDMs, setActiveDMs] = useState([]);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [currentMessages, setCurrentMessages] = useState([]);

  const previousMessagesRef = useRef([]);
  const soundRef = useRef(null);
  const messagesRef = useRef([]);
  const isTabHiddenRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const globalMessageCountsRef = useRef({});

  // Load saved chat on mount
  useEffect(() => {
    if (!user) return;

    getCurrentChat(user.uid).then((savedChat) => {
      console.log('📌 Loaded saved chat from Firestore:', savedChat);
      if (savedChat) {
        setCurrentChat(savedChat);
        if (savedChat.type === 'dm') {
          addActiveDM(user.uid, savedChat.id);
        }
      } else {
        console.log('📌 No saved chat found, defaulting to general');
        setCurrentChat({ type: 'channel', id: 'general', name: 'general' });
      }
    });
  }, [user, setCurrentChat]);

  // Load all users
  useEffect(() => {
    const unsubscribe = subscribeToUsers((users) => {
      setAllUsers(users);
    });
    return () => unsubscribe();
  }, []);

  // Discover existing DMs when user logs in
  useEffect(() => {
    if (!user) return;
    discoverExistingDMs(user.uid);
  }, [user]);

  // Subscribe to active DMs from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToActiveDMs(user.uid, (dms) => {
      setActiveDMs(dms);
    });
    return () => unsubscribe();
  }, [user]);

  // Global sound notifications - listen to ALL chats for notifications
  useEffect(() => {
    if (!user) return;

    const unsubscribers = [];

    // Subscribe to general channel
    const channelUnsub = subscribeToMessages('general', (messages) => {
      const chatKey = 'channel:general';
      const previousCount = globalMessageCountsRef.current[chatKey] || 0;
      const currentCount = messages.length;

      console.log(`🌍 Global listener - Channel general: ${currentCount} messages (was ${previousCount})`);

      if (previousCount > 0 && currentCount > previousCount) {
        const newMessages = messages.slice(previousCount);
        newMessages.forEach(msg => {
          if (msg.senderId !== user.uid && !msg.optimistic && isTabHiddenRef.current) {
            console.log(`🔔 Global notification - New message in general channel from ${msg.sender}`);
            playKnockSound();
          }
        });
      }

      globalMessageCountsRef.current[chatKey] = currentCount;
    });
    unsubscribers.push(channelUnsub);

    // Subscribe to all active DMs
    activeDMs.forEach(dmUserId => {
      const dmId = getDMId(user.uid, dmUserId);
      const chatKey = `dm:${dmUserId}`;

      const dmUnsub = subscribeToMessagesDM(dmId, (messages) => {
        const previousCount = globalMessageCountsRef.current[chatKey] || 0;
        const currentCount = messages.length;

        console.log(`🌍 Global listener - DM ${dmUserId}: ${currentCount} messages (was ${previousCount})`);

        if (previousCount > 0 && currentCount > previousCount) {
          const newMessages = messages.slice(previousCount);
          newMessages.forEach(msg => {
            if (msg.senderId !== user.uid && !msg.optimistic && isTabHiddenRef.current) {
              console.log(`🔔 Global notification - New DM from ${msg.sender}`);
              playKnockSound();
            }
          });
        }

        globalMessageCountsRef.current[chatKey] = currentCount;
      });
      unsubscribers.push(dmUnsub);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, activeDMs]);

  // Helper function to play knock sound
  const playKnockSound = () => {
    if (!soundRef.current) {
      console.log('📦 Creating new Howl instance...');
      soundRef.current = new Howl({
        src: ['/sounds/knock_sound.mp3'],
        volume: 0.5,
        onload: () => console.log('🎵 Sound loaded successfully'),
        onloaderror: (id, err) => console.error('❌ Sound load error:', err),
        onplay: () => console.log('🔊 Sound playing'),
        onplayerror: (id, err) => console.error('❌ Sound play error:', err)
      });
    }
    const playId = soundRef.current.play();
    console.log('🎬 Playing knock sound, ID:', playId);
  };

  // Subscribe to messages based on current chat
  useEffect(() => {
    if (!currentChat || !user) return;

    let unsubscribe;

    // Reset initial load flag when switching chats
    isInitialLoadRef.current = true;
    previousMessagesRef.current = [];

    // Mark chat as read immediately when entering it
    markChatAsRead(user.uid, currentChat.type, currentChat.id);

    if (currentChat.type === 'channel') {
      unsubscribe = subscribeToMessages(currentChat.id, (newMessages) => {
        setMessages(newMessages);
        messagesRef.current = newMessages;
        setCurrentMessages(newMessages);
        // Mark as read whenever new messages arrive while viewing this chat
        markChatAsRead(user.uid, currentChat.type, currentChat.id);
      });
    } else if (currentChat.type === 'dm') {
      const dmId = getDMId(user.uid, currentChat.id);
      unsubscribe = subscribeToMessagesDM(dmId, (newMessages) => {
        setMessages(newMessages);
        messagesRef.current = newMessages;
        setCurrentMessages(newMessages);
        // Mark as read whenever new messages arrive while viewing this chat
        markChatAsRead(user.uid, currentChat.type, currentChat.id);
      });
    } else if (currentChat.type === 'ai') {
      unsubscribe = subscribeToAIMessages(user.uid, (newMessages) => {
        setMessages(newMessages);
        messagesRef.current = newMessages;
        setCurrentMessages(newMessages);
      });
    }

    return () => unsubscribe?.();
  }, [currentChat, user, setMessages]);

  // Subscribe to typing status (DMs only)
  useEffect(() => {
    if (!currentChat || !user || currentChat.type !== 'dm') {
      setOtherUserTyping(false);
      return;
    }

    const dmId = getDMId(user.uid, currentChat.id);
    const unsubscribe = subscribeToTypingStatus(dmId, currentChat.id, (isTyping) => {
      setOtherUserTyping(isTyping);
    });

    return () => unsubscribe();
  }, [currentChat, user]);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabHiddenRef.current = document.hidden;
      console.log(`👁️ Tab visibility changed: ${document.hidden ? 'HIDDEN' : 'VISIBLE'}`);
    };

    // Set initial state
    isTabHiddenRef.current = document.hidden;
    console.log(`👁️ Initial tab state: ${document.hidden ? 'HIDDEN' : 'VISIBLE'}`);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messagesRef.current, messagesEndRef]);

  // Auto-focus input when switching chats
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentChat, inputRef]);

  // Mark DM messages as read when viewing them
  useEffect(() => {
    if (!user || !currentChat || currentChat.type !== 'dm') return;

    const messages = messagesRef.current;
    if (messages.length === 0) return;

    const unreadMessages = messages.filter(msg =>
      msg.senderId !== user.uid &&
      (!msg.readBy || !msg.readBy[user.uid])
    );

    if (unreadMessages.length > 0) {
      const dmId = getDMId(user.uid, currentChat.id);
      const messageIds = unreadMessages.map(msg => msg.id);

      const timer = setTimeout(() => {
        markDMMessagesAsRead(dmId, user.uid, messageIds);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [messagesRef.current, user, currentChat]);

  return {
    allUsers,
    activeDMs,
    otherUserTyping
  };
}
