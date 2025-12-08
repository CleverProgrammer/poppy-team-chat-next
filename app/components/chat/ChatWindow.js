'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Sidebar from '../layout/Sidebar';
import CommandPalette from './CommandPalette';
import NotificationBell from '../notifications/NotificationBell';
import { useAuth } from '../../contexts/AuthContext';
import { sendMessage, sendMessageDM, subscribeToMessages, subscribeToMessagesDM, subscribeToUsers, getDMId, saveCurrentChat, getCurrentChat, addActiveDM, subscribeToActiveDMs, discoverExistingDMs, uploadImage, sendMessageWithImage, sendMessageDMWithImage, addReaction, editMessage, deleteMessage, sendMessageWithReply, sendMessageDMWithReply, getEmojiUsage, updateEmojiUsage } from '../../lib/firestore';

// Helper function to linkify URLs in text
function linkifyText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="message-link"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// Default emoji set - matching the quick reactions layout
const defaultEmojis = ['🤩', '❤️', '😊', '😱', '🔥', '💪', '👏', '🙌', '🎉', '✨'];

export default function ChatWindow() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [currentChat, setCurrentChat] = useState({ type: 'channel', id: 'general', name: 'general' });
  const [allUsers, setAllUsers] = useState([]);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [activeDMs, setActiveDMs] = useState([]);
  const [unreadChats, setUnreadChats] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState(null);
  const [openEmojiPanel, setOpenEmojiPanel] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [emojiUsage, setEmojiUsage] = useState({});
  const [topReactions, setTopReactions] = useState(defaultEmojis);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const markChatAsReadRef = useRef(null);
  const messageRefs = useRef({});

  // Load saved chat on mount
  useEffect(() => {
    if (!user) return;

    // Add a small delay to ensure Firestore has time to sync
    const timer = setTimeout(() => {
      getCurrentChat(user.uid).then((savedChat) => {
        if (savedChat) {
          setCurrentChat(savedChat);
          // If it's a DM, add to active DMs
          if (savedChat.type === 'dm') {
            addActiveDM(user.uid, savedChat.id);
          }
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [user]);

  // Load all users
  useEffect(() => {
    const unsubscribe = subscribeToUsers((users) => {
      setAllUsers(users);
    });
    return () => unsubscribe();
  }, []);

  // Discover existing DMs when user logs in
  useEffect(() => {
    if (!user) return;

    discoverExistingDMs(user.uid);
  }, [user]);

  // Load emoji usage from Firestore
  useEffect(() => {
    if (!user) return;

    getEmojiUsage(user.uid).then((usage) => {
      setEmojiUsage(usage);
    });
  }, [user]);

  // Sort topReactions based on emoji usage
  useEffect(() => {
    // Get all emojis from emoji panel plus default emojis
    const allEmojis = ['👍', '👎', '❤️', '🧡', '💛', '💚', '💙', '😂', '🤣', '😊', '😍', '🥰', '😘', '🤗', '🤔', '🤯', '😱', '😮', '😢', '😭', '😤', '🔥', '💯', '💪', '👏', '🙌', '🎉', '✨', '👀', '💀', '🤡', '💩'];

    // Sort by usage count (descending)
    const sortedEmojis = allEmojis.sort((a, b) => {
      const countA = emojiUsage[a] || 0;
      const countB = emojiUsage[b] || 0;
      return countB - countA;
    });

    // Take top 10
    setTopReactions(sortedEmojis.slice(0, 10));
  }, [emojiUsage]);

  // Subscribe to active DMs from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToActiveDMs(user.uid, (dms) => {
      setActiveDMs(dms);
    });
    return () => unsubscribe();
  }, [user]);

  // Subscribe to messages based on current chat
  useEffect(() => {
    let unsubscribe;

    if (currentChat.type === 'channel') {
      unsubscribe = subscribeToMessages(currentChat.id, (newMessages) => {
        setMessages(newMessages);
      });
    } else if (currentChat.type === 'dm') {
      const dmId = getDMId(user.uid, currentChat.id);
      unsubscribe = subscribeToMessagesDM(dmId, (newMessages) => {
        setMessages(newMessages);
      });
    }

    return () => unsubscribe?.();
  }, [currentChat, user]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  // Auto-focus input when switching chats
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentChat]);

  // Keyboard shortcut for command palette and escape key handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(true);
      }
      if (e.key === 'Escape') {
        if (previewModalImage) {
          setPreviewModalImage(null);
        } else if (replyingTo) {
          cancelReply();
        }
      }

      // Cmd+R: Reply to most recent message from another person
      if ((e.metaKey || e.ctrlKey) && e.key === 'r' && !editingMessage && !replyingTo) {
        e.preventDefault();
        // Find the most recent message from another person
        const otherPersonMessages = messages.filter(msg => msg.senderId !== user?.uid);
        if (otherPersonMessages.length > 0) {
          const lastMsg = otherPersonMessages[otherPersonMessages.length - 1];
          startReply(lastMsg.id, lastMsg.sender, lastMsg.text);
        }
      }

      // Cmd+E: Edit most recently sent message
      if ((e.metaKey || e.ctrlKey) && e.key === 'e' && !editingMessage && !replyingTo) {
        e.preventDefault();
        // Find the most recent message from the current user
        const myMessages = messages.filter(msg => msg.senderId === user?.uid);
        if (myMessages.length > 0) {
          const lastMyMsg = myMessages[myMessages.length - 1];
          startEdit(lastMyMsg.id, lastMyMsg.text);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewModalImage, replyingTo, editingMessage, messages, user]);

  // Paste image handler
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            handleImageSelect(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Drag and drop handler
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type.startsWith('image/')) {
        handleImageSelect(file);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    multiple: false,
    noClick: true,
    noKeyboard: true
  });

  const handleImageSelect = (file) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSend = async () => {
    // Get the actual value from the textarea
    const messageText = inputRef.current?.value || '';

    // If editing, use handleEdit instead
    if (editingMessage) {
      return handleEdit();
    }

    if ((!messageText.trim() && !imageFile) || sending) return;

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

    setImageFile(null);
    setImagePreview(null);
    setReplyingTo(null);

    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.style.height = 'auto';
    }

    // Scroll to bottom
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);

    setSending(true);
    try {
      let imageUrl = null;

      // Upload image if present
      if (currentImageFile) {
        setUploading(true);
        imageUrl = await uploadImage(currentImageFile, user.uid);
        setUploading(false);
      }

      if (currentChat.type === 'channel') {
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

        // Trigger notification
        fetch('/api/notify-channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: user.uid,
            senderName: user.displayName || user.email,
            channelId: currentChat.id,
            messageText: imageUrl ? `${messageText} [Image]` : messageText,
            allUsers
          })
        }).catch(err => console.error('Notification error:', err));
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

        // Trigger notification
        fetch('/api/notify-dm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: user.uid,
            senderName: user.displayName || user.email,
            recipientId: currentChat.id,
            messageText: imageUrl ? `${messageText} [Image]` : messageText
          })
        }).catch(err => console.error('Notification error:', err));
      }

      // Remove optimistic message once real one arrives (Firestore subscription will add it)
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (editingMessage) {
        cancelEdit();
      } else if (replyingTo) {
        cancelReply();
      }
    }
  };

  const handleTextareaChange = useCallback((e) => {
    // Auto-expand textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }, []);

  const handleSelectChat = (chat) => {
    setCurrentChat(chat);
    setIsSidebarOpen(false); // Close sidebar on mobile after selecting chat

    // Clear unread badge for this chat
    const chatId = chat.type === 'channel' ? `channel:${chat.id}` : `dm:${chat.id}`;
    setUnreadChats(prev => prev.filter(id => id !== chatId));

    // Mark notifications as read in Knock
    if (markChatAsReadRef.current) {
      markChatAsReadRef.current(chat.type, chat.id);
    }

    // Add to active DMs if it's a DM
    if (chat.type === 'dm' && user) {
      addActiveDM(user.uid, chat.id);
    }
    // Save current chat to Firestore
    if (user) {
      saveCurrentChat(user.uid, chat);
    }
  };

  const handleUnreadChatsChange = (newUnreadChats) => {
    setUnreadChats(newUnreadChats);
  };

  const handleMarkChatReadCallback = (markReadFn) => {
    markChatAsReadRef.current = markReadFn;
  };

  // Reaction handlers
  const handleAddReaction = async (messageId, emoji) => {
    if (!user) return;

    const isDM = currentChat.type === 'dm';
    const chatId = isDM ? getDMId(user.uid, currentChat.id) : currentChat.id;

    try {
      await addReaction(chatId, messageId, user.uid, emoji, isDM);
      setOpenEmojiPanel(null);

      // Update emoji usage count
      await updateEmojiUsage(user.uid, emoji);

      // Update local state to reflect new usage immediately
      setEmojiUsage(prev => ({
        ...prev,
        [emoji]: (prev[emoji] || 0) + 1
      }));
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const toggleEmojiPanel = (messageId) => {
    setOpenEmojiPanel(openEmojiPanel === messageId ? null : messageId);
  };

  // Reply handlers
  const startReply = (messageId, sender, text) => {
    setReplyingTo({ msgId: messageId, sender, text });
    setContextMenu(null);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleMessagesAreaClick = (e) => {
    // Cancel reply when clicking in the messages area
    // But don't cancel if clicking on interactive elements like buttons, emojis, etc.
    if (replyingTo && !e.target.closest('.quick-reactions') && !e.target.closest('.emoji-panel') && !e.target.closest('.more-reactions-btn') && !e.target.closest('.message-image')) {
      cancelReply();
    }
  };

  const scrollToMessage = (messageId) => {
    const msgEl = messageRefs.current[messageId];
    if (msgEl) {
      msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      msgEl.style.animation = 'none';
      setTimeout(() => {
        msgEl.style.animation = 'highlight-msg 1s ease-out';
      }, 10);
    }
  };

  // Edit handlers
  const startEdit = (messageId, currentText) => {
    setEditingMessage({ id: messageId, text: currentText });
    if (inputRef.current) {
      inputRef.current.value = currentText;
    }
    inputRef.current?.focus();
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleEdit = async () => {
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
  };

  // Delete handler
  const handleDeleteMessage = async (messageId) => {
    const isDM = currentChat.type === 'dm';
    const chatId = isDM ? getDMId(user.uid, currentChat.id) : currentChat.id;

    try {
      await deleteMessage(chatId, messageId, isDM);
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message. Please try again.');
    }
  };

  // Context menu handler
  const handleContextMenu = (e, message) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      message
    });
  };

  // Close context menu and emoji panel on click outside
  useEffect(() => {
    const handleClick = (e) => {
      // Don't close if clicking inside emoji panel or the more reactions button
      if (e.target.closest('.emoji-panel') || e.target.closest('.more-reactions-btn')) {
        return;
      }
      setContextMenu(null);
      setOpenEmojiPanel(null);
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setOpenEmojiPanel(null);
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <>
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        allUsers={allUsers}
        onSelectChat={handleSelectChat}
      />

      {/* Image Preview Modal */}
      {previewModalImage && (
        <div className="image-modal" onClick={() => setPreviewModalImage(null)}>
          <div className="image-modal-content">
            <img src={previewModalImage} alt="Preview" />
            <button
              className="image-modal-close"
              onClick={() => setPreviewModalImage(null)}
              aria-label="Close preview"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="app-container">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <Sidebar
          currentChat={currentChat}
          onSelectChat={handleSelectChat}
          activeDMs={activeDMs}
          allUsers={allUsers}
          unreadChats={unreadChats}
          isOpen={isSidebarOpen}
        />

        {/* Chat Container */}
        <div className="chat-container">
          {/* Chat Header */}
          <div className="chat-header">
            <button
              className="mobile-menu-button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <span className="chat-header-icon">
              {currentChat.type === 'channel' ? '#' : '💬'}
            </span>
            <h1>{currentChat.name}</h1>
            <span className="chat-header-subtitle">
              {currentChat.type === 'channel' ? 'Team chat' : 'Direct message'}
            </span>
            <div style={{ marginLeft: 'auto' }}>
              <NotificationBell
                onUnreadChatsChange={handleUnreadChatsChange}
                onMarkChatRead={handleMarkChatReadCallback}
              />
            </div>
          </div>

          {/* Messages Area */}
          <div className={`messages ${replyingTo ? 'replying-active' : ''}`} {...getRootProps()} onClick={handleMessagesAreaClick}>
            <input {...getInputProps()} />
            {isDragActive && (
              <div className="drag-overlay">
                <div className="drag-overlay-content">
                  📎 Drop image here
                </div>
              </div>
            )}
            {messages.length === 0 ? (
              <div className="empty-state">
                <p>Welcome to the chat! Start a conversation.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSent = msg.senderId === user?.uid;
                const reactions = msg.reactions || {};
                const reactionCounts = {};
                const userReactedWith = {};

                // Count reactions
                Object.entries(reactions).forEach(([userId, emoji]) => {
                  if (!reactionCounts[emoji]) {
                    reactionCounts[emoji] = { count: 0, userIds: [] };
                  }
                  reactionCounts[emoji].count++;
                  reactionCounts[emoji].userIds.push(userId);
                  if (userId === user?.uid) {
                    userReactedWith[emoji] = true;
                  }
                });

                const isReplyTarget = replyingTo?.msgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    ref={el => messageRefs.current[msg.id] = el}
                    data-msg-id={msg.id}
                    className={`message-wrapper ${isSent ? 'sent' : 'received'} ${isReplyTarget ? 'reply-target' : ''}`}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                  >
                    {!isSent && <div className="message-sender">{msg.sender}</div>}
                    <div className="message">
                      {msg.replyTo && (
                        <div className="reply-preview" onClick={() => scrollToMessage(msg.replyTo.msgId)}>
                          <div className="reply-sender">{msg.replyTo.sender}</div>
                          <div className="reply-text">{msg.replyTo.text}</div>
                        </div>
                      )}
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="Shared image"
                          className="message-image"
                          loading="lazy"
                          onClick={() => setPreviewModalImage(msg.imageUrl)}
                        />
                      )}
                      {msg.text && (
                        <div className="text">
                          {linkifyText(msg.text)}
                          {msg.edited && <span className="edited-indicator"> (edited)</span>}
                        </div>
                      )}
                    </div>

                    {/* Quick Reactions */}
                    <div className={`quick-reactions ${isSent ? 'sent' : 'received'}`}>
                      {/* First Row: Reply + Edit (if own message) + 5 emojis */}
                      <div className="quick-reactions-row">
                        <button className="reply-btn" onClick={() => startReply(msg.id, msg.sender, msg.text)} title="Reply">
                          ↩
                        </button>
                        {isSent && (
                          <button className="edit-btn" onClick={() => startEdit(msg.id, msg.text)} title="Edit">
                            ✎
                          </button>
                        )}
                        {topReactions.slice(0, isSent ? 4 : 5).map(emoji => (
                          <span key={emoji} onClick={() => handleAddReaction(msg.id, emoji)}>
                            {emoji}
                          </span>
                        ))}
                      </div>

                      {/* Second Row: 5 emojis + More button */}
                      <div className="quick-reactions-row">
                        {topReactions.slice(isSent ? 4 : 5, 10).map(emoji => (
                          <span key={emoji} onClick={() => handleAddReaction(msg.id, emoji)}>
                            {emoji}
                          </span>
                        ))}
                        <button className="more-reactions-btn" onClick={(e) => { e.stopPropagation(); toggleEmojiPanel(msg.id); }}>
                          +
                        </button>
                      </div>
                    </div>

                    {/* Emoji Panel */}
                    {openEmojiPanel === msg.id && (
                      <div className="emoji-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="emoji-panel-title">Reactions</div>
                        <div className="emoji-grid">
                          {['👍', '👎', '❤️', '🧡', '💛', '💚', '💙', '😂', '🤣', '😊', '😍', '🥰', '😘', '🤗', '🤔', '🤯', '😱', '😮', '😢', '😭', '😤', '🔥', '💯', '💪', '👏', '🙌', '🎉', '✨', '👀', '💀', '🤡', '💩'].map(emoji => (
                            <span key={emoji} onClick={() => handleAddReaction(msg.id, emoji)}>
                              {emoji}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reactions Display */}
                    {Object.keys(reactionCounts).length > 0 && (
                      <div className="reactions-display">
                        {Object.entries(reactionCounts).map(([emoji, data]) => {
                          const reactedUsers = data.userIds.map(uid => allUsers.find(u => u.uid === uid)).filter(Boolean);

                          return (
                            <div
                              key={emoji}
                              className={`reaction-badge ${userReactedWith[emoji] ? 'mine' : ''}`}
                              onClick={() => handleAddReaction(msg.id, emoji)}
                            >
                              {emoji}
                              <span className="count">{data.count}</span>

                              {/* Reaction tooltip with user avatars */}
                              <div className="reaction-tooltip">
                                <div className="reaction-tooltip-avatars">
                                  {reactedUsers.map(user => (
                                    <img
                                      key={user.uid}
                                      src={user.photoURL || ''}
                                      alt={user.displayName}
                                      className="reaction-tooltip-avatar"
                                      title={user.displayName || user.email}
                                    />
                                  ))}
                                </div>
                                <div className="reaction-tooltip-names">
                                  {reactedUsers.map(u => u.displayName || u.email).join(', ')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Bar */}
          {replyingTo && (
            <div className="reply-bar active">
              <div className="reply-bar-content">
                <div className="reply-bar-sender">Replying to {replyingTo.sender}</div>
                <div className="reply-bar-text">{replyingTo.text.length > 50 ? replyingTo.text.substring(0, 50) + '...' : replyingTo.text}</div>
              </div>
              <button className="reply-bar-close" onClick={cancelReply}>
                ✕
              </button>
            </div>
          )}

          {/* Edit Bar */}
          {editingMessage && (
            <div className="reply-bar active" style={{ background: 'var(--bg-hover)' }}>
              <div className="reply-bar-content">
                <div className="reply-bar-sender">Editing message</div>
                <div className="reply-bar-text">{editingMessage.text.length > 50 ? editingMessage.text.substring(0, 50) + '...' : editingMessage.text}</div>
              </div>
              <button className="reply-bar-close" onClick={cancelEdit}>
                ✕
              </button>
            </div>
          )}

          {/* Input Section */}
          <div className="input-section">
            {imagePreview && (
              <div className="image-preview-container">
                <img src={imagePreview} alt="Preview" className="image-preview" />
                <button
                  onClick={handleRemoveImage}
                  className="remove-image-btn"
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            )}
            <textarea
              ref={inputRef}
              placeholder={editingMessage ? "Edit your message..." : "Type a message... (or paste/drop an image)"}
              rows="1"
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <button
              onClick={handleSend}
              disabled={sending}
            >
              {editingMessage ? '✓' : '➤'}
            </button>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { startReply(contextMenu.message.id, contextMenu.message.sender, contextMenu.message.text); setContextMenu(null); }}>
            ↩ Reply
          </button>
          {contextMenu.message.senderId === user?.uid && (
            <>
              <button onClick={() => { startEdit(contextMenu.message.id, contextMenu.message.text); setContextMenu(null); }}>
                Edit
              </button>
              <button onClick={() => { handleDeleteMessage(contextMenu.message.id); setContextMenu(null); }}>
                💀 Undo Send
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
