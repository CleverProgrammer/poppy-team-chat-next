'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '../layout/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { sendMessage, subscribeToMessages } from '../../lib/firestore';

export default function ChatWindow() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Subscribe to messages
  useEffect(() => {
    const unsubscribe = subscribeToMessages('general', (newMessages) => {
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, []);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage('general', user, messageText);
      setMessageText('');
    } catch (error) {
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar />

      {/* Chat Container */}
      <div className="chat-container">
        {/* Chat Header */}
        <div className="chat-header">
          <span className="chat-header-icon">#</span>
          <h1>general</h1>
          <span className="chat-header-subtitle">Team chat</span>
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
            placeholder="Type a message..."
            rows="1"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button onClick={handleSend} disabled={sending || !messageText.trim()}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
