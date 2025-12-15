'use client';

import { useState, useCallback, useRef } from 'react';
import {
  sendMessage,
  sendMessageDM,
  getDMId,
  uploadImage,
  sendMessageWithImage,
  sendMessageDMWithImage,
  sendMessageWithReply,
  sendMessageDMWithReply,
  editMessage,
  sendAIMessage,
  setUserTyping,
  markChatAsUnread
} from '../lib/firestore';

export function useMessageSending({
  user,
  currentChat,
  inputRef,
  virtuosoRef,
  imageFile,
  imagePreview,
  clearImage,
  replyingTo,
  setReplyingTo,
  editingMessage,
  setEditingMessage,
  setMessages,
  setUploading,
  allUsers,
  askPoppy,
  askPoppyDirectly
}) {
  const [sending, setSending] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Clear typing indicator
  const clearTypingIndicator = useCallback(() => {
    if (currentChat?.type === 'dm' && user) {
      const dmId = getDMId(user.uid, currentChat.id);
      setUserTyping(dmId, user.uid, false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [currentChat, user]);

  // Update typing indicator on input change
  const updateTypingIndicator = useCallback(() => {
    if (currentChat?.type === 'dm' && user) {
      const dmId = getDMId(user.uid, currentChat.id);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set typing to true
      console.log('🔍 Setting typing status:', { dmId, userId: user.uid, isTyping: true });
      setUserTyping(dmId, user.uid, true);

      // Set timeout to stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setUserTyping(dmId, user.uid, false);
      }, 2000);
    }
  }, [currentChat, user]);

  // Handle editing a message
  const handleEdit = useCallback(async () => {
    const messageText = inputRef.current?.value || '';
    if (!editingMessage || !messageText.trim()) return;

    const isDM = currentChat.type === 'dm';
    const chatId = isDM ? getDMId(user.uid, currentChat.id) : currentChat.id;

    try {
      await editMessage(chatId, editingMessage.id, messageText, isDM);
      setEditingMessage(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Failed to edit message. Please try again.');
    }
  }, [editingMessage, currentChat, user, inputRef, setEditingMessage]);

  // Main send handler
  const handleSend = useCallback(async () => {
    // Get the actual value from the textarea
    const messageText = inputRef.current?.value || '';

    // If editing, use handleEdit instead
    if (editingMessage) {
      return handleEdit();
    }

    if ((!messageText.trim() && !imageFile) || sending) return;

    // Check for @poppy mention - match @poppy anywhere in text and capture everything after
    const poppyMention = messageText.match(/@poppy\s*(.*)/i);
    const aiQuestion = poppyMention && poppyMention[1]?.trim() ? poppyMention[1].trim() : null;
    const shouldTriggerAI = !!aiQuestion;

    // Create optimistic message immediately
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      text: messageText,
      sender: user.displayName || user.email,
      senderId: user.uid,
      photoURL: user.photoURL || '',
      timestamp: new Date(),
      imageUrl: imagePreview, // Show preview immediately if image
      replyTo: replyingTo,
      optimistic: true // Mark as optimistic
    };

    // Add optimistic message to UI instantly
    setMessages(prev => [...prev, optimisticMessage]);

    // Clear input and state immediately for instant feel
    const currentImageFile = imageFile;
    const currentReplyingTo = replyingTo;

    clearImage();
    setReplyingTo(null);

    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.style.height = 'auto';
    }

    // Clear typing indicator for DMs
    clearTypingIndicator();

    // Scroll to bottom using Virtuoso
    setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({
        index: 'LAST',
        align: 'end',
        behavior: 'auto'
      });
    }, 0);

    setSending(true);
    try {
      let imageUrl = null;

      // Upload image if present
      if (currentImageFile) {
        setUploading(true);
        imageUrl = await uploadImage(currentImageFile, user.uid);
        setUploading(false);
      }

      if (currentChat.type === 'ai') {
        // Send user message to Firestore
        await sendAIMessage(user.uid, messageText, false);

        // Get AI response
        await askPoppyDirectly(messageText);
      } else if (currentChat.type === 'channel') {
        // Check if replying
        if (currentReplyingTo) {
          if (imageUrl) {
            // TODO: Add support for reply with image
            await sendMessageWithImage(currentChat.id, user, imageUrl, messageText);
          } else {
            await sendMessageWithReply(currentChat.id, user, messageText, currentReplyingTo);
          }
        } else {
          if (imageUrl) {
            await sendMessageWithImage(currentChat.id, user, imageUrl, messageText);
          } else {
            await sendMessage(currentChat.id, user, messageText);
          }
        }

        // Mark as unread for all other users (async, non-blocking)
        setTimeout(() => {
          allUsers.forEach(otherUser => {
            if (otherUser.uid !== user.uid) {
              markChatAsUnread(otherUser.uid, 'channel', currentChat.id).catch(err =>
                console.error('Failed to mark as unread:', err)
              );
            }
          });
        }, 0);
      } else {
        const dmId = getDMId(user.uid, currentChat.id);

        // Check if replying
        if (currentReplyingTo) {
          if (imageUrl) {
            // TODO: Add support for reply with image
            await sendMessageDMWithImage(dmId, user, imageUrl, currentChat.id, messageText);
          } else {
            await sendMessageDMWithReply(dmId, user, messageText, currentChat.id, currentReplyingTo);
          }
        } else {
          if (imageUrl) {
            await sendMessageDMWithImage(dmId, user, imageUrl, currentChat.id, messageText);
          } else {
            await sendMessageDM(dmId, user, messageText, currentChat.id);
          }
        }

        // Mark as unread for the recipient (async, non-blocking)
        setTimeout(() => {
          markChatAsUnread(currentChat.id, 'dm', user.uid).catch(err =>
            console.error('Failed to mark DM as unread:', err)
          );
        }, 0);
      }

      // Remove optimistic message once real one arrives (Firestore subscription will add it)
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));

      // Trigger AI response if @poppy was mentioned
      if (shouldTriggerAI) {
        askPoppy(aiQuestion);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
      setUploading(false);
    }
  }, [
    user,
    currentChat,
    inputRef,
    virtuosoRef,
    imageFile,
    imagePreview,
    clearImage,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setMessages,
    setUploading,
    allUsers,
    askPoppy,
    askPoppyDirectly,
    sending,
    handleEdit,
    clearTypingIndicator
  ]);

  return {
    sending,
    handleSend,
    handleEdit,
    updateTypingIndicator,
    clearTypingIndicator,
    typingTimeoutRef
  };
}
