'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { subscribeToAnnouncements, deleteAnnouncement } from '../../lib/firestore'
import { useDevMode } from '../../contexts/DevModeContext'
import CreateAnnouncementModal from './CreateAnnouncementModal'

/**
 * Modal showing all announcements (historical list)
 * Admin users see a "New Announcement" button
 */
export default function AnnouncementsModal({ isOpen, onClose, user }) {
  const [announcements, setAnnouncements] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { canAccessDevMode } = useDevMode()

  useEffect(() => {
    if (!isOpen) return

    const unsubscribe = subscribeToAnnouncements((loadedAnnouncements) => {
      setAnnouncements(loadedAnnouncements)
    })

    return () => unsubscribe()
  }, [isOpen])

  const formatDate = (timestamp) => {
    if (!timestamp) return ''
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return format(date, 'MMM d, yyyy')
    } catch {
      return ''
    }
  }

  const handleDelete = async (e, announcementId) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this announcement?')) return
    
    try {
      await deleteAnnouncement(announcementId)
    } catch (error) {
      console.error('Error deleting announcement:', error)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className='w-full max-w-[600px] p-0 gap-0 border-0 rounded-[28px] overflow-hidden shadow-2xl [&>button]:hidden'
          style={{ backgroundColor: '#1a1625' }}
        >
          {/* Visually hidden title for accessibility */}
          <DialogTitle className='sr-only'>Announcements</DialogTitle>
          
          {/* Header with optional New Announcement button */}
          <div 
            style={{ 
              padding: '32px 40px 24px 40px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className='text-white font-semibold text-xl'>📢 Announcements</span>
            
            {canAccessDevMode && (
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease',
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                + New
              </button>
            )}
          </div>

          {/* Announcements list */}
          <div style={{ padding: '0 40px 40px 40px', maxHeight: '70vh', overflowY: 'auto' }}>
            {announcements.length === 0 ? (
              <div className='text-center' style={{ padding: '60px 0' }}>
                <div className='text-5xl mb-4'>📭</div>
                <p style={{ color: 'rgba(167,139,250,0.7)' }} className='text-lg'>No announcements yet</p>
                {canAccessDevMode && (
                  <p style={{ color: 'rgba(167,139,250,0.4)' }} className='text-sm mt-2'>
                    Click "+ New" to create your first announcement
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    style={{
                      backgroundColor: 'rgba(167, 139, 250, 0.08)',
                      borderRadius: '16px',
                      padding: '20px',
                      border: '1px solid rgba(167, 139, 250, 0.12)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(167, 139, 250, 0.12)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(167, 139, 250, 0.08)'}
                  >
                    {/* Header row: emoji + title + date + delete */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '24px' }}>{announcement.emoji || '📢'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ 
                          color: '#ffffff', 
                          fontSize: '16px', 
                          fontWeight: 600,
                          margin: 0,
                          lineHeight: 1.4,
                        }}>
                          {announcement.title}
                        </h3>
                        <span style={{ 
                          color: 'rgba(167, 139, 250, 0.5)', 
                          fontSize: '12px',
                        }}>
                          {formatDate(announcement.createdAt)}
                          {announcement.createdByName && ` · ${announcement.createdByName}`}
                        </span>
                      </div>
                      
                      {/* Delete button (admin only) */}
                      {canAccessDevMode && (
                        <button
                          onClick={(e) => handleDelete(e, announcement.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(167, 139, 250, 0.4)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '6px',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseOut={(e) => e.currentTarget.style.color = 'rgba(167, 139, 250, 0.4)'}
                          title="Delete announcement"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Message */}
                    <p style={{ 
                      color: 'rgba(255, 255, 255, 0.7)', 
                      fontSize: '14px',
                      lineHeight: 1.5,
                      margin: 0,
                      marginLeft: '36px', // Align with title (24px emoji + 12px gap)
                    }}>
                      {announcement.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <CreateAnnouncementModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          user={user}
        />
      )}
    </>
  )
}

