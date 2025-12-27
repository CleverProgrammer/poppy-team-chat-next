'use client'

import { useContext } from 'react'
import { DeveloperModeContext } from '../../contexts/DeveloperModeContext'

// Format cost as currency
function formatCost(cost) {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  return `$${cost.toFixed(2)}`
}

// Format token count with K suffix for thousands
function formatTokens(tokens) {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}

export default function DevModePill({ messageId, onShowDetails }) {
  const developerMode = useContext(DeveloperModeContext)
  
  // Don't render if developer mode is not enabled
  if (!developerMode?.isDeveloperModeEnabled) {
    return null
  }
  
  const { getUsageDataForMessage } = developerMode
  const usageData = getUsageDataForMessage(messageId)
  
  // Don't render if no usage data for this message
  if (!usageData) {
    return null
  }
  
  const { totalCost, totalTokens, toolCalls, model } = usageData
  const toolCount = toolCalls?.length || 0
  
  return (
    <div className="dev-mode-pill-container">
      <button 
        className="dev-mode-pill"
        onClick={() => onShowDetails?.(messageId, usageData)}
        title="Click for details"
      >
        <span className="dev-pill-cost">{formatCost(totalCost)}</span>
        <span className="dev-pill-separator">|</span>
        <span className="dev-pill-tokens">{formatTokens(totalTokens)} tokens</span>
        {toolCount > 0 && (
          <>
            <span className="dev-pill-separator">|</span>
            <span className="dev-pill-tools">{toolCount} tool{toolCount !== 1 ? 's' : ''}</span>
          </>
        )}
      </button>
    </div>
  )
}
