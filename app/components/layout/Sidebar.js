'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SignOutButton from '../auth/SignOutButton';

export default function Sidebar({ currentChat, onSelectChat, activeDMs = [], allUsers = [], unreadChats = [], isOpen = false }) {
  const { user, setPasswordForAccount } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSetPassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setSettingPassword(true);
    try {
      await setPasswordForAccount(password);
      setPasswordSuccess('Password set! You can now log in with email & password.');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      if (error.code === 'auth/provider-already-linked') {
        setPasswordError('You already have a password set for this account');
      } else {
        setPasswordError(error.message || 'Failed to set password');
      }
    } finally {
      setSettingPassword(false);
    }
  };

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
                {dmUser.photoURL && <img src={dmUser.photoURL} alt={dmUser.displayName} />}
                <span>{dmUser.displayName || dmUser.email}</span>
                {unreadChats.includes(`dm:${dmUserId}`) && <div className="unread-badge" />}
              </div>
            );
          })}
        </div>
      )}

      {/* User Panel */}
      <div className="user-panel" ref={menuRef}>
        <div
          className="user-panel-clickable"
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          {user?.photoURL && <img src={user.photoURL} alt="Profile" />}
          <div className="user-panel-info">
            <div className="user-panel-name">{user?.displayName || user?.email}</div>
            <div className="user-panel-status">Online</div>
          </div>
        </div>

        {/* User Menu Dropdown */}
        {showUserMenu && (
          <div className="user-menu">
            <button
              className="user-menu-item"
              onClick={() => {
                setShowPasswordModal(true);
                setShowUserMenu(false);
              }}
            >
              Set Password
            </button>
            <SignOutButton />
          </div>
        )}

        {!showUserMenu && <SignOutButton />}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Set Password for Email Login</h3>
            <p className="modal-description">
              Set a password to log in with your email ({user?.email}) on any device.
            </p>
            <input
              type="password"
              placeholder="New password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="modal-input"
              disabled={settingPassword}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="modal-input"
              disabled={settingPassword}
            />
            {passwordError && <p className="modal-error">{passwordError}</p>}
            {passwordSuccess && <p className="modal-success">{passwordSuccess}</p>}
            <div className="modal-buttons">
              <button
                className="modal-btn cancel"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setConfirmPassword('');
                  setPasswordError('');
                }}
                disabled={settingPassword}
              >
                Cancel
              </button>
              <button
                className="modal-btn confirm"
                onClick={handleSetPassword}
                disabled={settingPassword}
              >
                {settingPassword ? 'Setting...' : 'Set Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
