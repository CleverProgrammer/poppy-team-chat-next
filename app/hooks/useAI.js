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
  const createTypingMessage = useCallback(() => ({
    id: `ai-typing-${Date.now()}`,
    sender: '🤖 Poppy',
    senderId: 'ai',
    text: '',
    timestamp: new Date(),
    isTyping: true
  }), []);

  // Call AI API
  const callAI = useCallback(async (question, chatHistory) => {
    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        chatHistory
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  }, []);

  // Ask Poppy in channel/DM (posts response as message)
  const askPoppy = useCallback(async (userQuestion) => {
    if (aiProcessing || !currentChat) return;

    setAiProcessing(true);

    // Show typing indicator
    const typingMessage = createTypingMessage();
    setMessages(prev => [...prev, typingMessage]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);

    try {
      console.log('🤖 Poppy AI: Calling API...');
      const aiResponse = await callAI(userQuestion, messages.slice(-10));

      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.id !== typingMessage.id));

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
      setMessages(prev => prev.filter(msg => msg.id !== typingMessage.id));

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
