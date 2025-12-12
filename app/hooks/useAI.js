'use client';

import { useState, useCallback } from 'react';
import { sendMessage, sendMessageDM, getDMId, sendAIMessage, markChatAsUnread } from '../lib/firestore';

const AI_USER = {
  uid: 'ai',
  displayName: '🤖 Poppy',
  email: 'ai@poppy.chat',
  photoURL: ''
};

export function useAI(user, currentChat, messages, setMessages, messagesEndRef) {
  const [aiProcessing, setAiProcessing] = useState(false);

  // Create typing indicator message
  const createTypingMessage = useCallback((status = '') => ({
    id: `ai-typing-${Date.now()}`,
    sender: '🤖 Poppy',
    senderId: 'ai',
    text: status,
    timestamp: new Date(),
    isTyping: true
  }), []);

  // Call AI API with streaming support (Vercel AI SDK format)
  const callAI = useCallback(async (question, chatHistory, onStatus = null) => {
    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        chatHistory,
        user: user ? {
          id: user.uid,
          email: user.email,
          name: user.displayName
        } : null
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    // Vercel AI SDK returns text/plain; charset=utf-8 streaming
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finalResponse = '';

    if (onStatus) {
      onStatus('Thinking...');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      finalResponse += chunk;

      // Update status with streaming content
      if (onStatus && chunk.trim()) {
        onStatus('Responding...');
      }
    }

    return finalResponse.trim();
  }, [user]);

  // Ask Poppy in channel/DM (posts response as message)
  const askPoppy = useCallback(async (userQuestion) => {
    if (aiProcessing || !currentChat) return;

    setAiProcessing(true);

    // Show typing indicator
    const typingMessageId = `ai-typing-${Date.now()}`;
    const initialTypingMessage = createTypingMessage('Thinking...');
    initialTypingMessage.id = typingMessageId;

    setMessages(prev => [...prev, initialTypingMessage]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);

    try {
      console.log('🤖 Poppy AI: Calling API...');

      // Update typing indicator with status updates
      const onStatus = (status) => {
        console.log('🔄 Poppy Status Update:', status);
        setMessages(prev => {
          const updated = prev.map(msg =>
            msg.id === typingMessageId
              ? { ...msg, text: status, isTyping: true }
              : msg
          );
          return updated;
        });
      };

      const aiResponse = await callAI(userQuestion, messages.slice(-10), onStatus);

      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.id !== typingMessageId));

      // Post AI response as a real message
      if (currentChat.type === 'channel') {
        await sendMessage(currentChat.id, AI_USER, aiResponse);
      } else {
        const dmId = getDMId(user.uid, currentChat.id);
        await sendMessageDM(dmId, AI_USER, aiResponse, currentChat.id);
      }

      console.log('🤖 Poppy AI: Response posted');
    } catch (error) {
      console.error('🤖 Poppy AI: Error:', error);

      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.id === typingMessageId));

      // Post error message
      const errorMsg = `Sorry, I had a problem: ${error.message}. Try again! 🤖`;
      if (currentChat.type === 'channel') {
        await sendMessage(currentChat.id, AI_USER, errorMsg);
      } else {
        const dmId = getDMId(user.uid, currentChat.id);
        await sendMessageDM(dmId, AI_USER, errorMsg, currentChat.id);
      }
    } finally {
      setAiProcessing(false);
    }
  }, [aiProcessing, currentChat, user, messages, setMessages, messagesEndRef, createTypingMessage, callAI]);

  // Direct chat with Poppy (for AI chat type - saves to Firestore)
  const askPoppyDirectly = useCallback(async (userQuestion) => {
    if (aiProcessing || !user) return;

    setAiProcessing(true);

    try {
      console.log('🤖 Poppy AI: Calling API for direct chat...');
      const chatHistory = messages.slice(-10).map(m => ({
        role: m.senderId === 'ai' ? 'assistant' : 'user',
        text: m.text
      }));

      const aiResponse = await callAI(userQuestion, chatHistory);

      // Save AI response to Firestore
      await sendAIMessage(user.uid, aiResponse, true);

      // Mark AI chat as unread for the user
      markChatAsUnread(user.uid, 'ai', 'poppy-ai');

      console.log('🤖 Poppy AI: Response added to direct chat');
    } catch (error) {
      console.error('🤖 Poppy AI: Error:', error);

      // Save error message to Firestore
      await sendAIMessage(user.uid, `Sorry, I had a problem: ${error.message}. Try again! 🤖`, true);

      // Mark AI chat as unread for the user
      markChatAsUnread(user.uid, 'ai', 'poppy-ai');
    } finally {
      setAiProcessing(false);
    }
  }, [aiProcessing, user, messages, callAI]);

  return {
    aiProcessing,
    askPoppy,
    askPoppyDirectly
  };
}
