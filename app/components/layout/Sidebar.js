'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SignOutButton from '../auth/SignOutButton';

export default function Sidebar({ currentChat, onSelectChat, activeDMs = [], allUsers = [], unreadChats = [], isOpen = false }) {
  const { user } = useAuth();

  const handleChannelClick = (channelId) => {
    onSelectChat({ type: 'channel', id: channelId, name: channelId });
  };

  const handleDMClick = (dmUser) => {
    onSelectChat({
      type: 'dm',
      id: dmUser.uid,
      name: dmUser.displayName || dmUser.email,
      user: dmUser
    });
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <h2>Poppy Chat</h2>
      </div>

      {/* Channels Section */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Channels</div>
        <div
          className={`channel-item ${currentChat?.type === 'channel' && currentChat?.id === 'general' ? 'active' : ''}`}
          onClick={() => handleChannelClick('general')}
        >
          <span className="hash">#</span>
          <span>general</span>
          {unreadChats.includes('channel:general') && <div className="unread-badge" />}
        </div>
        <div
          className={`channel-item ${currentChat?.type === 'channel' && currentChat?.id === 'test' ? 'active' : ''}`}
          onClick={() => handleChannelClick('test')}
        >
          <span className="hash">#</span>
          <span>test</span>
          {unreadChats.includes('channel:test') && <div className="unread-badge" />}
        </div>
      </div>

      {/* Poppy AI Chat Section */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">AI Assistant</div>
        <div
          className={`dm-item ${currentChat?.type === 'ai' ? 'active' : ''}`}
          onClick={() => onSelectChat({ type: 'ai', id: 'poppy-ai', name: '🤖 Poppy AI' })}
        >
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            🤖
          </div>
          <span>Poppy AI</span>
          {unreadChats.includes('ai:poppy-ai') && <div className="unread-badge" />}
        </div>
      </div>

      {/* Direct Messages Section */}
      {activeDMs.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-title">Direct Messages</div>
          {activeDMs.map((dmUserId) => {
            const dmUser = allUsers.find(u => u.uid === dmUserId);
            if (!dmUser) return null;

            const isActive = currentChat?.type === 'dm' && currentChat?.id === dmUserId;
            return (
              <div
                key={dmUserId}
                className={`dm-item ${isActive ? 'active' : ''}`}
                onClick={() => handleDMClick(dmUser)}
              >
                <img src={dmUser.photoURL || ''} alt={dmUser.displayName} />
                <span>{dmUser.displayName || dmUser.email}</span>
                {unreadChats.includes(`dm:${dmUserId}`) && <div className="unread-badge" />}
              </div>
            );
          })}
        </div>
      )}

      {/* User Panel */}
      <div className="user-panel">
        <img src={user?.photoURL || ''} alt="Profile" />
        <div className="user-panel-info">
          <div className="user-panel-name">{user?.displayName || user?.email}</div>
          <div className="user-panel-status">Online</div>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
