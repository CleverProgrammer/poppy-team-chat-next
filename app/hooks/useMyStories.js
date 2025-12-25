'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  collectionGroup,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * Hook to fetch the current user's own stories (videos they've sent in the last 24 hours)
 * This includes:
 * - Videos sent to channels
 * - Videos sent in DMs (including replies)
 * 
 * Used to show a story ring on the user's own profile icon so they can review
 * their own videos and see view counts.
 *
 * @param {string} userId - The current user's ID
 * @param {string[]} channelIds - Array of channel IDs to check for user's videos
 * @param {string[]} activeDMIds - Array of active DM conversation IDs
 * @returns {object} - Stories data and helper functions
 */
export function useMyStories(userId, channelIds = ['general', 'dev-gang', 'test'], activeDMIds = []) {
  const [channelStories, setChannelStories] = useState([])
  const [dmStories, setDMStories] = useState([])
  const [loading, setLoading] = useState(true)

  // Subscribe to user's channel videos
  useEffect(() => {
    if (!userId || channelIds.length === 0) {
      setChannelStories([])
      return
    }

    // Calculate 24 hours ago timestamp
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    const cutoffTimestamp = Timestamp.fromDate(twentyFourHoursAgo)

    const unsubscribes = []

    // Subscribe to each channel for the user's videos
    channelIds.forEach(channelId => {
      const messagesRef = collection(db, 'channels', channelId, 'messages')
      const q = query(
        messagesRef,
        where('senderId', '==', userId),
        where('timestamp', '>=', cutoffTimestamp),
        orderBy('timestamp', 'asc')
      )

      const unsubscribe = onSnapshot(
        q,
        snapshot => {
          const videos = []
          snapshot.forEach(doc => {
            const data = doc.data()
            if (data.muxPlaybackIds && data.muxPlaybackIds.length > 0) {
              data.muxPlaybackIds.forEach((playbackId, idx) => {
                videos.push({
                  id: `${doc.id}_${idx}`,
                  messageId: doc.id,
                  playbackId,
                  sender: data.sender,
                  senderId: data.senderId,
                  photoURL: data.photoURL,
                  timestamp: data.timestamp,
                  chatType: 'channel',
                  chatId: channelId,
                  chatName: channelId,
                  replyTo: data.replyTo || null,
                })
              })
            }
          })
          
          // Update stories for this channel
          setChannelStories(prev => {
            const filtered = prev.filter(s => s.chatId !== channelId)
            return [...filtered, ...videos].sort((a, b) => {
              const timeA = a.timestamp?.seconds || 0
              const timeB = b.timestamp?.seconds || 0
              return timeA - timeB
            })
          })
        },
        error => {
          console.error(`Error loading user's channel stories for ${channelId}:`, error)
        }
      )

      unsubscribes.push(unsubscribe)
    })

    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [userId, channelIds.join(',')])

  // Subscribe to user's DM videos
  useEffect(() => {
    if (!userId || activeDMIds.length === 0) {
      setDMStories([])
      setLoading(false)
      return
    }

    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    const cutoffTimestamp = Timestamp.fromDate(twentyFourHoursAgo)

    const unsubscribes = []

    activeDMIds.forEach(dmId => {
      const messagesRef = collection(db, 'dms', dmId, 'messages')
      const q = query(
        messagesRef,
        where('senderId', '==', userId),
        where('timestamp', '>=', cutoffTimestamp),
        orderBy('timestamp', 'asc')
      )

      const unsubscribe = onSnapshot(
        q,
        snapshot => {
          const videos = []
          snapshot.forEach(doc => {
            const data = doc.data()
            if (data.muxPlaybackIds && data.muxPlaybackIds.length > 0) {
              data.muxPlaybackIds.forEach((playbackId, idx) => {
                videos.push({
                  id: `${doc.id}_${idx}`,
                  messageId: doc.id,
                  playbackId,
                  sender: data.sender,
                  senderId: data.senderId,
                  photoURL: data.photoURL,
                  timestamp: data.timestamp,
                  chatType: 'dm',
                  chatId: dmId,
                  chatName: data.recipientName || 'DM',
                  replyTo: data.replyTo || null,
                })
              })
            }
          })

          setDMStories(prev => {
            const filtered = prev.filter(s => s.chatId !== dmId)
            return [...filtered, ...videos].sort((a, b) => {
              const timeA = a.timestamp?.seconds || 0
              const timeB = b.timestamp?.seconds || 0
              return timeA - timeB
            })
          })
        },
        error => {
          console.error(`Error loading user's DM stories for ${dmId}:`, error)
        }
      )

      unsubscribes.push(unsubscribe)
    })

    setLoading(false)

    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [userId, activeDMIds.join(',')])

  // Combine all stories
  const stories = useMemo(() => {
    return [...channelStories, ...dmStories].sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0
      const timeB = b.timestamp?.seconds || 0
      return timeA - timeB
    })
  }, [channelStories, dmStories])

  const hasStories = stories.length > 0

  // Get stories formatted for StoriesViewer component
  const getStoriesForViewer = useCallback(() => {
    return stories.map(story => ({
      id: story.id,
      playbackId: story.playbackId,
      sender: story.sender,
      senderId: story.senderId,
      photoURL: story.photoURL,
      timestamp: story.timestamp,
      msgId: story.messageId,
      chatType: story.chatType,
      chatId: story.chatId,
      chatName: story.chatName,
      isViewed: false, // Not tracking viewed for own stories
    }))
  }, [stories])

  // Get remaining time for a story
  const getTimeRemaining = useCallback(timestamp => {
    if (!timestamp) return null
    const storyTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    const expiryTime = new Date(storyTime.getTime() + 24 * 60 * 60 * 1000)
    const now = new Date()
    const diffMs = expiryTime - now
    
    if (diffMs <= 0) return 'Expired'
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }, [])

  return {
    stories,
    hasStories,
    loading,
    getStoriesForViewer,
    getTimeRemaining,
    storiesCount: stories.length,
    channelStoriesCount: channelStories.length,
    dmStoriesCount: dmStories.length,
  }
}

export default useMyStories

