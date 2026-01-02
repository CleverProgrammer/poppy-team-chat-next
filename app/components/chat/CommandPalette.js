'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Frecency from 'frecency/dist/browser/index.js';

// Create frecency instance for command palette - persists to localStorage
const createFrecency = () => {
  if (typeof window === 'undefined') return null;
  return new Frecency({
    key: 'poppy_command_palette_frecency',
    idAttribute: '_frecencyId',
  });
};

export default function CommandPalette({ isOpen, onClose, allUsers, groups = [], onSelectChat }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredItems, setFilteredItems] = useState([]);
  const inputRef = useRef(null);
  
  // Initialize frecency instance (memoized to avoid recreating)
  const frecency = useMemo(() => createFrecency(), []);

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
      // Use requestAnimationFrame for immediate focus without delay
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const searchQuery = query.toLowerCase();
    let items = [];

    // Filter AI Assistant - add unique _frecencyId for tracking
    const matchingAI = AI_ASSISTANT.filter(a =>
      a.name.toLowerCase().includes(searchQuery) ||
      a.hint.toLowerCase().includes(searchQuery) ||
      'ai'.includes(searchQuery) ||
      'poppy'.includes(searchQuery)
    );
    items.push(...matchingAI.map(a => ({ 
      ...a, 
      type: 'ai',
      _frecencyId: `ai:${a.id}` 
    })));

    // Filter channels - add unique _frecencyId for tracking
    const matchingChannels = CHANNELS.filter(c =>
      c.name.toLowerCase().includes(searchQuery)
    );
    items.push(...matchingChannels.map(c => ({ 
      ...c, 
      type: 'channel',
      _frecencyId: `channel:${c.id}` 
    })));

    // Filter groups - only by custom group name, not auto-generated member names
    const matchingGroups = (groups || []).filter(g => {
      // Only match if group has a custom name set (g.name), ignore auto-generated displayName
      if (!g.name) return false;
      return g.name.toLowerCase().includes(searchQuery);
    });
    items.push(...matchingGroups.map(g => ({ 
      type: 'group', 
      id: g.id, 
      name: g.name || g.displayName || g.memberNames?.join(', ') || 'Group Chat',
      group: g,
      hint: `${g.memberCount || g.memberNames?.length || 0} members`,
      _frecencyId: `group:${g.id}`
    })));

    // Filter all users (for DMs) - search by name only, not email
    const matchingUsers = allUsers.filter(u =>
      u.displayName?.toLowerCase().includes(searchQuery) &&
      u.uid !== user?.uid
    );
    items.push(...matchingUsers.map(u => ({ 
      type: 'user', 
      user: u,
      _frecencyId: `user:${u.uid}`
    })));

    // Sort items by frecency (most frequently/recently used first)
    if (frecency && items.length > 0) {
      items = frecency.sort({
        searchQuery: searchQuery,
        results: items
      });
    }

    setFilteredItems(items);
    setSelectedIndex(0);
  }, [query, allUsers, groups, user, isOpen, frecency]);

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && !e.nativeEvent?.isComposing && !e.isComposing) {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (item) => {
    // Record selection for frecency ranking (learns from usage)
    if (frecency && item._frecencyId) {
      frecency.save({
        searchQuery: query.toLowerCase(),
        selectedId: item._frecencyId
      });
    }
    
    if (item.type === 'channel') {
      onSelectChat({ type: 'channel', id: item.id, name: item.name });
    } else if (item.type === 'ai') {
      onSelectChat({ type: 'ai', id: item.id, name: item.name });
    } else if (item.type === 'group') {
      onSelectChat({ type: 'group', id: item.id, name: item.name, group: item.group });
    } else if (item.type === 'user') {
      onSelectChat({ type: 'dm', id: item.user.uid, name: item.user.displayName || item.user.email, user: item.user });
    }
    onClose();
  };

  if (!isOpen) return null;

  // Helper to render a single item regardless of type
  const renderItem = (item, idx) => {
    if (item.type === 'ai') {
      return (
        <div
          key={`ai-${item.id}`}
          className={`cmd-palette-item ${idx === selectedIndex ? 'selected' : ''}`}
          onClick={() => handleSelect(item)}
        >
          <img src="/poppy-icon.png" alt="Poppy" className="cmd-palette-item-icon" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          <div className="cmd-palette-item-info">
            <div className="cmd-palette-item-name">{item.name}</div>
            <div className="cmd-palette-item-hint">{item.hint}</div>
          </div>
        </div>
      );
    } else if (item.type === 'channel') {
      return (
        <div
          key={`channel-${item.id}`}
          className={`cmd-palette-item ${idx === selectedIndex ? 'selected' : ''}`}
          onClick={() => handleSelect(item)}
        >
          <div className="cmd-palette-item-icon">#</div>
          <div className="cmd-palette-item-info">
            <div className="cmd-palette-item-name">{item.name}</div>
            <div className="cmd-palette-item-hint">{item.hint}</div>
          </div>
        </div>
      );
    } else if (item.type === 'group') {
      const group = item.group;
      const hasPhoto = group?.photoURL && group.photoURL.length > 4;
      const hasEmoji = group?.photoURL && group.photoURL.length <= 4;
      return (
        <div
          key={`group-${item.id}`}
          className={`cmd-palette-item ${idx === selectedIndex ? 'selected' : ''}`}
          onClick={() => handleSelect(item)}
        >
          {hasPhoto ? (
            <img src={group.photoURL} alt={item.name} className="cmd-palette-item-avatar" />
          ) : hasEmoji ? (
            <div className="cmd-palette-item-icon cmd-palette-group-emoji">{group.photoURL}</div>
          ) : (
            <div className="cmd-palette-item-icon">👥</div>
          )}
          <div className="cmd-palette-item-info">
            <div className="cmd-palette-item-name">{item.name}</div>
            <div className="cmd-palette-item-hint">{item.hint}</div>
          </div>
        </div>
      );
    } else if (item.type === 'user') {
      return (
        <div
          key={`user-${item.user.uid}`}
          className={`cmd-palette-item ${idx === selectedIndex ? 'selected' : ''}`}
          onClick={() => handleSelect(item)}
        >
          {item.user.photoURL && <img src={item.user.photoURL} alt={item.user.displayName} />}
          <div className="cmd-palette-item-info">
            <div className="cmd-palette-item-name">{item.user.displayName || item.user.email}</div>
            <div className="cmd-palette-item-hint">{item.user.email}</div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="cmd-palette-input"
          placeholder="Search channels, groups, and people..."
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
            <div className="cmd-palette-section">
              {filteredItems.map((item, idx) => renderItem(item, idx))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
