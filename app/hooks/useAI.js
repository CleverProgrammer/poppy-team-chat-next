'use client'

import { useState, useCallback } from 'react'
import {
  sendMessage,
  sendMessageDM,
  sendGroupMessage,
  sendMessageWithReply,
  sendMessageDMWithReply,
  sendGroupMessageWithReply,
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
  // imageUrls: optional array of image URLs to send directly to AI (for vision)
  // targetedMessage: message being replied to (AI should focus on this message)
  // audioTranscripts: optional array of audio transcriptions to include in context
  const callAI = useCallback(
    async (question, chatHistory, onStatus = null, imageUrls = null, targetedMessage = null, audioTranscripts = null) => {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          chatHistory,
          stream: !!onStatus, // Enable streaming if onStatus callback is provided
          imageUrls: imageUrls, // Direct image URLs for AI vision
          audioTranscripts: audioTranscripts, // Audio transcriptions for AI context
          targetedMessage: targetedMessage, // Message being replied to (AI focus)
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
        let tldr = null
        let costBreakdown = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.status) {
                  onStatus(data.status)
              } else if (data.response) {
                finalResponse = data.response
                tldr = data.tldr || null
                costBreakdown = data.costBreakdown || null
              } else if (data.error) {
                  throw new Error(data.error)
                }
              } catch {
                // Ignore parsing errors for incomplete SSE lines
              }
            }
          }
        }

        return { response: finalResponse, tldr, costBreakdown }
      }

      // Non-streaming fallback
      const data = await response.json()
      return { response: data.response, tldr: data.tldr, costBreakdown: data.costBreakdown }
    },
    [user, currentChat]
  )

  // Ask Poppy in channel/DM (posts response as message)
  // options.imageUrls: optional array of image URLs to send for AI vision
  // options.audioTranscripts: optional array of audio transcriptions for AI context
  // options.targetedMessage: message being replied to (for AI to focus on)
  const askPoppy = useCallback(
    async (userQuestion, options = {}) => {
      const { isPrivate = false, privateFor = null, imageUrls = null, audioTranscripts = null, targetedMessage = null } = options
      
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
        if (targetedMessage) {
          console.log(`🎯 [${requestId}] Targeting message: "${targetedMessage.text?.substring(0, 30)}..." by ${targetedMessage.sender}`)
        }

        // Update typing indicator with status updates
        const onStatus = status => {
          console.log(`🔄 [${requestId}] Status: ${status}`)
          setAiTypingStatus(status)
        }

        // Pass imageUrls, audioTranscripts, and targetedMessage to AI for context
        const aiResult = await callAI(userQuestion, messages.slice(-50), onStatus, imageUrls, targetedMessage, audioTranscripts)
        const aiResponse = aiResult.response
        const tldr = aiResult.tldr
        const costBreakdown = aiResult.costBreakdown

        console.log(`✅ [${requestId}] API response: ${aiResponse ? aiResponse.substring(0, 40) : 'EMPTY'}...`)
        if (tldr) {
          console.log(`📝 [${requestId}] TLDR: "${tldr.substring(0, 50)}..."`)
        }
        if (costBreakdown) {
          console.log(`💰 [${requestId}] Cost: $${costBreakdown.totalCost?.toFixed(6)} (${costBreakdown.toolsUsed?.length || 0} tools)`)
        }
        if (imageUrls?.length) {
          console.log(`🖼️ [${requestId}] Sent ${imageUrls.length} image(s) to AI for vision`)
        }
        if (audioTranscripts?.length) {
          console.log(`🎵 [${requestId}] Sent ${audioTranscripts.length} audio transcription(s) to AI`)
        }

        // Remove typing indicator
        setAiTyping(false)

        // Post AI response as a real message (with same privacy as the question)
        // Include cost breakdown and TLDR for display
        const messageOptions = isPrivate 
          ? { isPrivate: true, privateFor: privateFor || user?.uid, costBreakdown, tldr } 
          : { costBreakdown, tldr }
        
        if (currentChat.type === 'channel') {
          // sendMessage signature: (channelId, user, text, linkPreview, options)
          await sendMessage(currentChat.id, AI_USER, aiResponse, null, messageOptions)
        } else if (currentChat.type === 'group') {
          // sendGroupMessage signature: (groupId, user, text, linkPreview, options)
          await sendGroupMessage(currentChat.id, AI_USER, aiResponse, null, messageOptions)
        } else {
          // DM
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
        } else if (currentChat.type === 'group') {
          // sendGroupMessage signature: (groupId, user, text, linkPreview, options)
          await sendGroupMessage(currentChat.id, AI_USER, errorMsg, null, messageOptions)
        } else {
          // DM
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
  // imageUrls: optional array of image URLs to send for AI vision
  const askPoppyDirectly = useCallback(
    async (userQuestion, imageUrls = null) => {
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
        // Pass imageUrls to AI for vision support
        const aiResult = await callAI(userQuestion, messages.slice(-50), onStatus, imageUrls)
        const aiResponse = aiResult.response
        const tldr = aiResult.tldr
        const costBreakdown = aiResult.costBreakdown

        console.log(`✅ [${requestId}] API response: ${aiResponse ? aiResponse.substring(0, 40) : 'EMPTY'}...`)
        if (tldr) {
          console.log(`📝 [${requestId}] TLDR: "${tldr.substring(0, 50)}..."`)
        }
        if (costBreakdown) {
          console.log(`💰 [${requestId}] Cost: $${costBreakdown.totalCost?.toFixed(6)} (${costBreakdown.toolsUsed?.length || 0} tools)`)
        }
        if (imageUrls?.length) {
          console.log(`🖼️ [${requestId}] Sent ${imageUrls.length} image(s) to AI for vision`)
        }

        // Remove typing indicator
        setAiTyping(false)

        // Save AI response to Firestore (with cost breakdown and TLDR)
        await sendAIMessage(user.uid, aiResponse, true, null, null, costBreakdown, tldr)

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

  // Ask Poppy in a thread (posts response as a reply in the thread)
  // threadContext: { originalMessage, threadMessages } - the full thread context
  // options.imageUrls: optional array of image URLs to send for AI vision
  const askPoppyInThread = useCallback(
    async (userQuestion, threadContext, options = {}) => {
      const { isPrivate = false, privateFor = null, imageUrls = null } = options
      
      // Generate unique request ID for tracing
      const requestId = `req-thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      
      if (!currentChat || !threadContext?.originalMessage) return

      console.log(`🧵 [${requestId}] Starting thread AI: "${userQuestion.substring(0, 40)}..."`)

      setAiProcessing(true)
      setAiTyping(true)
      setAiTypingStatus('Thinking...')

      try {
        console.log(`📡 [${requestId}] Thread API call started`)

        const onStatus = status => {
          console.log(`🔄 [${requestId}] Status: ${status}`)
          setAiTypingStatus(status)
        }

        // Build thread context for AI - include original message + all replies
        const { originalMessage, threadMessages = [] } = threadContext
        
        // Format thread messages for AI context
        const threadChatHistory = [originalMessage, ...threadMessages]
          .sort((a, b) => {
            const aTime = a.timestamp?.seconds || 0
            const bTime = b.timestamp?.seconds || 0
            return aTime - bTime
          })
          .map(msg => {
            // Build message object with all media info
            const formattedMsg = {
              sender: msg.sender || msg.senderName || 'Unknown',
              senderId: msg.senderId,
              text: msg.text || msg.content || '',
              timestamp: msg.timestamp,
            }
            
            // Include image info
            if (msg.imageUrl || msg.imageUrls?.length) {
              formattedMsg.imageUrls = msg.imageUrls || (msg.imageUrl ? [msg.imageUrl] : [])
              if (msg.imageAnalysis) {
                formattedMsg.imageAnalysis = msg.imageAnalysis
              }
            }
            
            // Include video info
            if (msg.muxPlaybackIds?.length) {
              formattedMsg.muxPlaybackIds = msg.muxPlaybackIds
            }
            
            // Include audio/voice message info
            if (msg.audioUrl) {
              formattedMsg.audioUrl = msg.audioUrl
              formattedMsg.audioDuration = msg.audioDuration
              if (msg.transcription) {
                formattedMsg.transcription = msg.transcription
              }
            }
            
            return formattedMsg
          })

        // Call AI with thread context
        const response = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userQuestion,
            chatHistory: threadChatHistory,
            isThreadContext: true, // Flag to indicate this is thread context
            stream: true,
            imageUrls: imageUrls,
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

        // Handle streaming response
        let aiResponse = ''
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()

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
                  aiResponse = data.response
                } else if (data.error) {
                  throw new Error(data.error)
                }
              }
            }
          }
        } else {
          const data = await response.json()
          aiResponse = data.response
        }

        console.log(`✅ [${requestId}] Thread API response: ${aiResponse ? aiResponse.substring(0, 40) : 'EMPTY'}...`)

        setAiTyping(false)

        // Post AI response as a reply in the thread (replying to original message)
        const replyTo = {
          msgId: originalMessage.id,
          sender: originalMessage.sender,
          text: originalMessage.text || originalMessage.content || '',
          imageUrl: originalMessage.imageUrl || null,
          imageUrls: originalMessage.imageUrls || null,
          audioUrl: originalMessage.audioUrl || null,
          audioDuration: originalMessage.audioDuration || null,
          muxPlaybackIds: originalMessage.muxPlaybackIds || null,
        }
        const messageOptions = isPrivate ? { isPrivate: true, privateFor: privateFor || user?.uid } : {}
        
        if (currentChat.type === 'channel') {
          await sendMessageWithReply(currentChat.id, AI_USER, aiResponse, replyTo, null, messageOptions)
        } else if (currentChat.type === 'group') {
          await sendGroupMessageWithReply(currentChat.id, AI_USER, aiResponse, replyTo, null, messageOptions)
        } else {
          // DM
          const dmId = getDMId(user.uid, currentChat.id)
          await sendMessageDMWithReply(dmId, AI_USER, aiResponse, currentChat.id, replyTo, null, null, messageOptions)
        }

        console.log(`📤 [${requestId}] Thread AI response posted`)
      } catch (error) {
        console.error(`❌ [${requestId}] Thread AI Error:`, error)
        setAiTyping(false)

        // Post error message as thread reply
        const errorMsg = `Sorry, I had a problem: ${error.message}. Try again!`
        const errorReplyTo = {
          msgId: threadContext.originalMessage.id,
          sender: threadContext.originalMessage.sender,
          text: threadContext.originalMessage.text || '',
          imageUrl: threadContext.originalMessage.imageUrl || null,
          imageUrls: threadContext.originalMessage.imageUrls || null,
          audioUrl: threadContext.originalMessage.audioUrl || null,
          audioDuration: threadContext.originalMessage.audioDuration || null,
          muxPlaybackIds: threadContext.originalMessage.muxPlaybackIds || null,
        }
        const errorOptions = isPrivate ? { isPrivate: true, privateFor: privateFor || user?.uid } : {}
        
        if (currentChat.type === 'channel') {
          await sendMessageWithReply(currentChat.id, AI_USER, errorMsg, errorReplyTo, null, errorOptions)
        } else if (currentChat.type === 'group') {
          await sendGroupMessageWithReply(currentChat.id, AI_USER, errorMsg, errorReplyTo, null, errorOptions)
        } else {
          const dmId = getDMId(user.uid, currentChat.id)
          await sendMessageDMWithReply(dmId, AI_USER, errorMsg, currentChat.id, errorReplyTo, null, null, errorOptions)
        }
      } finally {
        setAiProcessing(false)
        console.log(`🏁 [${requestId}] Thread request complete`)
      }
    },
    [currentChat, user, callAI]
  )

  return {
    aiProcessing,
    aiTyping,
    aiTypingStatus,
    askPoppy,
    askPoppyDirectly,
    askPoppyInThread,
  }
}
