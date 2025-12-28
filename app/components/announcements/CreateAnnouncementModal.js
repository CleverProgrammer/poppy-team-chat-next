'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { createAnnouncement } from '../../lib/firestore'

const EMOJI_SUGGESTIONS = ['🎉', '🚀', '📢', '💡', '✨', '🎯', '📋', '🔥', '💜', '⚡']

/**
 * Modal for admins to create a new announcement
 */
export default function CreateAnnouncementModal({ isOpen, onClose, user }) {
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('📢')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!title.trim() || !message.trim()) {
      alert('Please fill in both title and message')
      return
    }

    setIsSubmitting(true)
    
    try {
      await createAnnouncement(user, title.trim(), emoji, message.trim())
      // Reset form
      setTitle('')
      setMessage('')
      setEmoji('📢')
      onClose()
    } catch (error) {
      console.error('Error creating announcement:', error)
      alert('Failed to create announcement. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className='w-full max-w-[480px] p-0 gap-0 border-0 rounded-[28px] overflow-hidden shadow-2xl [&>button]:hidden'
        style={{ 
          backgroundColor: '#1a1625',
          zIndex: 10001, // Above the announcements modal
        }}
      >
        {/* Visually hidden title for accessibility */}
        <DialogTitle className='sr-only'>Create New Announcement</DialogTitle>

        <div style={{ padding: '32px 40px 40px' }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '28px',
          }}>
            <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 600, margin: 0 }}>
              New Announcement
            </h2>
            <button
              onClick={onClose}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(167, 139, 250, 0.6)',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '20px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Emoji selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                color: 'rgba(167, 139, 250, 0.8)', 
                fontSize: '13px',
                marginBottom: '8px',
                fontWeight: 500,
              }}>
                Emoji
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {EMOJI_SUGGESTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      border: emoji === e ? '2px solid #a78bfa' : '2px solid rgba(167, 139, 250, 0.2)',
                      background: emoji === e ? 'rgba(167, 139, 250, 0.15)' : 'rgba(167, 139, 250, 0.05)',
                      fontSize: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Title input */}
            <div style={{ marginBottom: '20px' }}>
              <label 
                htmlFor="announcement-title"
                style={{ 
                  display: 'block', 
                  color: 'rgba(167, 139, 250, 0.8)', 
                  fontSize: '13px',
                  marginBottom: '8px',
                  fontWeight: 500,
                }}
              >
                Title
              </label>
              <input
                id="announcement-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Welcome to Poppy 2.0!"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '2px solid rgba(167, 139, 250, 0.2)',
                  background: 'rgba(167, 139, 250, 0.05)',
                  color: '#ffffff',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#a78bfa'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.2)'}
              />
            </div>

            {/* Message textarea */}
            <div style={{ marginBottom: '28px' }}>
              <label 
                htmlFor="announcement-message"
                style={{ 
                  display: 'block', 
                  color: 'rgba(167, 139, 250, 0.8)', 
                  fontSize: '13px',
                  marginBottom: '8px',
                  fontWeight: 500,
                }}
              >
                Message
              </label>
              <textarea
                id="announcement-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What would you like to announce to the team?"
                rows={4}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '2px solid rgba(167, 139, 250, 0.2)',
                  background: 'rgba(167, 139, 250, 0.05)',
                  color: '#ffffff',
                  fontSize: '15px',
                  outline: 'none',
                  resize: 'none',
                  transition: 'border-color 0.15s ease',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#a78bfa'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.2)'}
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !message.trim()}
              style={{
                width: '100%',
                background: isSubmitting || !title.trim() || !message.trim()
                  ? 'rgba(167, 139, 250, 0.3)'
                  : 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '14px 24px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: isSubmitting || !title.trim() || !message.trim() ? 'not-allowed' : 'pointer',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Publishing...' : '📢 Publish Announcement'}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
