'use client';

import { useState, useCallback, useRef } from 'react';
import {
  sendMessage,
  sendMessageDM,
  sendGroupMessage,
  getDMId,
  uploadImage,
  uploadAudio,
  sendMessageWithMedia,
  sendMessageDMWithMedia,
  sendGroupMessageWithMedia,
  sendMessageWithAudio,
  sendMessageDMWithAudio,
  sendGroupMessageWithAudio,
  sendMessageWithReply,
  sendMessageDMWithReply,
  sendGroupMessageWithReply,
  editMessage,
  sendAIMessage,
  setUserTyping,
  markChatAsUnread,
  getImageDimensions,
  getVideoDimensions,
  fetchLinkPreview
} from '../lib/firestore';
import { extractFirstUrl, isLoomUrl } from '../utils/messageFormatting';

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
  messages = [], // All messages for AI context
  setMessages,
  setUploading,
  allUsers,
  askPoppy,
  askPoppyDirectly,
  aiMode = false,
  privateMode = false,
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
    // Skip typing indicator for private AI mode - don't reveal you're typing to recipient
    if (aiMode && privateMode) return;
    
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
  }, [currentChat, user, aiMode, privateMode]);

  // Handle editing a message
  const handleEdit = useCallback(async () => {
    const messageText = inputRef.current?.value || '';
    if (!editingMessage || !messageText.trim()) return;

    const chatType = currentChat.type; // 'channel', 'dm', or 'group'
    const chatId = chatType === 'dm' ? getDMId(user.uid, currentChat.id) : currentChat.id;

    try {
      await editMessage(chatId, editingMessage.id, messageText, chatType);
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
  // Optional overrides for one-time AI sends:
  // - forceAI: true to send to AI even if not in aiMode
  // - forcePrivate: true/false to override privateMode for this send
  const handleSend = useCallback(async (options = {}) => {
    const { forceAI = false, forcePrivate = null } = options;
    
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
    
    // AI Mode: treat all messages as AI questions (even without @poppy prefix)
    // forceAI overrides this for one-time AI sends (Cmd+Enter shortcuts)
    const effectiveAiMode = aiMode || forceAI;
    const shouldTriggerAI = effectiveAiMode ? true : !!aiQuestion;
    const actualAiQuestion = effectiveAiMode ? messageText.trim() : aiQuestion;
    
    // Private mode: mark message as private (only visible to sender)
    // forcePrivate overrides privateMode for one-time sends
    const effectivePrivateMode = forcePrivate !== null ? forcePrivate : privateMode;
    const isPrivate = effectiveAiMode && effectivePrivateMode;

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
      optimistic: true, // Mark as optimistic
      isPrivate: isPrivate, // Mark as private if in private AI mode
      privateFor: isPrivate ? user.uid : null, // Set privateFor for filter to work correctly
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
      let mediaDimensions = []; // Store dimensions for layout stability

      // Separate videos and images
      const videoFiles = currentImageFiles.filter(f => f.type.startsWith('video/'));
      const imageOnlyFiles = currentImageFiles.filter(f => f.type.startsWith('image/'));

      // Upload media if present
      if (currentImageFiles.length > 0) {
        setUploading(true);

        // Upload images to Firebase in parallel AND get their dimensions
        if (imageOnlyFiles.length > 0) {
          const imageResults = await Promise.all(
            imageOnlyFiles.map(async (file) => {
              // Get dimensions and upload in parallel for each image
              const [url, dimensions] = await Promise.all([
                uploadImage(file, user.uid),
                getImageDimensions(file)
              ]);
              console.log('📐 Image dimensions extracted:', dimensions, 'for file:', file.name);
              return { url, dimensions };
            })
          );
          imageUrls = imageResults.map(r => r.url);
          // Add image dimensions to the array
          mediaDimensions = imageResults.map(r => r.dimensions).filter(Boolean);
          console.log('📐 All media dimensions to store:', mediaDimensions);
        }

        // Upload videos to Mux in parallel AND get their dimensions
        if (videoFiles.length > 0) {
          const muxResults = await Promise.all(
            videoFiles.map(async (file) => {
              // Get video dimensions first (before upload)
              const dimensions = await getVideoDimensions(file);
              
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
              return { playbackId, dimensions };
            })
          );
          muxPlaybackIds = muxResults.map(r => r.playbackId).filter(Boolean);
          // Add video dimensions after image dimensions
          const videoDimensions = muxResults.map(r => r.dimensions).filter(Boolean);
          mediaDimensions = [...mediaDimensions, ...videoDimensions];
        }

        setUploading(false);
      }

      const hasMedia = imageUrls.length > 0 || muxPlaybackIds.length > 0;
      const privateOptions = { isPrivate, privateFor: user.uid };

      // Fetch link preview if message contains a URL (not Loom - those are embedded)
      let linkPreview = null;
      const firstUrl = extractFirstUrl(messageText);
      if (firstUrl && !isLoomUrl(messageText)) {
        console.log('🔗 Fetching link preview for:', firstUrl);
        linkPreview = await fetchLinkPreview(firstUrl);
        console.log('🔗 Link preview fetched:', linkPreview);
      }

      if (currentChat.type === 'ai') {
        // Send user message to Firestore
        await sendAIMessage(user.uid, messageText, false, user);

        // Get AI response (fire and forget - don't block message sending)
        askPoppyDirectly(messageText);
      } else if (currentChat.type === 'channel') {
        // Send message with optional media, reply, and link preview
        if (hasMedia) {
          await sendMessageWithMedia(currentChat.id, user, messageText, imageUrls, muxPlaybackIds, currentReplyingTo, mediaDimensions, linkPreview, privateOptions, messages);
        } else if (currentReplyingTo) {
          await sendMessageWithReply(currentChat.id, user, messageText, currentReplyingTo, linkPreview, privateOptions);
        } else {
          await sendMessage(currentChat.id, user, messageText, linkPreview, privateOptions);
        }

        // Mark as unread for all other users (async, non-blocking)
        // Skip for private messages - they shouldn't notify others
        if (!isPrivate) {
          setTimeout(() => {
            allUsers.forEach(otherUser => {
              if (otherUser.uid !== user.uid) {
                markChatAsUnread(otherUser.uid, 'channel', currentChat.id).catch(err =>
                  console.error('Failed to mark as unread:', err)
                );
              }
            });
          }, 0);
        }
      } else if (currentChat.type === 'dm') {
        const dmId = getDMId(user.uid, currentChat.id);
        // Find recipient from allUsers for Ragie metadata
        const recipient = allUsers.find(u => u.uid === currentChat.id) || null;

        // Send DM with optional media, reply, and link preview
        if (hasMedia) {
          await sendMessageDMWithMedia(dmId, user, currentChat.id, messageText, recipient, imageUrls, muxPlaybackIds, currentReplyingTo, mediaDimensions, linkPreview, privateOptions, messages);
        } else if (currentReplyingTo) {
          await sendMessageDMWithReply(dmId, user, messageText, currentChat.id, currentReplyingTo, recipient, linkPreview, privateOptions);
        } else {
          await sendMessageDM(dmId, user, messageText, currentChat.id, recipient, linkPreview, privateOptions);
        }

        // Mark as unread for the recipient (async, non-blocking)
        // Skip for private messages - they shouldn't notify the recipient
        if (!isPrivate) {
          setTimeout(() => {
            markChatAsUnread(currentChat.id, 'dm', user.uid).catch(err =>
              console.error('Failed to mark DM as unread:', err)
            );
          }, 0);
        }
      } else if (currentChat.type === 'group') {
        // Send group message with optional media, reply, and link preview
        if (hasMedia) {
          await sendGroupMessageWithMedia(currentChat.id, user, messageText, imageUrls, muxPlaybackIds, currentReplyingTo, mediaDimensions, linkPreview, privateOptions, messages);
        } else if (currentReplyingTo) {
          await sendGroupMessageWithReply(currentChat.id, user, messageText, currentReplyingTo, linkPreview, privateOptions);
        } else {
          await sendGroupMessage(currentChat.id, user, messageText, linkPreview, privateOptions);
        }

        // Mark as unread for all group members (async, non-blocking)
        // Skip for private messages
        if (!isPrivate) {
          setTimeout(() => {
            const groupMembers = currentChat.group?.members || {};
            Object.keys(groupMembers).forEach(memberId => {
              if (memberId !== user.uid) {
                markChatAsUnread(memberId, 'group', currentChat.id).catch(err =>
                  console.error('Failed to mark group as unread:', err)
                );
              }
            });
          }, 0);
        }
      }

      // Remove optimistic message once real one arrives (Firestore subscription will add it)
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));

      // Trigger AI response if @poppy was mentioned or AI mode is active
      if (shouldTriggerAI && actualAiQuestion) {
        askPoppy(actualAiQuestion, { isPrivate, privateFor: user.uid });
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
    clearTypingIndicator,
    aiMode,
    privateMode
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
      } else if (currentChat.type === 'group') {
        await sendGroupMessageWithMedia(currentChat.id, user, '', [], [muxPlaybackId], replyTo);
        
        // Mark as unread for all group members
        setTimeout(() => {
          const groupMembers = currentChat.group?.members || {};
          Object.keys(groupMembers).forEach(memberId => {
            if (memberId !== user.uid) {
              markChatAsUnread(memberId, 'group', currentChat.id).catch(err =>
                console.error('Failed to mark group as unread:', err)
              );
            }
          });
        }, 0);
      }
    } catch (error) {
      console.error('Error sending video reply:', error);
      throw error;
    }
  }, [user, currentChat, allUsers]);

  // Send audio message
  const handleSendAudio = useCallback(async (audioBlob, duration) => {
    if (!currentChat || !audioBlob || sending) return;

    // Create optimistic message ID before try block
    const optimisticId = `temp-${Date.now()}`;

    try {
      setUploading(true);
      
      // Upload audio to Firebase Storage
      const audioUrl = await uploadAudio(audioBlob, user.uid);

      // Create optimistic message
      const optimisticMessage = {
        id: optimisticId,
        text: '',
        sender: user.displayName || user.email,
        senderId: user.uid,
        photoURL: user.photoURL || '',
        timestamp: new Date(),
        audioUrl: audioUrl,
        audioDuration: duration,
        optimistic: true
      };

      setMessages(prev => [...prev, optimisticMessage]);

      // Scroll to bottom
      if (isAutoScrollingRef) isAutoScrollingRef.current = true;
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: 'LAST',
          align: 'end',
          behavior: 'auto'
        });
      }, 10);

      // Send message with audio
      if (currentChat.type === 'channel') {
        await sendMessageWithAudio(currentChat.id, user, audioUrl, duration);
        
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
        
        await sendMessageDMWithAudio(dmId, user, currentChat.id, audioUrl, duration, recipient);
        
        // Mark as unread for the recipient
        setTimeout(() => {
          markChatAsUnread(currentChat.id, 'dm', user.uid).catch(err =>
            console.error('Failed to mark DM as unread:', err)
          );
        }, 0);
      } else if (currentChat.type === 'group') {
        await sendGroupMessageWithAudio(currentChat.id, user, audioUrl, duration);
        
        // Mark as unread for all group members
        setTimeout(() => {
          const groupMembers = currentChat.group?.members || {};
          Object.keys(groupMembers).forEach(memberId => {
            if (memberId !== user.uid) {
              markChatAsUnread(memberId, 'group', currentChat.id).catch(err =>
                console.error('Failed to mark group as unread:', err)
              );
            }
          });
        }, 0);
      }

      // Remove optimistic message once real one arrives
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
    } catch (error) {
      console.error('Error sending audio message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      alert('Failed to send voice message. Please try again.');
    } finally {
      setUploading(false);
      if (isAutoScrollingRef) isAutoScrollingRef.current = false;
    }
  }, [user, currentChat, sending, setMessages, setUploading, allUsers, virtuosoRef, isAutoScrollingRef, sendMessageWithAudio, sendMessageDMWithAudio, uploadAudio, markChatAsUnread, getDMId]);

  return {
    sending,
    handleSend,
    handleEdit,
    sendVideoReply,
    handleSendAudio,
    updateTypingIndicator,
    clearTypingIndicator,
    typingTimeoutRef
  };
}
