'use client'

import { useState, useCallback } from 'react'
import {
  sendMessage,
  sendMessageDM,
  getDMId,
  sendAIMessage,
  markChatAsUnread,
} from '../lib/firestore'

const AI_USER = {
  uid: 'ai',
  displayName: 'Poppy',
  email: 'ai@poppy.chat',
  photoURL: '',
}

export function useAI(user, currentChat, messages, setMessages, virtuosoRef) {
  const [aiProcessing, setAiProcessing] = useState(false)
  const [aiTyping, setAiTyping] = useState(false)
  const [aiTypingStatus, setAiTypingStatus] = useState('')

  // Call AI API with streaming support
  const callAI = useCallback(
    async (question, chatHistory, onStatus = null) => {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          chatHistory,
          stream: !!onStatus, // Enable streaming if onStatus callback is provided
          user: user
            ? {
                id: user.uid,
                email: user.email,
                name: user.displayName,
              }
            : null,
          currentChat: currentChat
            ? {
                type: currentChat.type,
                id: currentChat.id,
              }
            : null,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      // If streaming
      if (onStatus && response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let finalResponse = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6))

              if (data.status) {
                onStatus(data.status)
              } else if (data.response) {
                finalResponse = data.response
              } else if (data.error) {
                throw new Error(data.error)
              }
            }
          }
        }

        return finalResponse
      }

      // Non-streaming fallback
      const data = await response.json()
      return data.response
    },
    [user, currentChat]
  )

  // Ask Poppy in channel/DM (posts response as message)
  const askPoppy = useCallback(
    async (userQuestion, options = {}) => {
      const { isPrivate = false, privateFor = null } = options
      
      // Generate unique request ID for tracing concurrent requests
      const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      
      // Only check for currentChat - allow concurrent requests (no aiProcessing block)
      if (!currentChat) return

      console.log(`🚀 [${requestId}] Starting: "${userQuestion.substring(0, 40)}..." (private: ${isPrivate})`)

      setAiProcessing(true)

      // Show typing indicator with state (like DM typing)
      setAiTyping(true)
      setAiTypingStatus('Thinking...')
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: 'LAST',
          align: 'end',
          behavior: 'smooth',
        })
      }, 0)

      try {
        console.log(`📡 [${requestId}] API call started`)

        // Update typing indicator with status updates
        const onStatus = status => {
          console.log(`🔄 [${requestId}] Status: ${status}`)
          setAiTypingStatus(status)
        }

        const aiResponse = await callAI(userQuestion, messages.slice(-50), onStatus)

        console.log(`✅ [${requestId}] API response: ${aiResponse ? aiResponse.substring(0, 40) : 'EMPTY'}...`)

        // Remove typing indicator
        setAiTyping(false)

        // Post AI response as a real message (with same privacy as the question)
        const messageOptions = isPrivate ? { isPrivate: true, privateFor: privateFor || user?.uid } : {}
        
        if (currentChat.type === 'channel') {
          // sendMessage signature: (channelId, user, text, linkPreview, options)
          await sendMessage(currentChat.id, AI_USER, aiResponse, null, messageOptions)
        } else {
          const dmId = getDMId(user.uid, currentChat.id)
          // sendMessageDM signature: (dmId, user, text, recipientId, recipient, linkPreview, options)
          await sendMessageDM(dmId, AI_USER, aiResponse, currentChat.id, null, null, messageOptions)
        }

        console.log(`📤 [${requestId}] Message posted to channel`)
      } catch (error) {
        console.error(`❌ [${requestId}] Error:`, error)

        // Remove typing indicator
        setAiTyping(false)

        // Post error message (also private if original was private)
        const errorMsg = `Sorry, I had a problem: ${error.message}. Try again!`
        const messageOptions = isPrivate ? { isPrivate: true, privateFor: privateFor || user?.uid } : {}
        
        if (currentChat.type === 'channel') {
          // sendMessage signature: (channelId, user, text, linkPreview, options)
          await sendMessage(currentChat.id, AI_USER, errorMsg, null, messageOptions)
        } else {
          const dmId = getDMId(user.uid, currentChat.id)
          // sendMessageDM signature: (dmId, user, text, recipientId, recipient, linkPreview, options)
          await sendMessageDM(dmId, AI_USER, errorMsg, currentChat.id, null, null, messageOptions)
        }
      } finally {
        setAiProcessing(false)
        console.log(`🏁 [${requestId}] Request complete`)
      }
    },
    [currentChat, user, messages, setMessages, virtuosoRef, callAI]
  )

  // Direct chat with Poppy (for AI chat type - saves to Firestore)
  const askPoppyDirectly = useCallback(
    async userQuestion => {
      // Generate unique request ID for tracing concurrent requests
      const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      
      // Only check for user - allow concurrent requests (no aiProcessing block)
      if (!user) return

      console.log(`🚀 [${requestId}] Starting direct chat: "${userQuestion.substring(0, 40)}..."`)

      setAiProcessing(true)

      // Show typing indicator with state (like DM typing)
      setAiTyping(true)
      setAiTypingStatus('Thinking...')
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: 'LAST',
          align: 'end',
          behavior: 'smooth',
        })
      }, 0)

      try {
        console.log(`📡 [${requestId}] API call started`)

        // Update typing indicator with status updates
        const onStatus = status => {
          console.log(`🔄 [${requestId}] Status: ${status}`)
          setAiTypingStatus(status)
        }

        // Pass raw messages (same format as askPoppy) - API handles formatting
        const aiResponse = await callAI(userQuestion, messages.slice(-50), onStatus)

        console.log(`✅ [${requestId}] API response: ${aiResponse ? aiResponse.substring(0, 40) : 'EMPTY'}...`)

        // Remove typing indicator
        setAiTyping(false)

        // Save AI response to Firestore
        await sendAIMessage(user.uid, aiResponse, true)

        // Mark AI chat as unread for the user
        markChatAsUnread(user.uid, 'ai', 'poppy-ai')

        console.log(`📤 [${requestId}] Response saved to direct chat`)
      } catch (error) {
        console.error(`❌ [${requestId}] Error:`, error)

        // Remove typing indicator
        setAiTyping(false)

        // Save error message to Firestore
        await sendAIMessage(user.uid, `Sorry, I had a problem: ${error.message}. Try again!`, true)

        // Mark AI chat as unread for the user
        markChatAsUnread(user.uid, 'ai', 'poppy-ai')
      } finally {
        setAiProcessing(false)
        console.log(`🏁 [${requestId}] Request complete`)
      }
    },
    [user, messages, setMessages, virtuosoRef, callAI]
  )

  return {
    aiProcessing,
    aiTyping,
    aiTypingStatus,
    askPoppy,
    askPoppyDirectly,
  }
}
