'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { Howl } from 'howler'
import { Capacitor } from '@capacitor/core'
import Sidebar from '../layout/Sidebar'
import CommandPalette from './CommandPalette'
import AIModal from './AIModal'
import ImageLightbox from './ImageLightbox'
import MessageItem from './MessageItem'
import ChatInput from './ChatInput'
import ChatHeader from './ChatHeader'
import ContextMenu from './ContextMenu'
import PostsView from './PostsView'
import PostPreview from './PostPreview'
import VideoRecorder from './VideoRecorder'
import WebVideoRecorder from './WebVideoRecorder'
import ThreadView from './ThreadView'
import { useAuth } from '../../contexts/AuthContext'
import { useImageUpload } from '../../hooks/useImageUpload'
import { useReactions } from '../../hooks/useReactions'
import { useAI } from '../../hooks/useAI'
import { useMessageSending } from '../../hooks/useMessageSending'
import { useMentionMenu } from '../../hooks/useMentionMenu'
import { useSubscriptions } from '../../hooks/useSubscriptions'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import {
  getDMId,
  saveCurrentChat,
  deleteMessage,
  addActiveDM,
  markChatAsRead,
  markChatAsUnread,
  subscribeToUnreadChats,
  subscribeToPosts,
  promoteMessageToPost,
  demotePostToMessage,
  loadOlderMessages,
  loadOlderMessagesDM,
  sendMessageWithReply,
  sendMessageDMWithReply,
  toggleMessageVisibility,
} from '../../lib/firestore'

