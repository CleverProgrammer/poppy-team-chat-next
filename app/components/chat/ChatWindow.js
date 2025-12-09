'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import Sidebar from '../layout/Sidebar';
import CommandPalette from './CommandPalette';
import NotificationBell from '../notifications/NotificationBell';
import AIModal from './AIModal';
import ImagePreviewModal from './ImagePreviewModal';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';
import { useAuth } from '../../contexts/AuthContext';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useReactions } from '../../hooks/useReactions';
import { useAI } from '../../hooks/useAI';
import { useMessageSending } from '../../hooks/useMessageSending';
import { subscribeToMessages, subscribeToMessagesDM, subscribeToUsers, getDMId, saveCurrentChat, getCurrentChat, addActiveDM, subscribeToActiveDMs, discoverExistingDMs, deleteMessage, markDMMessagesAsRead, subscribeToAIMessages, subscribeToTypingStatus } from '../../lib/firestore';

export default function ChatWindow() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [activeDMs, setActiveDMs] = useState([]);
  const [unreadChats, setUnreadChats] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [mentionMenu, setMentionMenu] = useState(null); // { type: 'mention' | 'command', position: number, query: string }
  const [mentionMenuIndex, setMentionMenuIndex] = useState(0);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [insertPosition, setInsertPosition] = useState(null); // Cursor position to insert at
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  // Image upload hook
  const {
    imagePreview,
    imageFile,
    uploading,
    setUploading,
    handleRemoveImage,
    clearImage,
    dropzoneProps
  } = useImageUpload();
  const { getRootProps, getInputProps, isDragActive } = dropzoneProps;

  // Reactions hook
  const {
    topReactions,
    openEmojiPanel,
    handleAddReaction,
    toggleEmojiPanel,
    setOpenEmojiPanel
  } = useReactions(user, currentChat);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // AI hook (must be after messagesEndRef is defined)
  const {
    aiProcessing,
    askPoppy,
    askPoppyDirectly
  } = useAI(user, currentChat, messages, setMessages, messagesEndRef);

  // Message sending hook
  const {
    sending,
    handleSend,
    handleEdit,
    updateTypingIndicator,
    clearTypingIndicator,
    typingTimeoutRef
  } = useMessageSending({
    user,
    currentChat,
    inputRef,
    messagesEndRef,
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
  });

  const markChatAsReadRef = useRef(null);
  const messageRefs = useRef({});
  const previousMessagesRef = useRef([]);
  const soundRef = useRef(null);

  // Load saved chat on mount
  useEffect(() => {
    if (!user) return;

    // Load saved chat or default to general channel
    getCurrentChat(user.uid).then((savedChat) => {
      console.log('📌 Loaded saved chat from Firestore:', savedChat);
      if (savedChat) {
        setCurrentChat(savedChat);
        // If it's a DM, add to active DMs
        if (savedChat.type === 'dm') {
          addActiveDM(user.uid, savedChat.id);
        }
      } else {
        // Default to general channel if no saved chat
        console.log('📌 No saved chat found, defaulting to general');
        setCurrentChat({ type: 'channel', id: 'general', name: 'general' });
      }
    });
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
    if (!currentChat || !user) return;

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
    } else if (currentChat.type === 'ai') {
      // Subscribe to AI chat messages from Firestore
      unsubscribe = subscribeToAIMessages(user.uid, (newMessages) => {
        setMessages(newMessages);
      });
    }

    return () => unsubscribe?.();
  }, [currentChat, user]);

  // Subscribe to typing status (DMs only)
  useEffect(() => {
    if (!currentChat || !user || currentChat.type !== 'dm') {
      setOtherUserTyping(false);
      return;
    }

    const dmId = getDMId(user.uid, currentChat.id);
    const unsubscribe = subscribeToTypingStatus(dmId, currentChat.id, (isTyping) => {
      setOtherUserTyping(isTyping);
    });

    return () => unsubscribe();
  }, [currentChat, user]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  // Sound notifications - only play when tab is hidden and it's a DM
  useEffect(() => {
    if (!user || !currentChat || messages.length === 0) return;

    // Find new messages (messages that weren't in previousMessagesRef)
    const previousMessageIds = new Set(previousMessagesRef.current.map(m => m.id));
    const newMessages = messages.filter(msg => !previousMessageIds.has(msg.id));

    // Update ref for next comparison
    previousMessagesRef.current = messages;

    // Check if tab is hidden using Page Visibility API
    const isTabHidden = document.hidden;

    // Check each new message
    newMessages.forEach(msg => {
      // Don't play sound for your own messages
      if (msg.senderId === user.uid) return;

      // Don't play sound for optimistic or typing messages
      if (msg.optimistic || msg.isTyping) return;

      // Only play if tab is hidden
      if (!isTabHidden) return;

      // Only play sound for DMs
      const isDM = currentChat.type === 'dm';

      if (isDM) {
        // Initialize sound on-demand if not already loaded
        if (!soundRef.current) {
          soundRef.current = new Howl({
            src: ['/sounds/knock_sound.mp3'],
            volume: 0.5
          });
        }
        // Play knock sound
        soundRef.current.play();
      }
    });
  }, [messages, user, currentChat]);

  // Auto-focus input when switching chats
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentChat]);

  // Mark DM messages as read when viewing them
  useEffect(() => {
    if (!user || !currentChat || currentChat.type !== 'dm' || messages.length === 0) return;

    // Find unread messages (messages from the other person that haven't been read by me)
    const unreadMessages = messages.filter(msg =>
      msg.senderId !== user.uid &&
      (!msg.readBy || !msg.readBy[user.uid])
    );

    if (unreadMessages.length > 0) {
      const dmId = getDMId(user.uid, currentChat.id);
      const messageIds = unreadMessages.map(msg => msg.id);

      // Mark as read after a short delay to simulate reading
      const timer = setTimeout(() => {
        markDMMessagesAsRead(dmId, user.uid, messageIds);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [messages, user, currentChat]);

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

  const handleKeyDown = (e) => {
    // Handle mention menu navigation
    if (mentionMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const items = getMentionMenuItems();
        setMentionMenuIndex(prev => (prev + 1) % items.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const items = getMentionMenuItems();
        setMentionMenuIndex(prev => (prev - 1 + items.length) % items.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const items = getMentionMenuItems();
        if (items[mentionMenuIndex]) {
          selectMentionItem(items[mentionMenuIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionMenu(null);
        return;
      }
    }

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

    const value = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Update typing indicator (DMs only)
    updateTypingIndicator();

    // Check for / command at start of input
    if (value.startsWith('/')) {
      const query = value.substring(1, cursorPos);
      // Only show command picker if no space yet (still typing command name)
      if (!query.includes(' ')) {
        setMentionMenu({
          type: 'command',
          position: 0,
          query: query.toLowerCase()
        });
        setMentionMenuIndex(0);
        return;
      }
    }

    // Find @ before cursor (look backwards from cursor)
    let atPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (value[i] === '@') {
        atPos = i;
        break;
      }
      // Stop if we hit a space or newline (@ mention can't span these)
      if (value[i] === ' ' || value[i] === '\n') {
        break;
      }
    }

    if (atPos !== -1) {
      // Get text between @ and cursor
      const query = value.substring(atPos + 1, cursorPos);
      // Only show if no space in query
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionMenu({
          type: 'mention',
          position: atPos,
          query: query.toLowerCase()
        });
        setMentionMenuIndex(0);
        return;
      }
    }

    // Close menu if no match
    setMentionMenu(null);
  }, [updateTypingIndicator]);

  const getMentionMenuItems = useCallback(() => {
    if (!mentionMenu) return [];

    // For commands, show /ai
    if (mentionMenu.type === 'command') {
      if ('ai'.includes(mentionMenu.query)) {
        return [{ type: 'ai-command', name: '/ai', description: 'Ask Poppy AI anything' }];
      }
      return [];
    }

    // For mentions, filter ALL items including Poppy based on query
    const items = [];

    // Only show Poppy if query matches
    if (!mentionMenu.query || 'poppy'.includes(mentionMenu.query)) {
      items.push({ type: 'ai', name: '🤖 Poppy', uid: 'poppy-ai', description: 'AI Assistant' });
    }

    // Add users that match the query
    const filteredUsers = allUsers.filter(u =>
      u.uid !== user?.uid &&
      (u.displayName?.toLowerCase().includes(mentionMenu.query) ||
       u.email?.toLowerCase().includes(mentionMenu.query))
    );

    filteredUsers.forEach(u => {
      items.push({
        type: 'user',
        name: u.displayName || u.email,
        uid: u.uid,
        photoURL: u.photoURL,
        description: u.email // Show email to distinguish users with same names
      });
    });

    return items;
  }, [mentionMenu, allUsers, user]);

  const selectMentionItem = useCallback((item) => {
    if (!mentionMenu || !inputRef.current) return;

    const textarea = inputRef.current;
    const value = textarea.value;
    const { position } = mentionMenu;

    // If it's /ai command, open the AI modal
    if (item.type === 'ai-command') {
      setMentionMenu(null);
      // Save position where /ai was
      setInsertPosition(position);
      // Clear the /ai from input
      textarea.value = value.substring(position + item.name.length).trim();
      // Open modal
      openAiModal();
      return;
    }

    // Replace @query with @name
    const beforeMention = value.substring(0, position);
    const afterCursor = value.substring(textarea.selectionStart);
    const mentionText = item.type === 'ai' ? '@poppy ' : `@${item.name} `;

    textarea.value = beforeMention + mentionText + afterCursor;
    const newCursorPos = position + mentionText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);

    setMentionMenu(null);
    textarea.focus();

    // Trigger change to update height
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
  }, [mentionMenu]);

  // AI Modal Functions
  const openAiModal = () => {
    setAiModalOpen(true);
  };

  const closeAiModal = () => {
    setAiModalOpen(false);
    inputRef.current?.focus();
  };

  const handleInsertAiResponse = (text, position) => {
    if (!inputRef.current) return;

    const textarea = inputRef.current;
    const value = textarea.value;
    const pos = position !== null ? position : value.length;

    // Insert AI response at the saved position
    const before = value.substring(0, pos);
    const after = value.substring(pos);
    textarea.value = before + text + after;

    // Set cursor after inserted text
    const newPos = pos + text.length;
    textarea.setSelectionRange(newPos, newPos);

    // Trigger input event to update height
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
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
      console.log('📌 Saving chat to Firestore:', chat);
      saveCurrentChat(user.uid, chat);
    }
  };

  const handleUnreadChatsChange = (newUnreadChats) => {
    setUnreadChats(newUnreadChats);
  };

  const handleMarkChatReadCallback = (markReadFn) => {
    markChatAsReadRef.current = markReadFn;
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

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Show loading state while currentChat is being loaded
  if (!currentChat) {
    return <div className="loading-state">Loading...</div>;
  }

  return (
    <>
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        allUsers={allUsers}
        onSelectChat={handleSelectChat}
      />

      {/* Image Preview Modal */}
      <ImagePreviewModal
        imageUrl={previewModalImage}
        onClose={() => setPreviewModalImage(null)}
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
              {currentChat.type === 'channel' ? '#' : currentChat.type === 'ai' ? '🤖' : '💬'}
            </span>
            <h1>{currentChat.name}</h1>
            <span className="chat-header-subtitle">
              {currentChat.type === 'channel' ? 'Team chat' : currentChat.type === 'ai' ? 'AI Assistant' : 'Direct message'}
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
              messages.map((msg, index) => (
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  index={index}
                  messages={messages}
                  totalMessages={messages.length}
                  user={user}
                  currentChat={currentChat}
                  allUsers={allUsers}
                  replyingTo={replyingTo}
                  topReactions={topReactions}
                  openEmojiPanel={openEmojiPanel}
                  onReply={startReply}
                  onEdit={startEdit}
                  onAddReaction={handleAddReaction}
                  onToggleEmojiPanel={toggleEmojiPanel}
                  onImageClick={setPreviewModalImage}
                  onScrollToMessage={scrollToMessage}
                  onContextMenu={handleContextMenu}
                  messageRef={el => messageRefs.current[msg.id] = el}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing indicator */}
          {otherUserTyping && currentChat?.type === 'dm' && (
            <div className="typing-indicator">
              <img
                src={currentChat.user?.photoURL || ''}
                alt={currentChat.user?.displayName || 'User'}
                className="typing-avatar"
              />
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          {/* AI Chat Modal */}
          <AIModal
            isOpen={aiModalOpen}
            onClose={closeAiModal}
            onInsert={handleInsertAiResponse}
            insertPosition={insertPosition}
          />

          <ChatInput
            inputRef={inputRef}
            editingMessage={editingMessage}
            replyingTo={replyingTo}
            sending={sending}
            imagePreview={imagePreview}
            mentionMenu={mentionMenu}
            mentionMenuIndex={mentionMenuIndex}
            handleTextareaChange={handleTextareaChange}
            handleKeyDown={handleKeyDown}
            handleSend={handleSend}
            handleRemoveImage={handleRemoveImage}
            cancelEdit={cancelEdit}
            cancelReply={cancelReply}
            getMentionMenuItems={getMentionMenuItems}
            selectMentionItem={selectMentionItem}
            setMentionMenuIndex={setMentionMenuIndex}
          />
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
