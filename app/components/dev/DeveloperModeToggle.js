'use client'

import { useContext } from 'react'
import { DeveloperModeContext } from '../../contexts/DeveloperModeContext'

export default function DeveloperModeToggle() {
  const developerMode = useContext(DeveloperModeContext)
  
  // Don't render if user is not authorized
  if (!developerMode?.canUseDeveloperMode) {
    return null
  }
  
  const { isDeveloperModeEnabled, toggleDeveloperMode } = developerMode
  
  return (
    <button
      className="user-menu-item dev-mode-toggle"
      onClick={toggleDeveloperMode}
    >
      <span className="dev-mode-toggle-label">
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m18 16 4-4-4-4" />
          <path d="m6 8-4 4 4 4" />
          <path d="m14.5 4-5 16" />
        </svg>
        Developer Mode
      </span>
      <span className={`dev-mode-toggle-switch ${isDeveloperModeEnabled ? 'active' : ''}`}>
        <span className="dev-mode-toggle-knob" />
      </span>
    </button>
  )
}