export default function ChatWindow() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [currentChat, setCurrentChat] = useState(null)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [unreadChats, setUnreadChats] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [lightboxData, setLightboxData] = useState({ open: false, images: [], startIndex: 0 })
  const [contextMenu, setContextMenu] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [insertPosition, setInsertPosition] = useState(null)
  const [viewMode, setViewMode] = useState('messages')
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [autoSendPending, setAutoSendPending] = useState(false) // Flag for auto-sending video replies
  const [videoUploadProgress, setVideoUploadProgress] = useState(null) // { percent, status } for upload indicator
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false) // Native video recorder (iOS)
  const [webVideoRecorderOpen, setWebVideoRecorderOpen] = useState(false) // Web video recorder (desktop)
  const [threadView, setThreadView] = useState({ open: false, originalMessage: null }) // Thread view state
  const [aiMode, setAiMode] = useState(false) // AI mode toggle for input
  const [privateMode, setPrivateMode] = useState(false) // Private messages (only visible to sender)
  const messageListRef = useRef(null)
  const virtuosoRef = useRef(null)
  const scrollerRef = useRef(null)
  const lastScrollTopRef = useRef(0)
  const isAutoScrollingRef = useRef(false) // Flag to prevent blur during programmatic scroll
  const isTouchingRef = useRef(false) // Track if user is actively touching the screen
  const shouldStayAtBottomRef = useRef(true) // Track if we should auto-scroll when content loads
  const [firstItemIndex, setFirstItemIndex] = useState(10000) // Start from middle to allow scrolling up

  // Load AI mode settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAiMode = localStorage.getItem('poppy-ai-mode')
      const savedPrivateMode = localStorage.getItem('poppy-private-mode')
      if (savedAiMode !== null) setAiMode(savedAiMode === 'true')
      if (savedPrivateMode !== null) setPrivateMode(savedPrivateMode === 'true')
    }
  }, [])

  // Save AI mode settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('poppy-ai-mode', aiMode.toString())
      localStorage.setItem('poppy-private-mode', privateMode.toString())
    }
  }, [aiMode, privateMode])

  // Swipe from left edge to open sidebar (mobile)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)

  useEffect(() => {
    const EDGE_THRESHOLD = 30 // px from left edge to start swipe
    const SWIPE_THRESHOLD = 80 // px to complete swipe
    const VERTICAL_LIMIT = 50 // max vertical movement

    const handleTouchStart = e => {
      const touch = e.touches[0]
      // Swipe from left edge to open, or anywhere to close when open
      if ((touch.clientX < EDGE_THRESHOLD && !isSidebarOpen) || isSidebarOpen) {
        touchStartX.current = touch.clientX
        touchStartY.current = touch.clientY
        isSwiping.current = true
      }
    }

    const handleTouchMove = e => {
      if (!isSwiping.current) return

      const touch = e.touches[0]
      const deltaX = touch.clientX - touchStartX.current
      const deltaY = Math.abs(touch.clientY - touchStartY.current)

      // Cancel if vertical movement is too much (user is scrolling)
      if (deltaY > VERTICAL_LIMIT) {
        isSwiping.current = false
        return
      }

      // Prevent default to avoid scrolling while swiping
      if (Math.abs(deltaX) > 10) {
        e.preventDefault()
      }
    }

    const handleTouchEnd = e => {
      if (!isSwiping.current) return

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartX.current

      // Swipe right to open
      if (!isSidebarOpen && deltaX > SWIPE_THRESHOLD) {
        setIsSidebarOpen(true)
      }
      // Swipe left to close
      if (isSidebarOpen && deltaX < -SWIPE_THRESHOLD) {
        setIsSidebarOpen(false)
      }

      isSwiping.current = false
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isSidebarOpen])

  // Image upload hook (supports multiple images)
  const {
    imagePreview,
    imageFile,
    imagePreviews,
    imageFiles,
    uploading,
    setUploading,
    handleImageSelect,
    handleRemoveImage,
    handleRemoveImageAtIndex,
    clearImage,
    dropzoneProps,
  } = useImageUpload()
  const { getRootProps, getInputProps, isDragActive } = dropzoneProps

  // Reactions hook
  const { topReactions, openEmojiPanel, handleAddReaction, toggleEmojiPanel, setOpenEmojiPanel } =
    useReactions(user, currentChat)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const videoReplyInputRef = useRef(null)
  const pendingVideoReplyRef = useRef(null) // Store the message we're replying to

  // Subscriptions hook (handles all Firebase subscriptions) - must be early for allUsers
  const { allUsers, activeDMs, lastMessages, channelLastMessages, aiLastMessage, otherUserTyping } =
    useSubscriptions({
      user,
      currentChat,
      setCurrentChat,
      setMessages,
      messagesEndRef,
      inputRef,
    })

  // AI hook (must be after virtuosoRef is defined)
  const { aiProcessing, aiTyping, aiTypingStatus, askPoppy, askPoppyDirectly } = useAI(
    user,
    currentChat,
    messages,
    setMessages,
    virtuosoRef
  )

  // Scroll to bottom helper (for mobile keyboard)
  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: 'LAST',
      align: 'end',
      behavior: 'smooth',
    })
  }, [])

  // Handler for when media (images/videos) finish loading
  // This fixes the scroll-to-bottom issue when dynamic content changes height
  const handleMediaLoaded = useCallback(() => {
    if (shouldStayAtBottomRef.current) {
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: 'LAST',
          align: 'end',
          behavior: 'auto',
        })
      })
    }
  }, [])

  // Message sending hook
  const {
    sending,
    handleSend,
    handleEdit,
    handleSendAudio,
    sendVideoReply,
    updateTypingIndicator,
    clearTypingIndicator,
    typingTimeoutRef,
  } = useMessageSending({
    user,
    currentChat,
    inputRef,
    virtuosoRef,
    isAutoScrollingRef,
    imageFile,
    imagePreview,
    imageFiles,
    imagePreviews,
    clearImage,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    setMessages,
    setUploading,
    allUsers,
    askPoppy,
    askPoppyDirectly,
    aiMode,
    privateMode,
  })

  // AI Modal helper (needed by useMentionMenu)
  const openAiModal = () => setAiModalOpen(true)

  // Mention menu hook
  const {
    mentionMenu,
    mentionMenuIndex,
    setMentionMenuIndex,
    handleTextareaChange,
    getMentionMenuItems,
    selectMentionItem,
    handleMentionKeyDown,
  } = useMentionMenu({
    inputRef,
    allUsers,
    user,
    updateTypingIndicator,
    setInsertPosition,
    openAiModal,
  })

  const messageRefs = useRef({})

  const handleKeyDown = e => {
    // Let mention menu handle its keys first
    if (handleMentionKeyDown(e)) return

    // On mobile, Enter should act as a new line (like Shift+Enter on desktop)
    // On desktop, Enter sends the message unless Shift is pressed
    const isMobile = Capacitor.isNativePlatform()

    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      if (editingMessage) {
        cancelEdit()
      } else if (replyingTo) {
        cancelReply()
      }
    }
  }

  const closeAiModal = () => {
    setAiModalOpen(false)
    inputRef.current?.focus()
  }

  const handleInsertAiResponse = (text, position) => {
    if (!inputRef.current) return

    const textarea = inputRef.current
    const value = textarea.value
    const pos = position !== null ? position : value.length

    // Insert AI response at the saved position
    const before = value.substring(0, pos)
    const after = value.substring(pos)
    textarea.value = before + text + after

    // Set cursor after inserted text
    const newPos = pos + text.length
    textarea.setSelectionRange(newPos, newPos)

    // Trigger input event to update height
    const event = new Event('input', { bubbles: true })
    textarea.dispatchEvent(event)
  }

  const handleSelectChat = chat => {
    setCurrentChat(chat)
    setIsSidebarOpen(false) // Close sidebar on mobile after selecting chat

    // Cache current chat for instant load on next visit
    localStorage.setItem('poppy_current_chat', JSON.stringify(chat))

    // Mark this chat as read in Firestore
    if (user) {
      markChatAsRead(user.uid, chat.type, chat.id)
    }

    // Add to active DMs if it's a DM
    if (chat.type === 'dm' && user) {
      addActiveDM(user.uid, chat.id)
    }
    // Save current chat to Firestore
    if (user) {
      console.log('📌 Saving chat to Firestore:', chat)
      saveCurrentChat(user.uid, chat)
    }
  }

  // Expose current chat globally for push notification suppression
  useEffect(() => {
    if (typeof window !== 'undefined' && currentChat) {
      window.__poppyActiveChat = {
        type: currentChat.type,
        id: currentChat.id,
        // For DMs, also store the dmId format
        dmId: currentChat.type === 'dm' && user ? getDMId(user.uid, currentChat.id) : null,
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.__poppyActiveChat = null
      }
    }
  }, [currentChat, user])

  // Expose navigation function globally for push notification tap handling
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__poppyNavigateToChat = (chatType, chatId, senderId, senderName) => {
        console.log('🔔 [NAV] Navigating to chat:', chatType, chatId, senderId, senderName)
        let chat
        if (chatType === 'channel') {
          chat = { type: 'channel', id: chatId, name: chatId }
        } else if (chatType === 'dm') {
          // For DMs, we need the sender's user ID (who sent the message)
          const dmUserId = senderId || chatId
          // Look up user name from allUsers, fallback to senderName from notification
          const dmUser = allUsers.find(u => u.uid === dmUserId)
          const userName = dmUser?.displayName || dmUser?.email || senderName || 'Unknown'
          chat = { type: 'dm', id: dmUserId, name: userName }
        }

        if (chat) {
          setCurrentChat(chat)
          setIsSidebarOpen(false)
          // Cache for instant load
          localStorage.setItem('poppy_current_chat', JSON.stringify(chat))
          if (user) {
            markChatAsRead(user.uid, chat.type, chat.id)
            if (chat.type === 'dm') {
              addActiveDM(user.uid, chat.id)
            }
            saveCurrentChat(user.uid, chat)
          }
        }
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.__poppyNavigateToChat = null
      }
    }
  }, [user, allUsers])

  // Reply handlers
  const startReply = target => {
    // Accept either a full target object or individual parameters for backwards compatibility
    const replyData =
      typeof target === 'object' && target.msgId
        ? target
        : {
            msgId: target,
            sender: arguments[1],
            text: arguments[2] || '',
          }
    setReplyingTo({
      msgId: replyData.msgId,
      sender: replyData.sender,
      text: replyData.text || '',
      imageUrl: replyData.imageUrl || null,
      imageUrls: replyData.imageUrls || null,
      audioUrl: replyData.audioUrl || null,
      audioDuration: replyData.audioDuration || null,
      muxPlaybackIds: replyData.muxPlaybackIds || null,
    })
    setContextMenu(null)
    inputRef.current?.focus()
  }

  const cancelReply = () => {
    setReplyingTo(null)
  }

  // Video reply - uses native camera on iOS, webcam recorder on desktop
  const startVideoReply = async (messageId, sender, text) => {
    // Store the reply info for when video is selected
    pendingVideoReplyRef.current = { msgId: messageId, sender, text }
    setContextMenu(null)

    // Use native camera on iOS, web video recorder on desktop
    if (Capacitor.isNativePlatform()) {
      setVideoRecorderOpen(true)
    } else {
      // Use webcam recorder on desktop
      setWebVideoRecorderOpen(true)
    }
  }

  // Handle when a video is selected for reply (from gallery picker)
  const handleVideoReplySelect = async e => {
    const file = e.target.files?.[0]
    if (!file || !pendingVideoReplyRef.current) return

    console.log('📹 Video selected for reply:', file.name, file.size)

    // Set the reply state
    setReplyingTo(pendingVideoReplyRef.current)

    // Set auto-send flag BEFORE adding the file
    setAutoSendPending(true)

    // Add the video to the upload queue
    await handleImageSelect(file)

    // Clear the pending ref and input
    pendingVideoReplyRef.current = null
    e.target.value = ''

    // Reset the input so the same file can be selected again
    e.target.value = ''
  }

  // Handle native video recorded (from VideoRecorder component)
  const handleNativeVideoRecorded = async videoFilePath => {
    console.log('📹 Native video recorded:', videoFilePath)
    setVideoRecorderOpen(false)

    if (!pendingVideoReplyRef.current) {
      console.warn('No pending video reply context')
      return
    }

    // Store reply context locally and IMMEDIATELY clear the reply state
    // User has "replied" from their perspective the moment they hit Send
    const replyContext = pendingVideoReplyRef.current
    pendingVideoReplyRef.current = null
    setReplyingTo(null)

    try {
      // Get Mux upload URL
      console.log('📹 Getting Mux upload URL...')
      const uploadResponse = await fetch('/api/mux/upload', { method: 'POST' })
      const { uploadUrl, uploadId } = await uploadResponse.json()
      console.log('📹 Got Mux upload URL, uploadId:', uploadId)

      // Use native Uploader to upload directly from file path
      console.log('📹 Starting native upload to Mux...')
      const { Uploader } = await import('@capgo/capacitor-uploader')

      // Show upload progress indicator
      setVideoUploadProgress({ percent: 0, status: 'uploading' })

      // Start native upload
      const { id: uploadTaskId } = await Uploader.startUpload({
        filePath: videoFilePath,
        serverUrl: uploadUrl,
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
        },
        mimeType: 'video/mp4',
      })
      console.log('📹 Native upload started, task ID:', uploadTaskId)

      // Wait for upload to complete
      await new Promise((resolve, reject) => {
        const listener = Uploader.addListener('events', event => {
          console.log('📹 Upload event:', event.name, event.payload)
          if (event.name === 'uploading') {
            setVideoUploadProgress({
              percent: Math.round(event.payload.percent),
              status: 'uploading',
            })
          } else if (event.name === 'completed') {
            setVideoUploadProgress({ percent: 100, status: 'processing' })
            listener.remove()
            resolve()
          } else if (event.name === 'failed') {
            setVideoUploadProgress(null)
            listener.remove()
            reject(new Error(event.payload?.error || 'Upload failed'))
          }
        })
      })
      console.log('📹 Native upload completed!')

      // Poll for playback ID
      console.log('📹 Polling for playback ID...')
      let playbackId = null
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        const assetResponse = await fetch(`/api/mux/asset?uploadId=${uploadId}`)
        const assetData = await assetResponse.json()

        // Wait for BOTH playbackId AND ready status to ensure video is playable
        if (assetData.playbackId && assetData.ready) {
          playbackId = assetData.playbackId
          console.log('📹 Got playback ID (asset ready):', playbackId)
          break
        }
        console.log('📹 Waiting for asset to be ready, attempt', i + 1, 'status:', assetData.status)
      }

      if (!playbackId) {
        throw new Error('Failed to get Mux playback ID')
      }

      // Send the message with the video
      console.log('📹 Sending message with video...')
      setVideoUploadProgress({ percent: 100, status: 'sending' })
      await sendVideoReply(playbackId, replyContext)

      // Clear progress and show success briefly
      setVideoUploadProgress({ percent: 100, status: 'done' })
      setTimeout(() => setVideoUploadProgress(null), 2000)

      console.log('📹 Video reply sent!')
    } catch (error) {
      console.error('Failed to process native video:', error)
      setVideoUploadProgress({ percent: 0, status: 'error' })
      setTimeout(() => setVideoUploadProgress(null), 3000)
    }
  }

  // Handle web video recorded (from WebVideoRecorder component - desktop)
  // WebVideoRecorder already handles Mux upload and returns playbackId
  const handleWebVideoRecorded = async playbackId => {
    console.log('📹 Web video recorded, playbackId:', playbackId)
    setWebVideoRecorderOpen(false)

    if (!pendingVideoReplyRef.current) {
      console.warn('No pending video reply context')
      return
    }

    // Store reply context locally and clear the reply state
    const replyContext = pendingVideoReplyRef.current
    pendingVideoReplyRef.current = null
    setReplyingTo(null)

    try {
      // Send the message with the video
      console.log('📹 Sending message with video...')
      await sendVideoReply(playbackId, replyContext)
      console.log('📹 Web video reply sent!')
    } catch (error) {
      console.error('Failed to send web video reply:', error)
      alert('Failed to send video. Please try again.')
    }
  }

  // Auto-send when video is ready (triggered by imageFiles change when autoSendPending is true)
  useEffect(() => {
    if (autoSendPending && imageFiles.length > 0 && replyingTo) {
      // File is ready, send it!
      setAutoSendPending(false)
      handleSend()
    }
  }, [autoSendPending, imageFiles.length, replyingTo, handleSend])

  const handleMessagesAreaClick = e => {
    // Cancel reply when clicking in the messages area
    // But don't cancel if clicking on interactive elements like buttons, emojis, etc.
    if (
      replyingTo &&
      !e.target.closest('.quick-reactions') &&
      !e.target.closest('.emoji-panel') &&
      !e.target.closest('.more-reactions-btn') &&
      !e.target.closest('.message-image')
    ) {
      cancelReply()
    }
  }

  const scrollToMessage = messageId => {
    const msgEl = messageRefs.current[messageId]
    if (msgEl) {
      msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      msgEl.style.animation = 'none'
      setTimeout(() => {
        msgEl.style.animation = 'highlight-msg 1s ease-out'
      }, 10)
    }
  }

  // Edit handlers
  const startEdit = (messageId, currentText) => {
    setEditingMessage({ id: messageId, text: currentText })
    if (inputRef.current) {
      inputRef.current.value = currentText
    }
    inputRef.current?.focus()
  }

  const cancelEdit = () => {
    setEditingMessage(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  // Global keyboard shortcuts (must be after startReply, startEdit, cancelReply are defined)
  useKeyboardShortcuts({
    user,
    messages,
    lightboxOpen: lightboxData.open,
    closeLightbox: () => setLightboxData({ open: false, images: [], startIndex: 0 }),
    replyingTo,
    editingMessage,
    isPaletteOpen,
    setIsPaletteOpen,
    startReply,
    startEdit,
    cancelReply,
    inputRef,
  })

  // Delete handler
  const handleDeleteMessage = async messageId => {
    const isDM = currentChat.type === 'dm'
    const chatId = isDM ? getDMId(user.uid, currentChat.id) : currentChat.id

    try {
      await deleteMessage(chatId, messageId, isDM)
    } catch (error) {
      console.error('Error deleting message:', error)
      alert('Failed to delete message. Please try again.')
    }
  }

  // Make private message public handler
  const handleMakePublic = async messageId => {
    const isDM = currentChat.type === 'dm'
    const chatId = isDM ? getDMId(user.uid, currentChat.id) : currentChat.id

    try {
      await toggleMessageVisibility(chatId, messageId, true, isDM)
      // Update local state immediately for responsiveness
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, isPrivate: false, privateFor: null } : msg
      ))
    } catch (error) {
      console.error('Error making message public:', error)
      alert('Failed to make message public. Please try again.')
    }
  }

  // Thread view handlers
  const openThreadView = useCallback(originalMessage => {
    setThreadView({ open: true, originalMessage })
  }, [])

  const closeThreadView = useCallback(() => {
    setThreadView({ open: false, originalMessage: null })
  }, [])

  // Get thread messages for the currently open thread
  const getThreadMessages = useCallback(() => {
    if (!threadView.originalMessage) return []
    return messages.filter(m => m.replyTo?.msgId === threadView.originalMessage.id)
  }, [messages, threadView.originalMessage])

  // Send a reply directly from the thread view
  const sendThreadReply = useCallback(
    async (text, replyTo) => {
      if (!text.trim() || !user || !currentChat) return

      const isDM = currentChat.type === 'dm'
      const chatId = isDM ? getDMId(user.uid, currentChat.id) : currentChat.id

      try {
        if (isDM) {
          await sendMessageDMWithReply(chatId, user, text, currentChat.id, replyTo)
        } else {
          await sendMessageWithReply(chatId, user, text, replyTo)
        }
      } catch (error) {
        console.error('Error sending thread reply:', error)
        throw error
      }
    },
    [user, currentChat]
  )

  // Promote message to post
  const handlePromoteMessage = async messageId => {
    const chatId = currentChat.type === 'dm' ? getDMId(user.uid, currentChat.id) : currentChat.id

    try {
      await promoteMessageToPost(currentChat.type, chatId, messageId)
    } catch (error) {
      console.error('Error promoting message to post:', error)
      alert('Failed to promote message. Please try again.')
    }
  }

  // Demote post to message
  const handleDemotePost = async postId => {
    const chatId = currentChat.type === 'dm' ? getDMId(user.uid, currentChat.id) : currentChat.id

    try {
      await demotePostToMessage(currentChat.type, chatId, postId)
    } catch (error) {
      console.error('Error demoting post to message:', error)
      alert('Failed to demote post. Please try again.')
    }
  }

  // Add message to Team AI Memory (globally accessible)
  // Supports both text and image messages (including multiple images)
  const handleAddToTeamMemory = async message => {
    try {
      // Get all image URLs (support both single and multiple)
      const imageUrls = message.imageUrls || (message.imageUrl ? [message.imageUrl] : [])

      const response = await fetch('/api/ragie/team-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: message.id,
          text: message.text || message.content || '',
          imageUrl: imageUrls[0] || null, // First image for backwards compat
          imageUrls: imageUrls.length > 0 ? imageUrls : null, // All images
          sender: message.sender,
          senderEmail: user.email,
          senderId: user.uid,
          timestamp: message.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        let typeMsg = 'message'
        if (data.type === 'image+text' || data.type === 'images+text') {
          typeMsg = imageUrls.length > 1 ? 'images and text' : 'image and text'
        } else if (data.type === 'image' || data.type === 'images') {
          typeMsg = imageUrls.length > 1 ? 'images' : 'image'
        }
        alert(`✅ Added ${typeMsg} to Team AI Memory! Everyone can now ask Poppy about this.`)
      } else {
        throw new Error('Failed to add to team memory')
      }
    } catch (error) {
      console.error('Error adding to team memory:', error)
      alert('Failed to add to Team AI Memory. Please try again.')
    }
  }

  // Context menu handler
  const handleContextMenu = (e, message) => {
    e.preventDefault()
    // Get the message wrapper element - for right-click, find from target
    const messageElement = e.messageElement || e.target.closest('.message-wrapper')
    contextMenuOpenTime.current = Date.now() // Track when menu opens to prevent immediate close
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      message,
      messageElement,
      reactionsOnly: e.reactionsOnly || false, // Double-tap passes this flag
    })
  }

  // Subscribe to unread chats
  useEffect(() => {
    if (!user) return

    let lastUnreadString = ''
    const unsubscribe = subscribeToUnreadChats(user.uid, newUnreadChats => {
      // Only update if unread chats actually changed (prevents unnecessary re-renders)
      const newUnreadString = JSON.stringify(newUnreadChats.sort())
      if (newUnreadString !== lastUnreadString) {
        lastUnreadString = newUnreadString
        setUnreadChats(newUnreadChats)
      }
    })

    return () => {
      console.log('🔕 Unsubscribing from unread chats')
      unsubscribe()
    }
  }, [user])

  // Subscribe to posts
  useEffect(() => {
    if (!currentChat) return

    const chatId = currentChat.type === 'dm' ? getDMId(user.uid, currentChat.id) : currentChat.id

    const unsubscribe = subscribeToPosts(currentChat.type, chatId, loadedPosts => {
      setPosts(loadedPosts)
    })

    return () => unsubscribe()
  }, [currentChat, user])

  // Scroll to bottom when switching from posts to messages
  // DISABLED: Virtuoso handles scrolling with followOutput
  // useEffect(() => {
  //   if (viewMode === 'messages' && messagesEndRef.current) {
  //     messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
  //   }
  // }, [viewMode]);

  // Load older messages callback for Virtuoso
  const loadOlder = useCallback(async () => {
    console.log('📜 loadOlder called', {
      loadingOlder,
      hasMoreMessages,
      currentChat: currentChat?.id,
      messagesCount: messages.length,
    })

    if (loadingOlder || !hasMoreMessages || !currentChat || !user) {
      console.log('📜 loadOlder skipped:', {
        loadingOlder,
        hasMoreMessages,
        hasCurrentChat: !!currentChat,
        hasUser: !!user,
      })
      return
    }

    setLoadingOlder(true)
    console.log('📜 Loading older messages...')

    try {
      // Combine messages and posts to find the oldest item
      const allItems = [...messages, ...posts.map(post => ({ ...post, isPost: true }))].sort(
        (a, b) => {
          const aTime = a.timestamp?.seconds || 0
          const bTime = b.timestamp?.seconds || 0
          return aTime - bTime
        }
      )

      const oldestItem = allItems[0]
      console.log('📜 Oldest item timestamp:', oldestItem?.timestamp)

      if (!oldestItem || !oldestItem.timestamp) {
        console.log('📜 No oldest item found')
        setLoadingOlder(false)
        return
      }

      let olderMessages = []
      if (currentChat.type === 'channel') {
        olderMessages = await loadOlderMessages(currentChat.id, oldestItem.timestamp)
      } else if (currentChat.type === 'dm') {
        const dmId = getDMId(user.uid, currentChat.id)
        olderMessages = await loadOlderMessagesDM(dmId, oldestItem.timestamp)
      }

      console.log(`📜 Loaded ${olderMessages.length} older messages`)

      if (olderMessages.length === 0) {
        console.log('📜 No more messages, setting hasMoreMessages to false')
        setHasMoreMessages(false)
      } else {
        // Prepend older messages
        console.log(`📜 Prepending ${olderMessages.length} messages, updating firstItemIndex`)
        setFirstItemIndex(prev => prev - olderMessages.length)
        setMessages(prev => [...olderMessages, ...prev])
      }
    } catch (error) {
      console.error('📜 Error loading older messages:', error)
    } finally {
      setLoadingOlder(false)
    }
  }, [messages, posts, loadingOlder, hasMoreMessages, currentChat, user])

  // Reset hasMoreMessages and firstItemIndex when switching chats
  useEffect(() => {
    console.log('📜 Chat changed, resetting pagination state')
    setHasMoreMessages(true)
    setFirstItemIndex(10000) // Reset to starting position
    setLoadingOlder(false)

    // Scroll to bottom when switching chats
    setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({
        index: 'LAST',
        align: 'end',
        behavior: 'auto',
      })
    }, 100)
  }, [currentChat])

  // Close context menu on click outside
  const contextMenuOpenTime = useRef(0)

  useEffect(() => {
    const handleClick = () => {
      // Don't close if menu was just opened (prevents gestures from immediately closing)
      const timeSinceOpen = Date.now() - contextMenuOpenTime.current
      if (timeSinceOpen < 300) {
        return
      }
      setContextMenu(null)
    }
    const handleEscape = e => {
      if (e.key === 'Escape') {
        setContextMenu(null)
      }
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  // Wait for currentChat to be loaded from cache/Firestore
  // Return null instead of loading text to avoid hydration mismatch
  if (!currentChat) {
    return null
  }

  return (
    <>
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        allUsers={allUsers}
        onSelectChat={handleSelectChat}
      />

      {/* Image Lightbox */}
      <ImageLightbox
        images={lightboxData.images}
        open={lightboxData.open}
        onClose={() => setLightboxData({ open: false, images: [], startIndex: 0 })}
        startIndex={lightboxData.startIndex}
      />

      {/* Native Video Recorder (iOS) */}
      <VideoRecorder
        isOpen={videoRecorderOpen}
        onClose={() => {
          setVideoRecorderOpen(false)
          pendingVideoReplyRef.current = null
        }}
        onVideoRecorded={handleNativeVideoRecorded}
      />

      {/* Web Video Recorder (Desktop) */}
      <WebVideoRecorder
        isOpen={webVideoRecorderOpen}
        onClose={() => {
          setWebVideoRecorderOpen(false)
          pendingVideoReplyRef.current = null
        }}
        onVideoRecorded={handleWebVideoRecorded}
      />

      {/* Thread View - iMessage style overlay */}
      <ThreadView
        isOpen={threadView.open}
        onClose={closeThreadView}
        originalMessage={threadView.originalMessage}
        threadMessages={getThreadMessages()}
        allMessages={messages}
        user={user}
        currentChat={currentChat}
        allUsers={allUsers}
        topReactions={topReactions}
        onReply={startReply}
        onVideoReply={startVideoReply}
        onEdit={startEdit}
        onDelete={handleDeleteMessage}
        onPromote={handlePromoteMessage}
        onAddToTeamMemory={handleAddToTeamMemory}
        onAddReaction={handleAddReaction}
        onImageClick={(images, startIndex) => setLightboxData({ open: true, images, startIndex })}
        onScrollToMessage={scrollToMessage}
        onSendThreadReply={sendThreadReply}
      />

      {/* Video Upload Progress Toast */}
      {videoUploadProgress && (
        <div
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            background:
              videoUploadProgress.status === 'error'
                ? 'rgba(255, 59, 48, 0.95)'
                : videoUploadProgress.status === 'done'
                ? 'rgba(52, 199, 89, 0.95)'
                : 'rgba(30, 30, 30, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            zIndex: 10001,
            minWidth: '200px',
          }}
        >
          {/* Icon/Spinner */}
          {videoUploadProgress.status === 'uploading' && (
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
          {videoUploadProgress.status === 'processing' && (
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#7c3aed',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
          {videoUploadProgress.status === 'sending' && (
            <svg width='20' height='20' viewBox='0 0 24 24' fill='#7c3aed'>
              <path d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' />
            </svg>
          )}
          {videoUploadProgress.status === 'done' && (
            <svg width='20' height='20' viewBox='0 0 24 24' fill='white'>
              <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
            </svg>
          )}
          {videoUploadProgress.status === 'error' && (
            <svg width='20' height='20' viewBox='0 0 24 24' fill='white'>
              <path d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' />
            </svg>
          )}

          {/* Text */}
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
              {videoUploadProgress.status === 'uploading' &&
                `Uploading... ${videoUploadProgress.percent}%`}
              {videoUploadProgress.status === 'processing' && 'Processing video...'}
              {videoUploadProgress.status === 'sending' && 'Sending...'}
              {videoUploadProgress.status === 'done' && 'Video sent! ✨'}
              {videoUploadProgress.status === 'error' && 'Upload failed'}
            </div>
          </div>

          {/* Progress bar for uploading */}
          {videoUploadProgress.status === 'uploading' && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '0 0 24px 24px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${videoUploadProgress.percent}%`,
                  background: '#7c3aed',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <div className='app-container'>
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div className='sidebar-backdrop' onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <Sidebar
          currentChat={currentChat}
          onSelectChat={handleSelectChat}
          activeDMs={activeDMs}
          allUsers={allUsers}
          unreadChats={unreadChats}
          lastMessages={lastMessages}
          channelLastMessages={channelLastMessages}
          aiLastMessage={aiLastMessage}
          isOpen={isSidebarOpen}
          onOpenSearch={() => {
            setIsSidebarOpen(false)
            setIsPaletteOpen(true)
          }}
        />

        {/* Chat Container */}
        <div className='chat-container'>
          <ChatHeader
            currentChat={currentChat}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onBack={() => setIsSidebarOpen(true)}
            allUsers={allUsers}
            currentUserId={user?.uid}
            currentUser={user}
          />

          {viewMode === 'posts' ? (
            <PostsView user={user} currentChat={currentChat} onViewModeChange={setViewMode} />
          ) : (
            <>
              {/* Messages Area */}
              <div
                ref={messageListRef}
                className={`messages ${replyingTo ? 'replying-active' : ''}`}
                {...getRootProps()}
                onClick={handleMessagesAreaClick}
                style={{ height: '100%', position: 'relative' }}
              >
                <input
                  {...getInputProps()}
                  capture={replyingTo ? 'user' : undefined}
                  accept={replyingTo ? 'video/*' : undefined}
                />
                {/* Hidden input for video replies - opens camera directly */}
                <input
                  ref={videoReplyInputRef}
                  type='file'
                  accept='video/*'
                  capture='user'
                  onChange={handleVideoReplySelect}
                  style={{ display: 'none' }}
                />
                {isDragActive && (
                  <div className='drag-overlay'>
                    <div className='drag-overlay-content'>📎 Drop image or video here</div>
                  </div>
                )}
                {messages.length === 0 && posts.length === 0 ? (
                  <div className='empty-state'>
                    <p>Welcome to the chat! Start a conversation. 😱</p>
                  </div>
                ) : (
                  <Virtuoso
                    ref={virtuosoRef}
                    style={{ height: '100%' }}
                    data={[...messages, ...posts.map(post => ({ ...post, isPost: true }))].sort(
                      (a, b) => {
                        const aTime = a.timestamp?.seconds || 0
                        const bTime = b.timestamp?.seconds || 0
                        return aTime - bTime
                      }
                    )}
                    firstItemIndex={firstItemIndex}
                    initialTopMostItemIndex={999999}
                    alignToBottom={true}
                    followOutput={(isAtBottom) => {
                      // Auto-scroll to bottom when new messages arrive if user is at bottom
                      if (shouldStayAtBottomRef.current || isAtBottom) {
                        return 'smooth'
                      }
                      return false
                    }}
                    atBottomStateChange={(atBottom) => {
                      // Track if user is at bottom to know if we should auto-scroll on media load
                      shouldStayAtBottomRef.current = atBottom
                    }}
                    atBottomThreshold={150}
                    startReached={loadOlder}
                    // Keep all 50 messages rendered to prevent image re-rendering jitter
                    overscan={{ main: 2000, reverse: 2000 }}
                    increaseViewportBy={{ top: 1500, bottom: 1500 }}
                    // Add spacer at bottom for keyboard + extra padding on mobile for read receipts
                    components={{
                      Footer: () => {
                        // On mobile (native), always add base padding for read receipts to not overlap input
                        // When keyboard is open, add keyboard height on top of that
                        const basePadding = Capacitor.isNativePlatform() ? 60 : 0
                        const totalHeight =
                          keyboardHeight > 0 ? keyboardHeight + basePadding : basePadding

                        if (totalHeight > 0) {
                          return <div style={{ height: totalHeight, background: 'transparent' }} />
                        }
                        return null
                      },
                    }}
                    atTopStateChange={atTop => {
                      console.log('📜 atTopStateChange:', atTop)
                      if (atTop) {
                        loadOlder()
                      }
                    }}
                    scrollerRef={scroller => {
                      scrollerRef.current = scroller
                      // Add touch event listeners to track when user is actually touching
                      if (scroller && Capacitor.isNativePlatform()) {
                        scroller.ontouchstart = () => {
                          isTouchingRef.current = true
                        }
                        scroller.ontouchend = () => {
                          // Small delay to catch the final scroll events from the touch
                          setTimeout(() => {
                            isTouchingRef.current = false
                          }, 100)
                        }
                      }
                    }}
                    onScroll={e => {
                      const currentScrollTop = e.target.scrollTop
                      // Blur on upward scroll ONLY when user is actively touching (dragging)
                      // This prevents keyboard from closing when new messages arrive and auto-scroll
                      // ONLY on mobile - desktop should never lose focus from scrolling
                      if (
                        Capacitor.isNativePlatform() &&
                        isTouchingRef.current && // Only blur if user is touching the screen
                        !isAutoScrollingRef.current &&
                        currentScrollTop < lastScrollTopRef.current - 5 &&
                        inputRef.current
                      ) {
                        inputRef.current.blur()
                      }
                      lastScrollTopRef.current = currentScrollTop
                    }}
                    itemContent={(index, item) => {
                      if (item.isPost) {
                        return (
                          <PostPreview
                            key={`post-${item.id}`}
                            post={item}
                            onClick={() => {
                              setSelectedPost(item)
                              setViewMode('posts')
                            }}
                            onContextMenu={handleContextMenu}
                          />
                        )
                      } else {
                        const msgIndex = messages.findIndex(m => m.id === item.id)
                        return (
                          <MessageItem
                            key={item.id}
                            msg={item}
                            index={msgIndex}
                            messages={messages}
                            totalMessages={messages.length}
                            user={user}
                            currentChat={currentChat}
                            allUsers={allUsers}
                            replyingTo={replyingTo}
                            topReactions={topReactions}
                            onReply={startReply}
                            onVideoReply={startVideoReply}
                            onEdit={startEdit}
                            onDelete={handleDeleteMessage}
                            onPromote={handlePromoteMessage}
                            onAddToTeamMemory={handleAddToTeamMemory}
                            onAddReaction={handleAddReaction}
                            onImageClick={(images, startIndex) =>
                              setLightboxData({ open: true, images, startIndex })
                            }
                            onScrollToMessage={scrollToMessage}
                            messageRef={el => (messageRefs.current[item.id] = el)}
                            onOpenThread={openThreadView}
                            onMediaLoaded={handleMediaLoaded}
                            onMakePublic={handleMakePublic}
                          />
                        )
                      }
                    }}
                  />
                )}

                {/* DM Typing Indicator - Inside messages div so it's visible */}
                {otherUserTyping &&
                  currentChat?.type === 'dm' &&
                  (() => {
                    const otherUser = allUsers.find(u => u.uid === currentChat.id)
                    return (
                      <div className='typing-indicator'>
                        <img
                          src={otherUser?.photoURL || ''}
                          alt={otherUser?.displayName || 'User'}
                          className='typing-avatar'
                        />
                        <div className='typing-dots'>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    )
                  })()}

                {/* AI Typing Indicator - Same approach as DM typing */}
                {aiTyping && (
                  <div className='typing-indicator'>
                    <div
                      className='typing-avatar'
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--border-input)',
                      }}
                    >
                      <img
                        src='/poppy-icon.png'
                        alt='Poppy'
                        style={{ width: '20px', height: '20px' }}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div className='typing-dots'>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      {aiTypingStatus && (
                        <div
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '12px',
                            fontStyle: 'italic',
                            marginLeft: '4px',
                          }}
                        >
                          {aiTypingStatus}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Chat Modal */}
              <AIModal
                isOpen={aiModalOpen}
                onClose={closeAiModal}
                onInsert={handleInsertAiResponse}
                insertPosition={insertPosition}
              />

              <ChatInput
                inputRef={inputRef}
                editingMessage={editingMessage}
                replyingTo={replyingTo}
                sending={sending}
                imagePreview={imagePreview}
                imagePreviews={imagePreviews}
                imageFiles={imageFiles}
                mentionMenu={mentionMenu}
                mentionMenuIndex={mentionMenuIndex}
                handleTextareaChange={handleTextareaChange}
                handleKeyDown={handleKeyDown}
                handleSend={handleSend}
                handleSendAudio={handleSendAudio}
                handleRemoveImage={handleRemoveImage}
                handleRemoveImageAtIndex={handleRemoveImageAtIndex}
                cancelEdit={cancelEdit}
                cancelReply={cancelReply}
                getMentionMenuItems={getMentionMenuItems}
                selectMentionItem={selectMentionItem}
                setMentionMenuIndex={setMentionMenuIndex}
                onScrollToBottom={scrollToBottom}
                onKeyboardHeightChange={setKeyboardHeight}
                aiMode={aiMode}
                setAiMode={setAiMode}
                privateMode={privateMode}
                setPrivateMode={setPrivateMode}
              />
            </>
          )}
        </div>
      </div>

      <ContextMenu
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        user={user}
        onReply={startReply}
        onVideoReply={startVideoReply}
        onEdit={startEdit}
        onDelete={handleDeleteMessage}
        onPromote={handlePromoteMessage}
        onDemote={handleDemotePost}
        onAddToTeamMemory={handleAddToTeamMemory}
        topReactions={topReactions}
        onAddReaction={handleAddReaction}
        reactionsOnly={contextMenu?.reactionsOnly || false}
      />
    </>
  )
}
