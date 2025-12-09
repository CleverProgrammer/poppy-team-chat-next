'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '../layout/Sidebar';
import CommandPalette from './CommandPalette';
import AIModal from './AIModal';
import ImagePreviewModal from './ImagePreviewModal';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';
import ChatHeader from './ChatHeader';
import ContextMenu from './ContextMenu';
import { useAuth } from '../../contexts/AuthContext';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useReactions } from '../../hooks/useReactions';
import { useAI } from '../../hooks/useAI';
import { useMessageSending } from '../../hooks/useMessageSending';
import { useMentionMenu } from '../../hooks/useMentionMenu';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { getDMId, saveCurrentChat, deleteMessage, addActiveDM } from '../../lib/firestore';

export default function ChatWindow() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [insertPosition, setInsertPosition] = useState(null);

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

  // Subscriptions hook (handles all Firebase subscriptions) - must be early for allUsers
  const {
    allUsers,
    activeDMs,
    otherUserTyping
  } = useSubscriptions({
    user,
    currentChat,
    setCurrentChat,
    setMessages,
    messagesEndRef,
    inputRef
  });

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

  // AI Modal helper (needed by useMentionMenu)
  const openAiModal = () => setAiModalOpen(true);

  // Mention menu hook
  const {
    mentionMenu,
    mentionMenuIndex,
    setMentionMenuIndex,
    handleTextareaChange,
    getMentionMenuItems,
    selectMentionItem,
    handleMentionKeyDown
  } = useMentionMenu({
    inputRef,
    allUsers,
    user,
    updateTypingIndicator,
    setInsertPosition,
    openAiModal
  });

  const markChatAsReadRef = useRef(null);
  const messageRefs = useRef({});

  const handleKeyDown = (e) => {
    // Let mention menu handle its keys first
    if (handleMentionKeyDown(e)) return;

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

  // Global keyboard shortcuts (must be after startReply, startEdit, cancelReply are defined)
  useKeyboardShortcuts({
    user,
    messages,
    previewModalImage,
    setPreviewModalImage,
    replyingTo,
    editingMessage,
    isPaletteOpen,
    setIsPaletteOpen,
    startReply,
    startEdit,
    cancelReply
  });

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
          <ChatHeader
            currentChat={currentChat}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            onUnreadChatsChange={handleUnreadChatsChange}
            onMarkChatRead={handleMarkChatReadCallback}
          />

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

      <ContextMenu
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        user={user}
        onReply={startReply}
        onEdit={startEdit}
        onDelete={handleDeleteMessage}
      />
    </>
  );
}
