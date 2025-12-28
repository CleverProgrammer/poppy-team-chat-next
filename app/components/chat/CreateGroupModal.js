'use client'

import { useState, useMemo } from 'react'
import { createGroup } from '../../lib/firestore'

export default function CreateGroupModal({ user, allUsers, onClose, onGroupCreated }) {
  const [selectedMembers, setSelectedMembers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)

  // Filter users (exclude current user)
  const availableUsers = useMemo(() => {
    return allUsers.filter(u => u.uid !== user?.uid)
  }, [allUsers, user])

  // Filter by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return availableUsers
    const query = searchQuery.toLowerCase()
    return availableUsers.filter(u => 
      u.displayName?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query)
    )
  }, [availableUsers, searchQuery])

  const toggleMember = (member) => {
    const isSelected = selectedMembers.some(m => m.uid === member.uid)
    if (isSelected) {
      setSelectedMembers(prev => prev.filter(m => m.uid !== member.uid))
    } else {
      setSelectedMembers(prev => [...prev, member])
    }
  }

  const handleCreateGroup = async () => {
    if (selectedMembers.length < 1 || creating) return

    setCreating(true)
    try {
      const groupId = await createGroup(user, selectedMembers)
      
      // Notify parent of success
      if (onGroupCreated) {
        const groupData = {
          id: groupId,
          memberNames: [user.displayName || user.email, ...selectedMembers.map(m => m.displayName || m.email)],
          memberCount: selectedMembers.length + 1,
        }
        onGroupCreated(groupData)
      }
      
      onClose()
    } catch (error) {
      console.error('Error creating group:', error)
      alert('Failed to create group. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-group-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Group</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <p className="modal-description">
          Select members to start a group chat
        </p>

        {/* Search input */}
        <div className="group-search-wrapper">
          <input
            type="text"
            placeholder="Search team members..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="group-search-input"
            autoFocus
          />
        </div>

        {/* Selected members chips */}
        {selectedMembers.length > 0 && (
          <div className="selected-members-chips">
            <span className="selected-label">Selected ({selectedMembers.length}):</span>
            {selectedMembers.map(member => (
              <div 
                key={member.uid} 
                className="member-chip"
                onClick={() => toggleMember(member)}
              >
                {member.displayName || member.email?.split('@')[0]}
                <span className="chip-remove">✕</span>
              </div>
            ))}
          </div>
        )}

        {/* Member list */}
        <div className="member-list">
          {filteredUsers.map(u => {
            const isSelected = selectedMembers.some(m => m.uid === u.uid)
            return (
              <div 
                key={u.uid} 
                className={`member-item ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleMember(u)}
              >
                <div className="member-checkbox">
                  {isSelected ? '☑' : '☐'}
                </div>
                <div className="member-avatar-wrapper">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.displayName} className="member-avatar" />
                  ) : (
                    <div className="member-avatar-fallback">
                      {(u.displayName || u.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="member-info">
                  <span className="member-name">{u.displayName || u.email}</span>
                </div>
              </div>
            )
          })}

          {filteredUsers.length === 0 && (
            <div className="no-members-found">
              No team members found
            </div>
          )}
        </div>

        {/* Create button */}
        <button 
          className="create-group-btn"
          onClick={handleCreateGroup}
          disabled={selectedMembers.length < 1 || creating}
        >
          {creating ? 'Creating...' : `Create Group (${selectedMembers.length + 1} members)`}
        </button>
      </div>

      <style jsx>{`
        .create-group-modal {
          max-width: 320px;
          max-height: 70vh;
          display: flex;
          flex-direction: column;
          padding: 16px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
        }

        .modal-close-btn {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          color: var(--color-text-secondary);
          padding: 2px 6px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .modal-close-btn:hover {
          background: var(--color-hover);
        }

        .modal-description {
          color: var(--color-text-secondary);
          font-size: 12px;
          margin-bottom: 10px;
        }

        .group-search-wrapper {
          margin-bottom: 8px;
        }

        .group-search-input {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          background: var(--color-input-bg);
          color: var(--color-text);
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        }

        .group-search-input:focus {
          border-color: var(--color-primary);
        }

        .selected-members-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          margin-bottom: 8px;
          padding: 8px;
          background: var(--color-hover);
          border-radius: 8px;
        }

        .selected-label {
          font-size: 11px;
          color: var(--color-text-secondary);
          margin-right: 2px;
        }

        .member-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: #1a1a2e;
          color: #e0e0e0;
          border: 1px solid #3a3a4a;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .member-chip:hover {
          background: #252540;
          border-color: #4a4a5a;
        }

        .chip-remove {
          font-size: 9px;
          color: #ff6b6b;
          opacity: 0.9;
        }

        .member-list {
          flex: 1;
          overflow-y: auto;
          max-height: 200px;
          margin-bottom: 10px;
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }

        .member-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          cursor: pointer;
          transition: background 0.15s;
          border-bottom: 1px solid var(--color-border);
        }

        .member-item:last-child {
          border-bottom: none;
        }

        .member-item:hover {
          background: var(--color-hover);
        }

        .member-item.selected {
          background: rgba(52, 199, 89, 0.1);
        }

        .member-checkbox {
          font-size: 14px;
          color: var(--color-primary);
          width: 18px;
        }

        .member-avatar-wrapper {
          flex-shrink: 0;
        }

        .member-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
        }

        .member-avatar-fallback {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8e8e93 0%, #636366 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          color: white;
        }

        .member-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }

        .member-name {
          font-weight: 500;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .no-members-found {
          padding: 16px;
          text-align: center;
          color: var(--color-text-secondary);
          font-size: 12px;
        }

        .create-group-btn {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #34C759 0%, #248A3D 100%);
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.2s;
        }

        .create-group-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .create-group-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

