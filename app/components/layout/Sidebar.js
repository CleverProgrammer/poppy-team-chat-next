'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SignOutButton from '../auth/SignOutButton';
import { useDocuments } from '../../hooks/useDocuments';
import DocumentList from '../documents/DocumentList';

export default function Sidebar({ currentChat, onSelectChat, activeDMs = [], allUsers = [], unreadChats = [], isOpen = false }) {
  const { user } = useAuth();
  const [showDocuments, setShowDocuments] = useState(false);
  const {
    documents,
    loading: docsLoading,
    error: docsError,
    uploading,
    uploadDocument,
    deleteDocument,
    getStatusCounts
  } = useDocuments();

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

  const statusCounts = getStatusCounts();

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

      {/* Documents Section */}
      <div className="sidebar-section">
        <div
          className="sidebar-section-title"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowDocuments(true)}
        >
          <span>Documents</span>
          <span style={{
            fontSize: '12px',
            padding: '2px 6px',
            background: statusCounts.total > 0 ? '#3b82f6' : '#4b5563',
            borderRadius: '10px',
            color: '#fff'
          }}>
            {statusCounts.total}
          </span>
        </div>
        <div
          className="channel-item"
          onClick={() => setShowDocuments(true)}
          style={{ cursor: 'pointer' }}
        >
          <span style={{ fontSize: '16px', marginRight: '4px' }}>📁</span>
          <span>Knowledge Base</span>
          {statusCounts.processing > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#fbbf24' }}>
              ⏳ {statusCounts.processing}
            </span>
          )}
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

      {/* Documents Panel Modal */}
      {showDocuments && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-2xl h-[80vh] shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Knowledge Base</h3>
              <button
                onClick={() => setShowDocuments(false)}
                className="text-gray-400 hover:text-white transition-colors text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DocumentList
                documents={documents}
                loading={docsLoading}
                error={docsError}
                onUpload={uploadDocument}
                onDelete={deleteDocument}
                uploading={uploading}
                user={user}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
