'use client';

import { useState, useCallback, useRef } from 'react';
import {
  sendMessage,
  sendMessageDM,
  getDMId,
  uploadImage,
  sendMessageWithMedia,
  sendMessageDMWithMedia,
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
  isAutoScrollingRef,
  imageFile,
  imagePreview,
  imageFiles = [],
  imagePreviews = [],
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

    // Allow sending if there's text OR images
    const hasImages = imageFiles.length > 0;
    if ((!messageText.trim() && !hasImages) || sending) return;

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
      // Support both single and multiple images
      imageUrl: imagePreviews[0] || null,
      imageUrls: imagePreviews.length > 0 ? imagePreviews : null,
      replyTo: replyingTo,
      optimistic: true // Mark as optimistic
    };

    // Add optimistic message to UI instantly
    setMessages(prev => [...prev, optimisticMessage]);

    // Clear input and state immediately for instant feel
    const currentImageFiles = [...imageFiles];
    const currentReplyingTo = replyingTo;

    clearImage();
    setReplyingTo(null);

    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.style.height = 'auto';
      // Keep focus immediately after clearing
      inputRef.current.focus();
    }

    // Clear typing indicator for DMs
    clearTypingIndicator();

    // Scroll to bottom using Virtuoso
    // Set flag to prevent blur during auto-scroll (keep it set longer to survive re-renders)
    if (isAutoScrollingRef) isAutoScrollingRef.current = true;
    
    // Scroll after a tiny delay to let the optimistic message render
    setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({
        index: 'LAST',
        align: 'end',
        behavior: 'auto'
      });
    }, 10);
    
    // Clear the auto-scroll flag and ensure focus after everything settles
    setTimeout(() => {
      if (isAutoScrollingRef) isAutoScrollingRef.current = false;
      inputRef.current?.focus();
    }, 300);

    setSending(true);
    try {
      let imageUrls = [];
      let muxPlaybackIds = [];

      // Separate videos and images
      const videoFiles = currentImageFiles.filter(f => f.type.startsWith('video/'));
      const imageOnlyFiles = currentImageFiles.filter(f => f.type.startsWith('image/'));

      // Upload media if present
      if (currentImageFiles.length > 0) {
        setUploading(true);

        // Upload images to Firebase in parallel
        if (imageOnlyFiles.length > 0) {
          imageUrls = await Promise.all(
            imageOnlyFiles.map(file => uploadImage(file, user.uid))
          );
        }

        // Upload videos to Mux in parallel
        if (videoFiles.length > 0) {
          const muxResults = await Promise.all(
            videoFiles.map(async (file) => {
              // Get upload URL
              const uploadResponse = await fetch('/api/mux/upload', { method: 'POST' });
              const { uploadUrl, uploadId } = await uploadResponse.json();
              
              // Upload to Mux
              await fetch(uploadUrl, { method: 'PUT', body: file });
              
              // Poll for playback ID (with timeout)
              let playbackId = null;
              for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 1000));
                const assetRes = await fetch(`/api/mux/asset?uploadId=${uploadId}`);
                const assetData = await assetRes.json();
                if (assetData.ready && assetData.playbackId) {
                  playbackId = assetData.playbackId;
                  break;
                }
              }
              return playbackId;
            })
          );
          muxPlaybackIds = muxResults.filter(Boolean);
        }

        setUploading(false);
      }

      const hasMedia = imageUrls.length > 0 || muxPlaybackIds.length > 0;

      if (currentChat.type === 'ai') {
        // Send user message to Firestore
        await sendAIMessage(user.uid, messageText, false, user);

        // Get AI response
        await askPoppyDirectly(messageText);
      } else if (currentChat.type === 'channel') {
        // Send message with optional media and reply
        if (hasMedia) {
          await sendMessageWithMedia(currentChat.id, user, messageText, imageUrls, muxPlaybackIds, currentReplyingTo);
        } else if (currentReplyingTo) {
          await sendMessageWithReply(currentChat.id, user, messageText, currentReplyingTo);
        } else {
          await sendMessage(currentChat.id, user, messageText);
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
        // Find recipient from allUsers for Ragie metadata
        const recipient = allUsers.find(u => u.uid === currentChat.id) || null;

        // Send DM with optional media and reply
        if (hasMedia) {
          await sendMessageDMWithMedia(dmId, user, currentChat.id, messageText, recipient, imageUrls, muxPlaybackIds, currentReplyingTo);
        } else if (currentReplyingTo) {
          await sendMessageDMWithReply(dmId, user, messageText, currentChat.id, currentReplyingTo, recipient);
        } else {
          await sendMessageDM(dmId, user, messageText, currentChat.id, recipient);
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
      // Ensure input stays focused after send completes
      inputRef.current?.focus();
    }
  }, [
    user,
    currentChat,
    inputRef,
    virtuosoRef,
    imageFiles,
    imagePreviews,
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

  // Send a video reply directly with mux playback ID
  const sendVideoReply = useCallback(async (muxPlaybackId, replyTo) => {
    if (!currentChat || !muxPlaybackId) return;

    try {
      if (currentChat.type === 'channel') {
        await sendMessageWithMedia(currentChat.id, user, '', [], [muxPlaybackId], replyTo);
        
        // Mark as unread for all other users
        setTimeout(() => {
          allUsers.forEach(otherUser => {
            if (otherUser.uid !== user.uid) {
              markChatAsUnread(otherUser.uid, 'channel', currentChat.id).catch(err =>
                console.error('Failed to mark as unread:', err)
              );
            }
          });
        }, 0);
      } else if (currentChat.type === 'dm') {
        const dmId = getDMId(user.uid, currentChat.id);
        const recipient = allUsers.find(u => u.uid === currentChat.id) || null;
        
        await sendMessageDMWithMedia(dmId, user, currentChat.id, '', recipient, [], [muxPlaybackId], replyTo);
        
        // Mark as unread for the recipient
        setTimeout(() => {
          markChatAsUnread(currentChat.id, 'dm', user.uid).catch(err =>
            console.error('Failed to mark DM as unread:', err)
          );
        }, 0);
      }
    } catch (error) {
      console.error('Error sending video reply:', error);
      throw error;
    }
  }, [user, currentChat, allUsers]);

  return {
    sending,
    handleSend,
    handleEdit,
    sendVideoReply,
    updateTypingIndicator,
    clearTypingIndicator,
    typingTimeoutRef
  };
}
