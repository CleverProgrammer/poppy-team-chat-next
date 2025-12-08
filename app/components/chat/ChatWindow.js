'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Sidebar from '../layout/Sidebar';
import CommandPalette from './CommandPalette';
import NotificationBell from '../notifications/NotificationBell';
import { useAuth } from '../../contexts/AuthContext';
import { sendMessage, sendMessageDM, subscribeToMessages, subscribeToMessagesDM, subscribeToUsers, getDMId, saveCurrentChat, getCurrentChat, addActiveDM, subscribeToActiveDMs, discoverExistingDMs, uploadImage, sendMessageWithImage, sendMessageDMWithImage } from '../../lib/firestore';

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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const markChatAsReadRef = useRef(null);

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

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    if ((!messageText.trim() && !imageFile) || sending || uploading) return;

    setSending(true);
    try {
      let imageUrl = null;

      // Upload image if present
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadImage(imageFile, user.uid);
        setUploading(false);
      }

      if (currentChat.type === 'channel') {
        if (imageUrl) {
          await sendMessageWithImage(currentChat.id, user, imageUrl, messageText);
        } else {
          await sendMessage(currentChat.id, user, messageText);
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
        if (imageUrl) {
          await sendMessageDMWithImage(dmId, user, imageUrl, currentChat.id, messageText);
        } else {
          await sendMessageDM(dmId, user, messageText, currentChat.id);
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

      setMessageText('');
      setImageFile(null);
      setImagePreview(null);

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending message:', error);
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
  };

  const handleTextareaChange = (e) => {
    setMessageText(e.target.value);

    // Auto-expand textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

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

  return (
    <>
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        allUsers={allUsers}
        onSelectChat={handleSelectChat}
      />

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
          <div className="messages" {...getRootProps()}>
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
                return (
                  <div key={msg.id} className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
                    {!isSent && <div className="message-sender">{msg.sender}</div>}
                    <div className="message">
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="Shared image"
                          className="message-image"
                          loading="lazy"
                        />
                      )}
                      {msg.text && <div className="text">{linkifyText(msg.text)}</div>}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

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
            <div className="input-row">
              <label className="image-upload-btn" title="Upload image">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelect(file);
                  }}
                  style={{ display: 'none' }}
                />
                📎
              </label>
              <textarea
                ref={inputRef}
                placeholder="Type a message... (or paste/drop an image)"
                rows="1"
                value={messageText}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <button
                onClick={handleSend}
                disabled={sending || uploading || (!messageText.trim() && !imageFile)}
              >
                {uploading ? '⏳' : '➤'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
