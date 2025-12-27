'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'

// The only email allowed to use developer mode
const DEVELOPER_EMAIL = 'qazi@cleverprogrammer.com'

const DeveloperModeContext = createContext({
  isDeveloperModeEnabled: false,
  canUseDeveloperMode: false,
  toggleDeveloperMode: () => {},
  usageData: {},
  setUsageDataForMessage: () => {},
  getUsageDataForMessage: () => null,
})

export function DeveloperModeProvider({ children }) {
  const { user } = useAuth()
  const [isDeveloperModeEnabled, setIsDeveloperModeEnabled] = useState(false)
  const [usageData, setUsageData] = useState({}) // Map of messageId -> usage data

  // Check if the current user can use developer mode
  const canUseDeveloperMode = user?.email === DEVELOPER_EMAIL

  // Load developer mode preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && canUseDeveloperMode) {
      const saved = localStorage.getItem('poppy-developer-mode')
      if (saved === 'true') {
        setIsDeveloperModeEnabled(true)
      }
    }
  }, [canUseDeveloperMode])

  // Save developer mode preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && canUseDeveloperMode) {
      localStorage.setItem('poppy-developer-mode', isDeveloperModeEnabled.toString())
    }
  }, [isDeveloperModeEnabled, canUseDeveloperMode])

  // If user is not allowed, always disable
  useEffect(() => {
    if (!canUseDeveloperMode && isDeveloperModeEnabled) {
      setIsDeveloperModeEnabled(false)
    }
  }, [canUseDeveloperMode, isDeveloperModeEnabled])

  const toggleDeveloperMode = useCallback(() => {
    if (canUseDeveloperMode) {
      setIsDeveloperModeEnabled(prev => !prev)
    }
  }, [canUseDeveloperMode])

  // Store usage data for a specific message
  const setUsageDataForMessage = useCallback((messageId, data) => {
    setUsageData(prev => ({
      ...prev,
      [messageId]: data,
    }))
  }, [])

  // Get usage data for a specific message
  const getUsageDataForMessage = useCallback((messageId) => {
    return usageData[messageId] || null
  }, [usageData])

  return (
    <DeveloperModeContext.Provider
      value={{
        isDeveloperModeEnabled,
        canUseDeveloperMode,
        toggleDeveloperMode,
        usageData,
        setUsageDataForMessage,
        getUsageDataForMessage,
      }}
    >
      {children}
    </DeveloperModeContext.Provider>
  )
}

export function useDeveloperMode() {
  return useContext(DeveloperModeContext)
}
