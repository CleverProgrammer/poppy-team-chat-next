'use client'

import { useState, useEffect, useRef } from 'react'
import { Howl } from 'howler'
import { Capacitor } from '@capacitor/core'
import {
  subscribeToMessages,
  subscribeToMessagesDM,
  subscribeToGroupMessages,
  subscribeToGroup,
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

  // Render tracking: Monitor how many components re-render per update
  const renderMetricsRef = useRef({
    totalMerges: 0,
    totalMessagesProcessed: 0,
    totalUnchangedReused: 0,
    lastMergeTime: 0,
    mergeHistory: [], // Track last 10 merges
  })

  // Helper: Intelligently merge messages to avoid unnecessary re-renders
  // If 90% of messages are the same, we keep the old object references
  // Only updates/new messages get new references
  const mergeMessages = (existingMessages, newMessages) => {
    console.log('🔀 Merge messages...', { existingMessagesCount: existingMessages.length, newMessagesCount: newMessages.length })
    const startTime = performance.now()
    
    // If no existing messages, just return the new ones
    if (!existingMessages || existingMessages.length === 0) {
      return newMessages
    }

    // Create a map of existing messages by ID for O(1) lookup
    const existingMap = new Map(
      existingMessages.map(msg => [msg.id, msg])
    )

    // Helper: Normalize timestamps for comparison
    const normalizeTimestamp = (ts) => {
      if (!ts) return null
      // Handle Firestore Timestamp object
      if (ts.seconds !== undefined) {
        return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000
      }
      // Handle Date object
      if (ts instanceof Date) return ts.getTime()
      // Handle number (already milliseconds)
      if (typeof ts === 'number') return ts
      // Handle string
      if (typeof ts === 'string') return new Date(ts).getTime()
      return null
    }

    // Helper: Normalize object for comparison (sort keys recursively)
    const normalizeObject = (obj) => {
      if (obj === null || obj === undefined) return obj
      if (typeof obj !== 'object') return obj
      if (Array.isArray(obj)) return obj.map(normalizeObject)
      
      // Handle Firestore Timestamp objects (convert to milliseconds)
      // Cached timestamps have {seconds, nanoseconds, type: "firestore/timestamp/1.0"}
      // Live timestamps have {seconds, nanoseconds}
      if (obj.seconds !== undefined && obj.nanoseconds !== undefined) {
        return obj.seconds * 1000 + obj.nanoseconds / 1000000
      }
      
      // Sort object keys to ensure consistent JSON.stringify output
      const sorted = {}
      Object.keys(obj).sort().forEach(key => {
        // Skip the 'type' field from serialized Firestore timestamps
        if (key === 'type' && typeof obj.type === 'string' && obj.type.startsWith('firestore/')) {
          return
        }
        sorted[key] = normalizeObject(obj[key])
      })
      return sorted
    }

    // Helper: Deep compare messages, ignoring Firestore-specific type differences
    const messagesEqual = (msg1, msg2) => {
      if (msg1 === msg2) return true // Same reference
      
      // Fields to completely ignore (Firestore internals)
      const ignoredFields = new Set(['_document', '_firestore', '_converter'])
      
      // Fields that need timestamp normalization
      const timestampFields = ['createdAt', 'updatedAt', 'timestamp']
      
      // Get all unique keys
      const keys1 = Object.keys(msg1)
      const keys2 = Object.keys(msg2)
      const allKeys = new Set([...keys1, ...keys2])
      
      // Compare each field
      for (const key of allKeys) {
        // Skip ignored fields
        if (ignoredFields.has(key)) continue
        
        const val1 = msg1[key]
        const val2 = msg2[key]
        
        // Special handling for timestamps
        if (timestampFields.includes(key)) {
          const norm1 = normalizeTimestamp(val1)
          const norm2 = normalizeTimestamp(val2)
          if (norm1 !== norm2) {
            console.log(`Timestamp mismatch on key "${key}":`, norm1, norm2)
            return false
          }
          continue
        }
        
        // Handle undefined/null
        if (val1 === val2) continue
        
        // Handle objects/arrays (deep comparison with key normalization)
        if (typeof val1 === 'object' && typeof val2 === 'object') {
          if (val1 === null || val2 === null) {
            if (val1 !== val2) {
              console.log(`Null mismatch on key "${key}":`, val1, val2)
              return false
            }
            continue
          }
          
          // Normalize objects to ensure consistent key ordering
          const norm1 = normalizeObject(val1)
          const norm2 = normalizeObject(val2)
          
          try {
            const str1 = JSON.stringify(norm1)
            const str2 = JSON.stringify(norm2)
            if (str1 !== str2) {
              console.log(`Object mismatch on key "${key}":`, str1, str2)
              return false
            }
          } catch (e) {
            console.warn('Failed to stringify for comparison:', e)
            return false
          }
          continue
        }
        
        // Primitive comparison
        if (val1 !== val2) {
          console.log(`Primitive mismatch on key "${key}":`, val1, val2)
          return false
        }
      }
  
      return true
    }

    // Merge strategy
    let unchangedCount = 0
    const result = newMessages.map(newMsg => {
      const existing = existingMap.get(newMsg.id)
      if (existing && messagesEqual(existing, newMsg)) {
        unchangedCount++
        return existing
      }
      return newMsg
    })
    
    // Track metrics
    const mergeTime = performance.now() - startTime
    const unchangedRatio = newMessages.length > 0 ? unchangedCount / newMessages.length : 0
    const efficiency = unchangedRatio >= 0.3 ? '✅ EXCELLENT' : unchangedRatio > 0.2 ? '⚠️ GOOD' : unchangedRatio > 0.1 ? '⚠️ MODERATE' : '❌ POOR'
    
    renderMetricsRef.current.totalMerges++
    renderMetricsRef.current.totalMessagesProcessed += newMessages.length
    renderMetricsRef.current.totalUnchangedReused += unchangedCount
    renderMetricsRef.current.lastMergeTime = mergeTime
    
    // Keep last 10 merges in history
    renderMetricsRef.current.mergeHistory.push({
      timestamp: new Date().toISOString(),
      totalMessages: newMessages.length,
      unchangedCount,
      ratio: (unchangedRatio * 100).toFixed(1),
      time: mergeTime.toFixed(2),
    })
    if (renderMetricsRef.current.mergeHistory.length > 10) {
      renderMetricsRef.current.mergeHistory.shift()
    }
    
    console.log(
      `🔄 Merge complete: ${unchangedCount}/${newMessages.length} unchanged (${(unchangedRatio * 100).toFixed(1)}%) ${efficiency} [${mergeTime.toFixed(2)}ms]`
    )
    return result
  }

  // Log render efficiency metrics every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const metrics = renderMetricsRef.current
      if (metrics.totalMerges === 0) return // No merges yet
      
      const avgMessagesPerMerge = (metrics.totalMessagesProcessed / metrics.totalMerges).toFixed(1)
      const reusedRatio = ((metrics.totalUnchangedReused / metrics.totalMessagesProcessed) * 100).toFixed(1)
      const estimatedRendersAvoided = metrics.totalUnchangedReused
      
      console.log(
        '📈 EFFICIENCY METRICS:',
        `Total merges: ${metrics.totalMerges}, ` +
        `Avg messages/merge: ${avgMessagesPerMerge}, ` +
        `Reused ratio: ${reusedRatio}%, ` +
        `Renders avoided: ~${estimatedRendersAvoided}, ` +
        `Last merge time: ${metrics.lastMergeTime.toFixed(2)}ms`
      )
    }, 15000)
    return () => clearInterval(interval)
  }, [])

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
      setLastMessages({})
      return
    }

    const unsubscribe = subscribeToLastMessages(user.uid, activeDMs, messages => {
      setLastMessages(messages)
    })
    return () => unsubscribe()
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
      setAILastMessage(null)
      return
    }

    const unsubscribe = subscribeToAILastMessage(user.uid, message => {
      setAILastMessage(message)
    })
    return () => unsubscribe()
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

    // Mark chat as read immediately when entering it
    markChatAsRead(user.uid, currentChat.type, currentChat.id)

    // Generate cache key for this chat
    const cacheKey = `poppy_messages_${currentChat.type}_${currentChat.id}`

    // Load cached messages INSTANTLY while Firestore fetches fresh data
    try {
      const cachedMessages = localStorage.getItem(cacheKey)
      if (cachedMessages) {
        const parsed = JSON.parse(cachedMessages)
        console.log(`⚡ Instant messages from cache: ${parsed.length} messages`)
        // Set ref BEFORE setMessages to ensure it's available when Firestore fires
        messagesRef.current = parsed
        setMessages(parsed)
        setCurrentMessages(parsed)
      }
    } catch (e) {
      console.warn('Failed to load cached messages:', e)
    }

    // Helper to cache messages (last 30 for quick load)
    const cacheMessages = messages => {
      try {
        // Only cache the last 30 messages to keep localStorage small
        const toCache = messages.slice(-30)
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
          const filteredMessages = filterPrivateMessages(newMessages)
          // Smart merge: only update if messages actually changed (by reference)
          const mergedMessages = mergeMessages(messagesRef.current, filteredMessages)
          setMessages(mergedMessages)
          messagesRef.current = mergedMessages
          setCurrentMessages(mergedMessages)
          cacheMessages(mergedMessages)
          markChatAsRead(user.uid, currentChat.type, currentChat.id)
        },
        100
      ) // Load 100 initial messages
    } else if (currentChat.type === 'dm') {
      const dmId = getDMId(user.uid, currentChat.id)
      unsubscribe = subscribeToMessagesDM(
        dmId,
        newMessages => {
          const filteredMessages = filterPrivateMessages(newMessages)
          // Smart merge: only update if messages actually changed (by reference)
          const mergedMessages = mergeMessages(messagesRef.current, filteredMessages)
          setMessages(mergedMessages)
          messagesRef.current = mergedMessages
          setCurrentMessages(mergedMessages)
          cacheMessages(mergedMessages)
          markChatAsRead(user.uid, currentChat.type, currentChat.id)
        },
        100
      ) // Load 100 initial messages
    } else if (currentChat.type === 'group') {
      // Subscribe to group messages
      const messagesUnsub = subscribeToGroupMessages(
        currentChat.id,
        newMessages => {
          const filteredMessages = filterPrivateMessages(newMessages)
          // Smart merge: only update if messages actually changed (by reference)
          const mergedMessages = mergeMessages(messagesRef.current, filteredMessages)
          setMessages(mergedMessages)
          messagesRef.current = mergedMessages
          setCurrentMessages(mergedMessages)
          cacheMessages(mergedMessages)
          markChatAsRead(user.uid, currentChat.type, currentChat.id)
        },
        100
      ) // Load 100 initial messages

      // Also subscribe to the group document to detect if user is removed AND update group data
      const groupUnsub = subscribeToGroup(currentChat.id, groupData => {
        if (!groupData) {
          // Group was deleted, redirect to general
          console.log('🚪 Group was deleted, redirecting to general')
          const defaultChat = { type: 'channel', id: 'general', name: 'general' }
          setCurrentChat(defaultChat)
          localStorage.setItem('poppy_current_chat', JSON.stringify(defaultChat))
          return
        }

        // Check if user is still a member
        const isMember = groupData.members && groupData.members[user.uid]
        if (!isMember) {
          console.log('🚪 User was removed from group, redirecting to general')
          const defaultChat = { type: 'channel', id: 'general', name: 'general' }
          setCurrentChat(defaultChat)
          localStorage.setItem('poppy_current_chat', JSON.stringify(defaultChat))
          return
        }

        // Update currentChat.group with latest data (for header to show updated members/name/photo)
        // Use functional update to avoid dependency on currentChat in this callback
        setCurrentChat(prev => {
          // Only update if this is still the same group
          if (prev?.type !== 'group' || prev?.id !== currentChat.id) {
            return prev // Different chat now, don't update
          }
          
          // Check if anything meaningful changed to avoid unnecessary re-renders
          const prevMemberIds = Object.keys(prev.group?.members || {}).sort().join(',')
          const newMemberIds = Object.keys(groupData.members || {}).sort().join(',')
          const prevName = prev.group?.name || prev.group?.displayName || ''
          const newName = groupData.name || groupData.displayName || ''
          const prevPhoto = prev.group?.photoURL || ''
          const newPhoto = groupData.photoURL || ''
          
          if (prevMemberIds === newMemberIds && prevName === newName && prevPhoto === newPhoto) {
            return prev // Nothing changed, no need to update
          }
          
          // Something changed, update the group data
          console.log('👥 Group updated:', { members: newMemberIds, name: newName, photoURL: newPhoto })
          return {
            ...prev,
            group: groupData,
            name: groupData.name || groupData.displayName || prev.name,
          }
        })
      })

      // Combine both unsubscribes
      unsubscribe = () => {
        messagesUnsub()
        groupUnsub()
      }
    } else if (currentChat.type === 'ai') {
      unsubscribe = subscribeToAIMessages(user.uid, newMessages => {
        // Smart merge: only update if messages actually changed (by reference)
        const mergedMessages = mergeMessages(messagesRef.current, newMessages)
        setMessages(mergedMessages)
        messagesRef.current = mergedMessages
        setCurrentMessages(mergedMessages)
        cacheMessages(mergedMessages) // Cache for instant load
      })
    }

    return () => unsubscribe?.()
  }, [currentChat, user, setMessages])

  // Subscribe to typing status (DMs only)
  useEffect(() => {
    if (!currentChat || !user || currentChat.type !== 'dm') {
      setOtherUserTyping(false)
      return
    }

    const dmId = getDMId(user.uid, currentChat.id)
    const unsubscribe = subscribeToTypingStatus(dmId, currentChat.id, isTyping => {
      setOtherUserTyping(isTyping)
    })

    return () => unsubscribe()
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

    const messages = messagesRef.current
    if (messages.length === 0) return

    const unreadMessages = messages.filter(
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
  }, [messagesRef.current, user, currentChat])

  return {
    allUsers,
    activeDMs,
    lastMessages,
    channelLastMessages,
    aiLastMessage,
    otherUserTyping,
  }
}
