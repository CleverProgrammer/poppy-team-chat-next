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
  fetchLinkPreview,
  updateMessageLinkPreview
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
  // Audio files (same pattern as images - for AI questions)
  audioFiles = [],
  audioPreviews = [],
  clearAudio,
  clearAllMedia,
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
  const typingThrottleRef = useRef(null); // Timer for scheduled throttled Firestore update
  const lastTypingUpdateRef = useRef(0); // Timestamp (ms) of last Firestore write for typing indicator

  // Clear typing indicator
  const clearTypingIndicator = useCallback(() => {
    if (currentChat?.type === 'dm' && user) {
      const dmId = getDMId(user.uid, currentChat.id);
      setUserTyping(dmId, user.uid, false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingThrottleRef.current) {
        clearTimeout(typingThrottleRef.current);
        typingThrottleRef.current = null;
      }
      lastTypingUpdateRef.current = 0;
    }
  }, [currentChat, user]);

  // Update typing indicator on input change - throttled to prevent excessive Firestore writes
  const updateTypingIndicator = useCallback(() => {
    // Skip typing indicator for private AI mode - don't reveal you're typing to recipient
    if (aiMode && privateMode) return;
    
    if (currentChat?.type === 'dm' && user) {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastTypingUpdateRef.current;
      const THROTTLE_MS = 1000; // Throttle to max 1 update per second

      console.log(`⌨️ [Typing] Keystroke detected - ${timeSinceLastUpdate}ms since last update`);

      // Clear existing typing timeout (the 2s trailing clear)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      const dmId = getDMId(user.uid, currentChat.id);

      // Leading-throttle: fire immediately on first call or after throttle period
      if (timeSinceLastUpdate >= THROTTLE_MS) {
        // Clear any pending throttled update
        if (typingThrottleRef.current) {
          clearTimeout(typingThrottleRef.current);
          typingThrottleRef.current = null;
        }

        // Fire the typing indicator immediately
        console.log('🔥 [Typing] FIRED immediately (leading edge) → Firestore write');
        setUserTyping(dmId, user.uid, true);
        lastTypingUpdateRef.current = now;

        // Set timeout to stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          console.log('⏹️ [Typing] Cleared after 2s inactivity → Firestore write');
          setUserTyping(dmId, user.uid, false);
          lastTypingUpdateRef.current = 0;
        }, 2000);
      } else {
        // Within throttle window - schedule an update at the throttle boundary
        if (typingThrottleRef.current) {
          clearTimeout(typingThrottleRef.current);
        }

        const remainingTime = THROTTLE_MS - timeSinceLastUpdate;
        console.log(`⏰ [Typing] Throttled - scheduled in ${remainingTime}ms`);
        typingThrottleRef.current = setTimeout(() => {
          console.log('🔥 [Typing] FIRED (throttled update) → Firestore write');
          setUserTyping(dmId, user.uid, true);
          lastTypingUpdateRef.current = Date.now();
          typingThrottleRef.current = null;

          // Reset the 2s trailing clear
          typingTimeoutRef.current = setTimeout(() => {
            console.log('⏹️ [Typing] Cleared after 2s inactivity → Firestore write');
            setUserTyping(dmId, user.uid, false);
            lastTypingUpdateRef.current = 0;
          }, 2000);
        }, remainingTime);
      }
    } else {
      console.log('⏩ [Typing] Skipped - not a DM or no user');
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

    // Allow sending if there's text OR images OR audio files
    const hasImages = imageFiles.length > 0;
    const hasAudio = audioFiles.length > 0;
    if ((!messageText.trim() && !hasImages && !hasAudio) || sending) return;

    // Check for @poppy mention anywhere in the message (not just at the start)
    const hasPoppyMention = /@poppy/i.test(messageText);
    
    // AI Mode: treat all messages as AI questions (even without @poppy prefix)
    // forceAI overrides this for one-time AI sends (Cmd+Enter shortcuts)
    const effectiveAiMode = aiMode || forceAI;
    const shouldTriggerAI = effectiveAiMode || hasPoppyMention;
    // Use the full message as the AI question (the AI gets the full context)
    const actualAiQuestion = shouldTriggerAI ? messageText.trim() : null;
    
    // Private mode: mark message as private (only visible to sender)
    // forcePrivate overrides privateMode for one-time sends
    const effectivePrivateMode = forcePrivate !== null ? forcePrivate : privateMode;
    const isPrivate = effectiveAiMode && effectivePrivateMode;

    // Kick off link preview fetch, but don't block sending
    const firstUrl = extractFirstUrl(messageText);
    const previewPromise =
      firstUrl && !isLoomUrl(messageText) ? fetchLinkPreview(firstUrl) : null;
    let messageIdForPreview = null;
    let chatIdForPreview = null;
    let chatTypeForPreview = null;

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
    const currentAudioFiles = [...audioFiles];
    const currentAudioPreviews = [...audioPreviews];
    const currentReplyingTo = replyingTo;

    // Clear all media (images + audio)
    if (clearAllMedia) {
      clearAllMedia();
    } else {
      clearImage();
      if (clearAudio) clearAudio();
    }
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

      // Upload audio files if present (for AI questions about audio)
      let audioUrls = [];
      let audioDurations = [];
      if (currentAudioFiles.length > 0) {
        setUploading(true);
        console.log(`🎵 Uploading ${currentAudioFiles.length} audio file(s)...`);
        
        const audioResults = await Promise.all(
          currentAudioFiles.map(async (file, index) => {
            const url = await uploadAudio(file, user.uid);
            const duration = currentAudioPreviews[index]?.duration || 0;
            console.log(`🎵 Uploaded: ${file.name} (${duration.toFixed(1)}s)`);
            return { url, duration };
          })
        );
        
        audioUrls = audioResults.map(r => r.url);
        audioDurations = audioResults.map(r => r.duration);
        setUploading(false);
      }

      // hasMedia now includes audio (all media in one message, like images)
      const hasMedia = imageUrls.length > 0 || muxPlaybackIds.length > 0 || audioUrls.length > 0;
      const privateOptions = { isPrivate, privateFor: user.uid };

      if (currentChat.type === 'ai') {
        // Send user message to Firestore (with images if present)
        await sendAIMessage(user.uid, messageText, false, user, imageUrls.length > 0 ? imageUrls : null);

        // Get AI response with images for vision (fire and forget - don't block message sending)
        askPoppyDirectly(messageText, imageUrls.length > 0 ? imageUrls : null);
      } else if (currentChat.type === 'channel') {
        // Send message with optional media, reply, and link preview
        if (hasMedia) {
          messageIdForPreview = await sendMessageWithMedia(
            currentChat.id,
            user,
            messageText,
            imageUrls,
            muxPlaybackIds,
            currentReplyingTo,
            mediaDimensions,
            null,
            privateOptions,
            messages,
            audioUrls,
            audioDurations
          );
        } else if (currentReplyingTo) {
          messageIdForPreview = await sendMessageWithReply(
            currentChat.id,
            user,
            messageText,
            currentReplyingTo,
            null,
            privateOptions
          );
        } else {
          messageIdForPreview = await sendMessage(
            currentChat.id,
            user,
            messageText,
            null,
            privateOptions
          );
        }

        chatIdForPreview = currentChat.id;
        chatTypeForPreview = 'channel';

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
          messageIdForPreview = await sendMessageDMWithMedia(
            dmId,
            user,
            currentChat.id,
            messageText,
            recipient,
            imageUrls,
            muxPlaybackIds,
            currentReplyingTo,
            mediaDimensions,
            null,
            privateOptions,
            messages,
            audioUrls,
            audioDurations
          );
        } else if (currentReplyingTo) {
          messageIdForPreview = await sendMessageDMWithReply(
            dmId,
            user,
            messageText,
            currentChat.id,
            currentReplyingTo,
            recipient,
            null,
            privateOptions
          );
        } else {
          messageIdForPreview = await sendMessageDM(
            dmId,
            user,
            messageText,
            currentChat.id,
            recipient,
            null,
            privateOptions
          );
        }

        chatIdForPreview = dmId;
        chatTypeForPreview = 'dm';

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
          messageIdForPreview = await sendGroupMessageWithMedia(
            currentChat.id,
            user,
            messageText,
            imageUrls,
            muxPlaybackIds,
            currentReplyingTo,
            mediaDimensions,
            null,
            privateOptions,
            messages,
            audioUrls,
            audioDurations
          );
        } else if (currentReplyingTo) {
          messageIdForPreview = await sendGroupMessageWithReply(
            currentChat.id,
            user,
            messageText,
            currentReplyingTo,
            null,
            privateOptions
          );
        } else {
          messageIdForPreview = await sendGroupMessage(
            currentChat.id,
            user,
            messageText,
            null,
            privateOptions
          );
        }

        chatIdForPreview = currentChat.id;
        chatTypeForPreview = 'group';

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

      // Attach link preview asynchronously after the message is sent
      if (previewPromise && messageIdForPreview && chatIdForPreview && chatTypeForPreview) {
        previewPromise
          .then(preview => {
            if (!preview) return;
            return updateMessageLinkPreview(chatIdForPreview, messageIdForPreview, chatTypeForPreview, preview);
          })
          .catch(err => console.warn('Failed to attach link preview:', err));
      }

      // Trigger background conversion for CAF audio files (iPhone Voice Memos)
      // This converts them to MP3 so they can be played in browsers
      if (audioUrls.length > 0 && messageIdForPreview && chatIdForPreview && chatTypeForPreview) {
        audioUrls.forEach((url, index) => {
          // Check if it's a CAF file (iPhone Voice Memos format)
          if (url.toLowerCase().includes('.caf')) {
            console.log(`🔄 Triggering CAF→MP3 conversion for audio ${index + 1}...`);
            fetch('/api/trigger/convert-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioUrl: url,
                userId: user.uid,
                messageId: messageIdForPreview,
                chatId: chatIdForPreview,
                chatType: chatTypeForPreview,
                audioIndex: index,
              }),
            }).catch(err => console.error('Failed to trigger audio conversion:', err));
          }
        });
      }

      // Remove optimistic message once real one arrives (Firestore subscription will add it)
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));

      // Trigger AI response if @poppy was mentioned or AI mode is active
      // Pass uploaded image URLs to AI for vision analysis
      // For audio: transcribe first so AI has the transcriptions immediately
      // If replying to a message, pass it as targetedMessage so AI knows what we're referring to
      if (shouldTriggerAI && actualAiQuestion) {
        // If there are audio files, transcribe them before asking AI
        let audioTranscripts = null;
        if (audioUrls.length > 0) {
          console.log('🎵 Transcribing audio files for AI...');
          try {
            const transcriptions = await Promise.all(
              audioUrls.map(async (url) => {
                try {
                  const response = await fetch('/api/media/transcribe-audio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audioUrl: url }),
                  });
                  const data = await response.json();
                  // API returns { transcription: { text, formatted, tldr } }
                  return data.transcription?.text || '';
                } catch (err) {
                  console.error('Failed to transcribe audio for AI:', err);
                  return '';
                }
              })
            );
            audioTranscripts = transcriptions.filter(t => t);
            console.log(`🎵 Got ${audioTranscripts.length} transcription(s) for AI`);
          } catch (err) {
            console.error('Audio transcription for AI failed:', err);
          }
        }

        askPoppy(actualAiQuestion, { 
          isPrivate, 
          privateFor: user.uid,
          imageUrls: imageUrls.length > 0 ? imageUrls : null,
          audioTranscripts: audioTranscripts?.length > 0 ? audioTranscripts : null, // Pass transcriptions to AI
          targetedMessage: currentReplyingTo || null, // Pass the message being replied to
        });
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
    audioFiles,
    audioPreviews,
    clearAudio,
    clearAllMedia,
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
