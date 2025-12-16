'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function CommandPalette({ isOpen, onClose, allUsers, onSelectChat }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredItems, setFilteredItems] = useState([]);
  const inputRef = useRef(null);

  const CHANNELS = [
    { type: 'channel', id: 'general', name: 'general', hint: 'Team chat' },
    { type: 'channel', id: 'test', name: 'test', hint: 'Testing & experiments' }
  ];

  const AI_ASSISTANT = [
    { type: 'ai', id: 'poppy-ai', name: 'Poppy AI', hint: 'Chat with AI assistant' }
  ];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const searchQuery = query.toLowerCase();
    let items = [];

    // Filter AI Assistant
    const matchingAI = AI_ASSISTANT.filter(a =>
      a.name.toLowerCase().includes(searchQuery) ||
      a.hint.toLowerCase().includes(searchQuery) ||
      'ai'.includes(searchQuery) ||
      'poppy'.includes(searchQuery)
    );
    items.push(...matchingAI.map(a => ({ ...a, type: 'ai' })));

    // Filter channels
    const matchingChannels = CHANNELS.filter(c =>
      c.name.toLowerCase().includes(searchQuery)
    );
    items.push(...matchingChannels.map(c => ({ ...c, type: 'channel' })));

    // Filter all users (for DMs)
    const matchingUsers = allUsers.filter(u =>
      (u.displayName?.toLowerCase().includes(searchQuery) ||
       u.email?.toLowerCase().includes(searchQuery)) &&
      u.uid !== user?.uid
    );
    items.push(...matchingUsers.map(u => ({ type: 'user', user: u })));

    setFilteredItems(items);
    setSelectedIndex(0);
  }, [query, allUsers, user, isOpen]);

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (item) => {
    if (item.type === 'channel') {
      onSelectChat({ type: 'channel', id: item.id, name: item.name });
    } else if (item.type === 'ai') {
      onSelectChat({ type: 'ai', id: item.id, name: item.name });
    } else if (item.type === 'user') {
      onSelectChat({ type: 'dm', id: item.user.uid, name: item.user.displayName || item.user.email, user: item.user });
    }
    onClose();
  };

  if (!isOpen) return null;

  const aiItems = filteredItems.filter(i => i.type === 'ai');
  const channels = filteredItems.filter(i => i.type === 'channel');
  const users = filteredItems.filter(i => i.type === 'user');

  return (
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="cmd-palette-input"
          placeholder="Search channels and people..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          name="cmd-palette-search"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
        />
        <div className="cmd-palette-results">
          {filteredItems.length === 0 ? (
            <div className="cmd-palette-empty">
              {query ? 'No results found' : 'Start typing to search...'}
            </div>
          ) : (
            <>
              {aiItems.length > 0 && (
                <div className="cmd-palette-section">
                  <div className="cmd-palette-section-title">AI Assistant</div>
                  {aiItems.map((item) => {
                    const globalIdx = filteredItems.indexOf(item);
                    return (
                      <div
                        key={`ai-${item.id}`}
                        className={`cmd-palette-item ${globalIdx === selectedIndex ? 'selected' : ''}`}
                        onClick={() => handleSelect(item)}
                      >
                        <div className="cmd-palette-item-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: '50%' }}>🤖</div>
                        <div className="cmd-palette-item-info">
                          <div className="cmd-palette-item-name">{item.name}</div>
                          <div className="cmd-palette-item-hint">{item.hint}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {channels.length > 0 && (
                <div className="cmd-palette-section">
                  <div className="cmd-palette-section-title">Channels</div>
                  {channels.map((item, idx) => {
                    const globalIdx = filteredItems.indexOf(item);
                    return (
                      <div
                        key={`channel-${item.id}`}
                        className={`cmd-palette-item ${globalIdx === selectedIndex ? 'selected' : ''}`}
                        onClick={() => handleSelect(item)}
                      >
                        <div className="cmd-palette-item-icon">#</div>
                        <div className="cmd-palette-item-info">
                          <div className="cmd-palette-item-name">{item.name}</div>
                          <div className="cmd-palette-item-hint">{item.hint}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {users.length > 0 && (
                <div className="cmd-palette-section">
                  <div className="cmd-palette-section-title">Direct Messages</div>
                  {users.map((item) => {
                    const globalIdx = filteredItems.indexOf(item);
                    return (
                      <div
                        key={`user-${item.user.uid}`}
                        className={`cmd-palette-item ${globalIdx === selectedIndex ? 'selected' : ''}`}
                        onClick={() => handleSelect(item)}
                      >
                        {item.user.photoURL && <img src={item.user.photoURL} alt={item.user.displayName} />}
                        <div className="cmd-palette-item-info">
                          <div className="cmd-palette-item-name">{item.user.displayName || item.user.email}</div>
                          <div className="cmd-palette-item-hint">{item.user.email}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
