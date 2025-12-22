'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import AuthForm from './components/auth/AuthForm'
import ChatWindow from './components/chat/ChatWindow'

export default function Home() {
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [cachedUser, setCachedUser] = useState(null)

  // Check cache AFTER mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const cached = localStorage.getItem('poppy_cached_user')
      if (cached) {
        setCachedUser(JSON.parse(cached))
      }
    } catch (e) {
      console.warn('Failed to read cached user:', e)
    }
    setMounted(true)
  }, [])

  // Before mount - render nothing (consistent on server and client)
  if (!mounted) {
    return null
  }

  // After mount - if we have cached user, render ChatWindow immediately
  if (cachedUser || user) {
    return <ChatWindow />
  }

  // Still loading and no cached user
  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <p>Loading...</p>
      </div>
    )
  }

  // Not logged in - show login form
  if (!user) {
    return (
      <div className='login-container'>
        <div className='login-section'>
          <h2>Welcome to Poppy Chat 🎉</h2>
          <p>Sign in to start chatting with your team</p>
          <AuthForm />
        </div>
      </div>
    )
  }

  // Fallback
  return <ChatWindow />
}
