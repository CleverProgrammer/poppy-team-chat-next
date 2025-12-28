'use client'

import { useState, useMemo, useRef } from 'react'
import { addGroupMember, removeGroupMember, subscribeToGroup } from '../../lib/firestore'
import { useEffect } from 'react'

export default function GroupInfoModal({ 
  groupId, 
  group: initialGroup, 
  user, 
  allUsers, 
  onClose
}) {
  const [group, setGroup] = useState(initialGroup)
  const [showAddMember, setShowAddMember] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState(null)
  const searchInputRef = useRef(null)

  // Subscribe to group updates
  useEffect(() => {
    if (!groupId) return
    
    const unsubscribe = subscribeToGroup(groupId, updatedGroup => {
      if (updatedGroup) {
        setGroup(updatedGroup)
      }
    })

    return () => unsubscribe()
  }, [groupId])

  // Get members from the group
  const members = useMemo(() => {
    if (!group?.members) return []
    
    return Object.entries(group.members).map(([uid, memberData]) => {
      // Try to find full user data from allUsers
      const fullUser = allUsers.find(u => u.uid === uid)
      return {
        uid,
        displayName: fullUser?.displayName || memberData.displayName || memberData.email?.split('@')[0] || 'Unknown',
        email: fullUser?.email || memberData.email || '',
        photoURL: fullUser?.photoURL || memberData.photoURL || '',
        joinedAt: memberData.joinedAt,
      }
    })
  }, [group, allUsers])

  // Users not in the group (for add member)
  const availableUsers = useMemo(() => {
    if (!group?.members) return allUsers.filter(u => u.uid !== user?.uid)
    const memberIds = Object.keys(group.members)
    return allUsers.filter(u => !memberIds.includes(u.uid))
  }, [allUsers, group, user])

  // Filtered users for search
  const filteredAvailableUsers = useMemo(() => {
    if (!searchQuery.trim()) return availableUsers
    const query = searchQuery.toLowerCase()
    return availableUsers.filter(u => 
      u.displayName?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query)
    )
  }, [availableUsers, searchQuery])

  // Focus search input when add member form appears
  useEffect(() => {
    if (showAddMember && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showAddMember])

  // Generate display name
  const groupDisplayName = group?.name || group?.displayName || 
    members.map(m => m.displayName?.split(' ')[0] || m.email?.split('@')[0]).join(', ')

  const handleAddMember = async (memberToAdd) => {
    if (adding) return
    setAdding(true)
    
    try {
      await addGroupMember(groupId, memberToAdd)
      setSearchQuery('')
    } catch (error) {
      console.error('Error adding member:', error)
      alert('Failed to add member. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveMember = async (memberUid) => {
    if (removing) return
    
    // Confirm removal
    if (!confirm('Remove this member from the group?')) return
    
    setRemoving(memberUid)
    
    try {
      await removeGroupMember(groupId, memberUid)
    } catch (error) {
      console.error('Error removing member:', error)
      alert('Failed to remove member. Please try again.')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content group-info-modal" onClick={e => e.stopPropagation()}>
        {/* Header with close button */}
        <button className="modal-close-btn-top" onClick={onClose}>✕</button>

        {/* Stacked avatars */}
        <div className="group-info-avatars">
          {members.slice(0, 4).map((member, idx) => (
            member.photoURL ? (
              <img 
                key={member.uid}
                src={member.photoURL} 
                alt={member.displayName} 
                className='group-info-avatar'
                style={{ 
                  zIndex: 4 - idx,
                  marginLeft: idx > 0 ? '-16px' : '0'
                }}
              />
            ) : (
              <div 
                key={member.uid}
                className='group-info-avatar-fallback'
                style={{ 
                  zIndex: 4 - idx,
                  marginLeft: idx > 0 ? '-16px' : '0'
                }}
              >
                {(member.displayName || '?')[0].toUpperCase()}
              </div>
            )
          ))}
        </div>

        {/* Group name */}
        <h2 className="group-info-name">{groupDisplayName}</h2>

        {/* Member list */}
        <div className="group-info-section">
          <div className="group-info-section-header">
            <span>Members ({members.length})</span>
          </div>
          
          <div className="group-info-members">
            {members.map(member => (
              <div key={member.uid} className="group-info-member">
                <div className="group-info-member-avatar">
                  {member.photoURL ? (
                    <img src={member.photoURL} alt={member.displayName} />
                  ) : (
                    <div className="avatar-fallback">
                      {(member.displayName || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="group-info-member-info">
                  <span className="group-info-member-name">
                    {member.displayName}
                    {member.uid === user?.uid && <span className="you-badge"> (You)</span>}
                  </span>
                  <span className="group-info-member-email">{member.email}</span>
                </div>
                {member.uid !== user?.uid && (
                  <button 
                    className="group-info-member-remove"
                    onClick={() => handleRemoveMember(member.uid)}
                    disabled={removing === member.uid}
                  >
                    {removing === member.uid ? '...' : '✕'}
                  </button>
                )}
              </div>
            ))}

            {/* Add member button/form */}
            {showAddMember ? (
              <div 
                className="add-member-form"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search team members..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="add-member-search"
                  autoFocus
                  onMouseDown={e => e.stopPropagation()}
                  onFocus={e => e.stopPropagation()}
                />
                <div className="add-member-list">
                  {filteredAvailableUsers.map(u => (
                    <div 
                      key={u.uid} 
                      className="add-member-item"
                      onClick={() => handleAddMember(u)}
                    >
                      <div className="add-member-avatar">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.displayName} />
                        ) : (
                          <div className="avatar-fallback">
                            {(u.displayName || u.email || '?')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span>{u.displayName || u.email}</span>
                      <span className="add-btn">{adding ? '...' : 'Add'}</span>
                    </div>
                  ))}
                  {filteredAvailableUsers.length === 0 && (
                    <div className="no-users-found">No team members to add</div>
                  )}
                </div>
                <button 
                  className="cancel-add-btn"
                  onClick={() => {
                    setShowAddMember(false)
                    setSearchQuery('')
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                className="group-info-add-member"
                onClick={() => setShowAddMember(true)}
              >
                <span className="add-icon">＋</span>
                <span>Add Member</span>
              </button>
            )}
          </div>
        </div>

        <style jsx>{`
          .group-info-modal {
            max-width: 380px;
            padding: 24px;
            text-align: center;
          }

          .modal-close-btn-top {
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: var(--color-text-secondary);
            padding: 4px 8px;
            border-radius: 6px;
            transition: background 0.2s;
          }

          .modal-close-btn-top:hover {
            background: var(--color-hover);
          }

          .group-info-avatars {
            display: flex;
            justify-content: center;
            margin-bottom: 12px;
          }

          .group-info-avatar {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid var(--color-background);
          }

          .group-info-avatar-fallback {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #8e8e93 0%, #636366 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 600;
            color: white;
            border: 3px solid var(--color-background);
          }

          .group-info-name {
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 20px 0;
            color: var(--color-text);
          }

          .group-info-section {
            text-align: left;
          }

          .group-info-section-header {
            font-size: 12px;
            font-weight: 600;
            color: var(--color-text-secondary);
            text-transform: uppercase;
            margin-bottom: 10px;
          }

          .group-info-members {
            background: var(--color-hover);
            border-radius: 12px;
            overflow: hidden;
          }

          .group-info-member {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            border-bottom: 1px solid var(--color-border);
          }

          .group-info-member:last-child {
            border-bottom: none;
          }

          .group-info-member-avatar img,
          .group-info-member-avatar .avatar-fallback {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            object-fit: cover;
          }

          .group-info-member-avatar .avatar-fallback {
            background: linear-gradient(135deg, #8e8e93 0%, #636366 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 600;
            color: white;
          }

          .group-info-member-info {
            flex: 1;
            min-width: 0;
          }

          .group-info-member-name {
            display: block;
            font-weight: 500;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .you-badge {
            font-weight: 400;
            color: var(--color-text-secondary);
          }

          .group-info-member-email {
            display: block;
            font-size: 12px;
            color: var(--color-text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .group-info-member-remove {
            background: none;
            border: none;
            color: #ff3b30;
            font-size: 14px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            opacity: 0.6;
            transition: opacity 0.2s;
          }

          .group-info-member-remove:hover {
            opacity: 1;
          }

          .group-info-add-member {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 12px;
            background: none;
            border: none;
            cursor: pointer;
            color: var(--color-primary);
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
          }

          .group-info-add-member:hover {
            background: rgba(52, 199, 89, 0.1);
          }

          .add-icon {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #34C759 0%, #30B350 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            color: white;
          }

          .add-member-form {
            padding: 12px;
          }

          .add-member-search {
            width: 100%;
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid var(--color-border);
            background: var(--color-input-bg);
            color: var(--color-text);
            font-size: 14px;
            margin-bottom: 8px;
          }

          .add-member-list {
            max-height: 200px;
            overflow-y: auto;
          }

          .add-member-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.15s;
          }

          .add-member-item:hover {
            background: var(--color-background);
          }

          .add-member-avatar img,
          .add-member-avatar .avatar-fallback {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
          }

          .add-member-avatar .avatar-fallback {
            background: linear-gradient(135deg, #8e8e93 0%, #636366 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            color: white;
          }

          .add-member-item span:nth-child(2) {
            flex: 1;
            font-size: 14px;
          }

          .add-btn {
            color: var(--color-primary);
            font-size: 13px;
            font-weight: 500;
          }

          .no-users-found {
            padding: 16px;
            text-align: center;
            color: var(--color-text-secondary);
            font-size: 13px;
          }

          .cancel-add-btn {
            width: 100%;
            margin-top: 8px;
            padding: 8px;
            background: none;
            border: 1px solid var(--color-border);
            border-radius: 6px;
            color: var(--color-text-secondary);
            font-size: 13px;
            cursor: pointer;
            transition: background 0.2s;
          }

          .cancel-add-btn:hover {
            background: var(--color-hover);
          }
        `}</style>
      </div>
    </div>
  )
}

