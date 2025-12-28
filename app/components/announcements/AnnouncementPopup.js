'use client'

import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { dismissAnnouncement } from '../../lib/firestore'

/**
 * Beautiful blur-background popup modal for new announcements
 * Shows automatically when user has unread announcements
 */
export default function AnnouncementPopup({ announcement, userId, onDismiss }) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = async () => {
    setIsLeaving(true)
    
    try {
      await dismissAnnouncement(announcement.id, userId)
    } catch (error) {
      console.error('Error dismissing announcement:', error)
    }

    // Wait for animation to complete
    setTimeout(() => {
      onDismiss()
    }, 300)
  }

  if (!announcement) return null

  // Use portal to render at document body level
  return createPortal(
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        opacity: isVisible && !isLeaving ? 1 : 0,
        transition: 'opacity 0.3s ease-out',
      }}
    >
      {/* Announcement Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#1a1625',
          borderRadius: '28px',
          padding: '48px 40px',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          transform: isVisible && !isLeaving ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
          transition: 'transform 0.3s ease-out',
        }}
      >
        {/* Large Emoji */}
        <div
          style={{
            fontSize: '64px',
            marginBottom: '24px',
            lineHeight: 1,
          }}
        >
          {announcement.emoji || '📢'}
        </div>

        {/* Title */}
        <h2
          style={{
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          {announcement.title}
        </h2>

        {/* Message */}
        <p
          style={{
            color: 'rgba(167, 139, 250, 0.8)',
            fontSize: '16px',
            lineHeight: 1.6,
            marginBottom: '32px',
          }}
        >
          {announcement.message}
        </p>

        {/* Got it button */}
        <button
          onClick={handleDismiss}
          style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '14px',
            padding: '14px 48px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(167, 139, 250, 0.3)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Got it! 👍
        </button>
      </div>
    </div>,
    document.body
  )
}

