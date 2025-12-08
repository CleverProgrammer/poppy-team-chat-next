'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '../layout/Sidebar';
import CommandPalette from './CommandPalette';
import { useAuth } from '../../contexts/AuthContext';
import { sendMessage, sendMessageDM, subscribeToMessages, subscribeToMessagesDM, subscribeToUsers, getDMId, saveCurrentChat, getCurrentChat, addActiveDM, subscribeToActiveDMs } from '../../lib/firestore';

export default function ChatWindow() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [currentChat, setCurrentChat] = useState({ type: 'channel', id: 'general', name: 'general' });
  const [allUsers, setAllUsers] = useState([]);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [activeDMs, setActiveDMs] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;

    setSending(true);
    try {
      if (currentChat.type === 'channel') {
        await sendMessage(currentChat.id, user, messageText);
      } else {
        const dmId = getDMId(user.uid, currentChat.id);
        await sendMessageDM(dmId, user, messageText, currentChat.id);
      }
      setMessageText('');
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    } catch (error) {
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
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
    // Add to active DMs if it's a DM
    if (chat.type === 'dm' && user) {
      addActiveDM(user.uid, chat.id);
    }
    // Save current chat to Firestore
    if (user) {
      saveCurrentChat(user.uid, chat);
    }
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
        {/* Sidebar */}
        <Sidebar
          currentChat={currentChat}
          onSelectChat={handleSelectChat}
          activeDMs={activeDMs}
          allUsers={allUsers}
        />

        {/* Chat Container */}
        <div className="chat-container">
          {/* Chat Header */}
          <div className="chat-header">
            <span className="chat-header-icon">
              {currentChat.type === 'channel' ? '#' : '💬'}
            </span>
            <h1>{currentChat.name}</h1>
            <span className="chat-header-subtitle">
              {currentChat.type === 'channel' ? 'Team chat' : 'Direct message'}
            </span>
          </div>

          {/* Messages Area */}
          <div className="messages">
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
                      <div className="text">{msg.text}</div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Section */}
          <div className="input-section">
            <textarea
              ref={inputRef}
              placeholder="Type a message..."
              rows="1"
              value={messageText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
            />
            <button onClick={handleSend} disabled={sending || !messageText.trim()}>
              ➤
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
