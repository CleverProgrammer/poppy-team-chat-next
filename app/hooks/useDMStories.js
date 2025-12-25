'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { subscribeToViewedStories } from '../lib/firestore'

/**
 * Hook to fetch private DM stories (videos sent TO the current user from a specific sender)
 *
 * Privacy logic:
 * - Only the RECIPIENT of a video sees it as a story
 * - If User A sends a video to User B, only User B sees the story ring on User A's avatar
 * - Stories expire after 24 hours
 * - Now includes view tracking to show gray ring for viewed stories
 *
 * @param {string} currentUserId - The current logged-in user's ID
 * @param {string} otherUserId - The other user in the DM conversation
 * @returns {object} - Stories data and helper functions
 */
export function useDMStories(currentUserId, otherUserId) {
  const [stories, setStories] = useState([])
  const [viewedStoryIds, setViewedStoryIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [hasStories, setHasStories] = useState(false)

  // Generate DM ID (sorted user IDs)
  const dmId = useMemo(() => {
    if (!currentUserId || !otherUserId) return null
    return [currentUserId, otherUserId].sort().join('_')
  }, [currentUserId, otherUserId])

  // Subscribe to stories
  useEffect(() => {
    if (!currentUserId || !otherUserId || !dmId) {
      setLoading(false)
      return
    }

    // Calculate 24 hours ago timestamp
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    const cutoffTimestamp = Timestamp.fromDate(twentyFourHoursAgo)

    // Query messages in this DM that:
    // 1. Have video content (muxPlaybackIds)
    // 2. Were sent BY the other user (senderId === otherUserId)
    // 3. Are within 24 hours
    // This means we only see stories from videos sent TO us, not by us
    const messagesRef = collection(db, 'dms', dmId, 'messages')
    const q = query(
      messagesRef,
      where('timestamp', '>=', cutoffTimestamp),
      orderBy('timestamp', 'asc')
    )

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const videoStories = []
        
        snapshot.forEach(doc => {
          const data = doc.data()
          // Only include messages:
          // 1. With Mux video playback IDs
          // 2. Sent BY the other user (not by current user)
          // This ensures privacy - you only see stories from videos sent TO you
          if (
            data.muxPlaybackIds &&
            data.muxPlaybackIds.length > 0 &&
            data.senderId === otherUserId
          ) {
            // Each video in a message becomes a separate story
            data.muxPlaybackIds.forEach((playbackId, idx) => {
              videoStories.push({
                id: `${doc.id}_${idx}`,
                messageId: doc.id,
                playbackId,
                sender: data.sender,
                senderId: data.senderId,
                photoURL: data.photoURL,
                timestamp: data.timestamp,
                replyTo: data.replyTo || null,
              })
            })
          }
        })

        setStories(videoStories)
        setHasStories(videoStories.length > 0)
        setLoading(false)
      },
      error => {
        console.error('Error loading DM stories:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [currentUserId, otherUserId, dmId])

  // Subscribe to viewed stories for current user
  useEffect(() => {
    if (!currentUserId || !dmId) {
      setViewedStoryIds(new Set())
      return
    }

    const unsubscribe = subscribeToViewedStories(
      currentUserId,
      'dm',
      dmId,
      (viewedIds) => {
        setViewedStoryIds(viewedIds)
      }
    )

    return () => unsubscribe()
  }, [currentUserId, dmId])

  // Check if there are any unviewed stories
  const hasUnviewedStories = useMemo(() => {
    if (stories.length === 0) return false
    return stories.some(story => !viewedStoryIds.has(story.id))
  }, [stories, viewedStoryIds])

  // Get the index of the first unviewed story
  const firstUnviewedIndex = useMemo(() => {
    const index = stories.findIndex(story => !viewedStoryIds.has(story.id))
    return index >= 0 ? index : 0
  }, [stories, viewedStoryIds])

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
      isViewed: viewedStoryIds.has(story.id),
    }))
  }, [stories, viewedStoryIds])

  // Check if a specific timestamp is still within 24 hours
  const isStoryActive = useCallback(timestamp => {
    if (!timestamp) return false
    const storyTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    const now = new Date()
    const diffMs = now - storyTime
    const diffHours = diffMs / (1000 * 60 * 60)
    return diffHours <= 24
  }, [])

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
    hasUnviewedStories,
    firstUnviewedIndex,
    viewedStoryIds,
    dmId,
    loading,
    getStoriesForViewer,
    isStoryActive,
    getTimeRemaining,
    storiesCount: stories.length,
    unviewedCount: stories.filter(s => !viewedStoryIds.has(s.id)).length,
  }
}

export default useDMStories
