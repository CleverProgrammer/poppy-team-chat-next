'use client'

import { useState, useEffect, useRef } from 'react'
import { Howl } from 'howler'
import { Capacitor } from '@capacitor/core'
import {
  subscribeToMessages,
  subscribeToMessagesDM,
  subscribeToUsers,
  subscribeToActiveDMs,
  subscribeToAIMessages,
  subscribeToTypingStatus,
  subscribeToLastMessages,
  subscribeToChannelLastMessages,
  subscribeToAILastMessage,
  discoverExistingDMs,
  getCurrentChat,
  addActiveDM,
  getDMId,
  markDMMessagesAsRead,
  markChatAsRead,
} from '../lib/firestore'

export function useSubscriptions({
  user,
  currentChat,
  setCurrentChat,
  setMessages,
  messagesEndRef,
  inputRef,
}) {
  const [allUsers, setAllUsers] = useState([])
  const [activeDMs, setActiveDMs] = useState([])
  const [lastMessages, setLastMessages] = useState({})
  const [channelLastMessages, setChannelLastMessages] = useState({})
  const [aiLastMessage, setAILastMessage] = useState(null)
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [currentMessages, setCurrentMessages] = useState([])

  const previousMessagesRef = useRef([])
  const soundRef = useRef(null)
  const messagesRef = useRef([])
  const isTabHiddenRef = useRef(false)
  const isInitialLoadRef = useRef(true)
  const globalMessageCountsRef = useRef({})
  const hasFreshDataRef = useRef(false) // Track if Firestore has delivered fresh data
  const [hasFreshData, setHasFreshData] = useState(false)

  // Load saved chat on mount - check localStorage first for instant load
  useEffect(() => {
    if (!user) return

    // Check localStorage cache first for INSTANT load
    const cachedChat = localStorage.getItem('poppy_current_chat')
    if (cachedChat) {
      try {
        const chat = JSON.parse(cachedChat)
        console.log('⚡ Instant chat load from cache:', chat.id)
        setCurrentChat(chat)
        if (chat.type === 'dm') {
          addActiveDM(user.uid, chat.id)
        }
      } catch (e) {
        console.warn('Failed to parse cached chat:', e)
      }
    }

    // Also fetch from Firestore in background (will update if different)
    getCurrentChat(user.uid).then(savedChat => {
      console.log('📌 Loaded saved chat from Firestore:', savedChat)
      if (savedChat) {
        setCurrentChat(savedChat)
        // Update cache
        localStorage.setItem('poppy_current_chat', JSON.stringify(savedChat))
        if (savedChat.type === 'dm') {
          addActiveDM(user.uid, savedChat.id)
        }
      } else if (!cachedChat) {
        // Only default to general if no cache AND no saved chat
        console.log('📌 No saved chat found, defaulting to general')
        const defaultChat = { type: 'channel', id: 'general', name: 'general' }
        setCurrentChat(defaultChat)
        localStorage.setItem('poppy_current_chat', JSON.stringify(defaultChat))
      }
    })
  }, [user, setCurrentChat])

  // Load all users
  useEffect(() => {
    const unsubscribe = subscribeToUsers(users => {
      setAllUsers(users)
    })
    return () => unsubscribe()
  }, [])

  // Discover existing DMs when user logs in
  useEffect(() => {
    if (!user) return
    discoverExistingDMs(user.uid)
  }, [user])

  // Subscribe to active DMs from Firestore
  useEffect(() => {
    if (!user) return

    const unsubscribe = subscribeToActiveDMs(user.uid, dms => {
      setActiveDMs(dms)
    })
    return () => unsubscribe()
  }, [user])

  // Subscribe to last messages for sidebar previews (DMs)
  useEffect(() => {
    if (!user || activeDMs.length === 0) {
      return () => setLastMessages({})
    }

    const unsubscribe = subscribeToLastMessages(user.uid, activeDMs, messages => {
      setLastMessages(messages)
    })
    return () => {
      unsubscribe()
      setLastMessages({})
    }
  }, [user, activeDMs])

  // Subscribe to last messages for channels
  useEffect(() => {
    if (!user) return
    const channels = ['general', 'dev-gang', 'test']
    const unsubscribe = subscribeToChannelLastMessages(channels, messages => {
      setChannelLastMessages(messages)
    }, user.uid)
    return () => unsubscribe()
  }, [user])

  // Subscribe to last AI message
  useEffect(() => {
    if (!user) {
      return () => setAILastMessage(null)
    }

    const unsubscribe = subscribeToAILastMessage(user.uid, message => {
      setAILastMessage(message)
    })
    return () => {
      unsubscribe()
      setAILastMessage(null)
    }
  }, [user])

  // Global sound notifications - listen to ALL chats for notifications
  useEffect(() => {
    if (!user) return

    const unsubscribers = []

    // Helper to check if a message is visible to the current user
    const isMessageVisibleToUser = (message) => {
      // If not private, it's visible
      if (!message.isPrivate) return true
      // If private but for this user, it's visible
      if (message.privateFor === user.uid) return true
      // If private and sent by this user, it's visible
      if (message.senderId === user.uid) return true
      // Otherwise, not visible
      return false
    }

    // Subscribe to channels (only notify on mentions) - load only 1 message for performance
    const channels = ['general', 'dev-gang', 'test']
    channels.forEach(channelId => {
      const channelUnsub = subscribeToMessages(
        channelId,
        messages => {
          const chatKey = `channel:${channelId}`

          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1]
            const lastMessageId = globalMessageCountsRef.current[chatKey]

            // Skip private messages that aren't for this user
            if (!isMessageVisibleToUser(lastMessage)) {
              return
            }

            // Only notify if this is a new message
            if (lastMessageId && lastMessageId !== lastMessage.id) {
              if (
                lastMessage.senderId !== user.uid &&
                !lastMessage.optimistic &&
                isTabHiddenRef.current
              ) {
                const isMentioned =
                  lastMessage.text?.includes(`@${user.displayName}`) ||
                  lastMessage.text?.includes(`@${user.email}`) ||
                  lastMessage.text?.includes('@everyone') ||
                  lastMessage.text?.includes('@channel')

                if (isMentioned) {
                  console.log(
                    `🔔 Global notification - Mentioned in ${channelId} channel by ${lastMessage.sender}`
                  )
                  // playKnockSound(); // Disabled
                }
              }
            }

            globalMessageCountsRef.current[chatKey] = lastMessage.id
          }
        },
        1
      ) // Only load 1 most recent message
      unsubscribers.push(channelUnsub)
    })

    // Subscribe to all active DMs - load only 1 message for performance
    activeDMs.forEach(dmUserId => {
      const dmId = getDMId(user.uid, dmUserId)
      const chatKey = `dm:${dmUserId}`

      const dmUnsub = subscribeToMessagesDM(
        dmId,
        messages => {
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1]
            const lastMessageId = globalMessageCountsRef.current[chatKey]

            // Skip private messages that aren't for this user
            if (!isMessageVisibleToUser(lastMessage)) {
              return
            }

            // Only notify if this is a new message
            if (lastMessageId && lastMessageId !== lastMessage.id) {
              if (
                lastMessage.senderId !== user.uid &&
                !lastMessage.optimistic &&
                isTabHiddenRef.current
              ) {
                console.log(`🔔 Global notification - New DM from ${lastMessage.sender}`)
                // playKnockSound(); // Disabled
              }
            }

            globalMessageCountsRef.current[chatKey] = lastMessage.id
          }
        },
        1
      ) // Only load 1 most recent message
      unsubscribers.push(dmUnsub)
    })

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [user, activeDMs])

  // Helper function to play knock sound
  const playKnockSound = () => {
    if (!soundRef.current) {
      console.log('📦 Creating new Howl instance...')
      soundRef.current = new Howl({
        src: ['/sounds/knock_sound.mp3'],
        volume: 0.5,
        onload: () => console.log('🎵 Sound loaded successfully'),
        onloaderror: (id, err) => console.error('❌ Sound load error:', err),
        onplay: () => console.log('🔊 Sound playing'),
        onplayerror: (id, err) => console.error('❌ Sound play error:', err),
      })
    }
    const playId = soundRef.current.play()
    console.log('🎬 Playing knock sound, ID:', playId)
  }

  // Subscribe to messages based on current chat
  useEffect(() => {
    if (!currentChat || !user) return

    let unsubscribe

    // Reset initial load flag when switching chats
    isInitialLoadRef.current = true
    previousMessagesRef.current = []
    
    // Reset fresh data flag when switching chats (ref is sync, state via cleanup)
    hasFreshDataRef.current = false

    // Mark chat as read immediately when entering it
    markChatAsRead(user.uid, currentChat.type, currentChat.id)

    // Generate cache key for this chat
    const cacheKey = `poppy_messages_${currentChat.type}_${currentChat.id}`

    // Load cached messages INSTANTLY while Firestore fetches fresh data
    // Using queueMicrotask to avoid "setState in effect" warning while staying near-instant
    queueMicrotask(() => {
      try {
        const cachedMessages = localStorage.getItem(cacheKey)
        if (cachedMessages) {
          const parsed = JSON.parse(cachedMessages)
          // Only set cached messages if we don't have fresh data yet
          if (!hasFreshDataRef.current) {
            setMessages(parsed)
            messagesRef.current = parsed
            setCurrentMessages(parsed)
          }
        }
      } catch (e) {
        console.warn('Failed to load cached messages:', e)
      }
    })

    // Helper to cache messages (last 50 to match Firestore initial load)
    const cacheMessages = (messages) => {
      try {
        // Cache last 50 messages to match Firestore initial load count
        // This ensures smooth replacement when fresh data arrives
        const toCache = messages.slice(-50)
        localStorage.setItem(cacheKey, JSON.stringify(toCache))
      } catch (e) {
        console.warn('Failed to cache messages:', e)
      }
    }

    // Filter out private messages from other users
    // Private messages are only visible to the sender (privateFor field)
    const filterPrivateMessages = (messages) => {
      return messages.filter(msg => {
        // If message is not private, show it
        if (!msg.isPrivate) return true
        // If private, only show to the user who owns it (privateFor) or the sender
        return msg.privateFor === user.uid || msg.senderId === user.uid
      })
    }
    
    if (currentChat.type === 'channel') {
      unsubscribe = subscribeToMessages(
        currentChat.id,
        newMessages => {
          // Mark that we have fresh Firestore data (blocks loadOlder on cached data)
          hasFreshDataRef.current = true
          setHasFreshData(true)
          
          const filteredMessages = filterPrivateMessages(newMessages)
          setMessages(filteredMessages)
          messagesRef.current = filteredMessages
          setCurrentMessages(filteredMessages)
          cacheMessages(filteredMessages)
          markChatAsRead(user.uid, currentChat.type, currentChat.id)
        },
        50
      )
    } else if (currentChat.type === 'dm') {
      const dmId = getDMId(user.uid, currentChat.id)
      unsubscribe = subscribeToMessagesDM(
        dmId,
        newMessages => {
          // Mark that we have fresh Firestore data (blocks loadOlder on cached data)
          hasFreshDataRef.current = true
          setHasFreshData(true)
          
          const filteredMessages = filterPrivateMessages(newMessages)
          setMessages(filteredMessages)
          messagesRef.current = filteredMessages
          setCurrentMessages(filteredMessages)
          cacheMessages(filteredMessages)
          markChatAsRead(user.uid, currentChat.type, currentChat.id)
        },
        50
      )
    } else if (currentChat.type === 'ai') {
      unsubscribe = subscribeToAIMessages(user.uid, newMessages => {
        // Mark that we have fresh Firestore data (blocks loadOlder on cached data)
        hasFreshDataRef.current = true
        setHasFreshData(true)
        
        setMessages(newMessages)
        messagesRef.current = newMessages
        setCurrentMessages(newMessages)
        cacheMessages(newMessages) // Cache for instant load
      })
    }

    return () => {
      unsubscribe?.()
      setHasFreshData(false)
    }
  }, [currentChat, user, setMessages])

  // Subscribe to typing status (DMs only)
  useEffect(() => {
    if (!currentChat || !user || currentChat.type !== 'dm') {
      return () => setOtherUserTyping(false)
    }

    const dmId = getDMId(user.uid, currentChat.id)
    const unsubscribe = subscribeToTypingStatus(dmId, currentChat.id, isTyping => {
      setOtherUserTyping(isTyping)
    })

    return () => {
      unsubscribe()
      setOtherUserTyping(false)
    }
  }, [currentChat, user])

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabHiddenRef.current = document.hidden
      console.log(`👁️ Tab visibility changed: ${document.hidden ? 'HIDDEN' : 'VISIBLE'}`)
    }

    // Set initial state
    isTabHiddenRef.current = document.hidden
    console.log(`👁️ Initial tab state: ${document.hidden ? 'HIDDEN' : 'VISIBLE'}`)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Auto scroll to bottom when new messages arrive
  // DISABLED: Virtuoso handles scrolling with followOutput
  // useEffect(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  // }, [messagesRef.current, messagesEndRef]);

  // Auto-focus input when switching chats (desktop only)
  // On mobile, we don't auto-focus to avoid the keyboard popping up automatically
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      inputRef.current?.focus()
    }
  }, [currentChat, inputRef])

  // Mark DM messages as read when viewing them
  useEffect(() => {
    if (!user || !currentChat || currentChat.type !== 'dm') return
    if (currentMessages.length === 0) return

    const unreadMessages = currentMessages.filter(
      msg => msg.senderId !== user.uid && (!msg.readBy || !msg.readBy[user.uid])
    )

    if (unreadMessages.length > 0) {
      const dmId = getDMId(user.uid, currentChat.id)
      const messageIds = unreadMessages.map(msg => msg.id)

      const timer = setTimeout(() => {
        markDMMessagesAsRead(dmId, user.uid, messageIds)
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [currentMessages, user, currentChat])

  return {
    allUsers,
    activeDMs,
    lastMessages,
    channelLastMessages,
    aiLastMessage,
    otherUserTyping,
    hasFreshData, // Blocks loadOlder until Firestore delivers fresh data
  }
}
