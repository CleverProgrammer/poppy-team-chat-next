'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

// Only these users can see/enable dev mode
const DEV_USERS = [
  'qazi@cleverprogrammer.com',
  'e6AqpILFQwVBw6f7gLgtmBWXIo52'
]

const DevModeContext = createContext({
  isDevMode: false,
  toggleDevMode: () => {},
  canAccessDevMode: false
})

export function DevModeProvider({ children }) {
  const { user } = useAuth()
  const [isDevMode, setIsDevMode] = useState(false)

  // Check if current user can access dev mode
  const canAccessDevMode = user && (
    DEV_USERS.includes(user.email) || 
    DEV_USERS.includes(user.uid)
  )

  // Load dev mode preference from localStorage
  useEffect(() => {
    if (canAccessDevMode) {
      const saved = localStorage.getItem('poppy_dev_mode')
      if (saved === 'true') {
        setIsDevMode(true)
      }
    } else {
      setIsDevMode(false)
    }
  }, [canAccessDevMode])

  const toggleDevMode = () => {
    if (!canAccessDevMode) return
    
    const newValue = !isDevMode
    setIsDevMode(newValue)
    localStorage.setItem('poppy_dev_mode', String(newValue))
  }

  return (
    <DevModeContext.Provider value={{ isDevMode, toggleDevMode, canAccessDevMode }}>
      {children}
    </DevModeContext.Provider>
  )
}

export function useDevMode() {
  return useContext(DevModeContext)
}

