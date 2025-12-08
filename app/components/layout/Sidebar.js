'use client';

import { useAuth } from '../../contexts/AuthContext';
import SignOutButton from '../auth/SignOutButton';

export default function Sidebar({ currentChat, onSelectChat, activeDMs = [], allUsers = [] }) {
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
    <div className="sidebar">
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
