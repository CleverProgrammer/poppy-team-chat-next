'use client';

import NotificationBell from '../notifications/NotificationBell';

export default function ChatHeader({
  currentChat,
  isSidebarOpen,
  setIsSidebarOpen,
  onUnreadChatsChange,
  onMarkChatRead
}) {
  const getIcon = () => {
    if (currentChat.type === 'channel') return '#';
    if (currentChat.type === 'ai') return '🤖';
    return '💬';
  };

  const getSubtitle = () => {
    if (currentChat.type === 'channel') return 'Team chat';
    if (currentChat.type === 'ai') return 'AI Assistant';
    return 'Direct message';
  };

  return (
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
      <span className="chat-header-icon">{getIcon()}</span>
      <h1>{currentChat.name}</h1>
      <span className="chat-header-subtitle">{getSubtitle()}</span>
      <div style={{ marginLeft: 'auto' }}>
        <NotificationBell
          onUnreadChatsChange={onUnreadChatsChange}
          onMarkChatRead={onMarkChatRead}
        />
      </div>
    </div>
  );
}
