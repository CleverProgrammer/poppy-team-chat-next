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

  // Subscribe to messages based on current chat
  useEffect(() => {
    if (!currentChat || !user) return;

    let unsubscribe;

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

  // Sound notifications - play knock sound when tab is hidden and new messages arrive
  useEffect(() => {
    if (!user || !currentChat) return;
    if (currentMessages.length === 0) return;

    console.log('🔄 Sound effect triggered, checking messages...');

    // Find new messages
    const previousMessageIds = new Set(previousMessagesRef.current.map(m => m.id));
    const newMessages = currentMessages.filter(msg => !previousMessageIds.has(msg.id));

    console.log(`📊 Found ${newMessages.length} new messages out of ${currentMessages.length} total`);

    // Update ref for next comparison
    previousMessagesRef.current = currentMessages;

    // Use the ref that tracks visibility changes in real-time
    const wasTabHidden = isTabHiddenRef.current;

    newMessages.forEach(msg => {
      console.log('🔔 New message detected:', {
        text: msg.text?.substring(0, 30),
        senderId: msg.senderId,
        currentUserId: user.uid,
        isOwnMessage: msg.senderId === user.uid,
        wasTabHidden,
        optimistic: msg.optimistic,
        isTyping: msg.isTyping
      });

      if (msg.senderId === user.uid) {
        console.log('❌ Skipping sound: own message');
        return;
      }
      if (msg.optimistic || msg.isTyping) {
        console.log('❌ Skipping sound: optimistic or typing indicator');
        return;
      }
      if (!wasTabHidden) {
        console.log('❌ Skipping sound: tab was active when message arrived');
        return;
      }

      // Play knock sound for all message types when tab is hidden
      console.log('✅ Playing knock sound!');
      if (!soundRef.current) {
        console.log('📦 Creating new Howl instance...');
        soundRef.current = new Howl({
          src: ['/sounds/knock.mp3'],
          volume: 0.5,
          onload: () => console.log('🎵 Sound loaded successfully'),
          onloaderror: (id, err) => console.error('❌ Sound load error:', err),
          onplay: () => console.log('🔊 Sound playing'),
          onplayerror: (id, err) => console.error('❌ Sound play error:', err)
        });
      }
      const playId = soundRef.current.play();
      console.log('🎬 Called play(), ID:', playId);
    });
  }, [currentMessages, user, currentChat]);

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
