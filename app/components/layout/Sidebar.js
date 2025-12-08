'use client';

import { useAuth } from '../../contexts/AuthContext';
import SignOutButton from '../auth/SignOutButton';

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <div className="sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <h2>Poppy Chat</h2>
      </div>

      {/* Channels Section */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Channels</div>
        <div className="channel-item active">
          <span className="hash">#</span>
          <span>general</span>
        </div>
        <div className="channel-item">
          <span className="hash">#</span>
          <span>random</span>
        </div>
        <div className="channel-item">
          <span className="hash">#</span>
          <span>dev-team</span>
        </div>
      </div>

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
