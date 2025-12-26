'use client'

import { useState } from 'react'

// Format cost as currency
function formatCost(cost) {
  if (!cost && cost !== 0) return 'N/A'
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  return `$${cost.toFixed(2)}`
}

// Format duration in ms to readable format
function formatDuration(ms) {
  if (!ms) return 'N/A'
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

// Format model name to be more readable
function formatModelName(model) {
  if (!model) return 'Unknown'
  // claude-sonnet-4-5-20250929 -> Claude Sonnet 4.5
  if (model.includes('sonnet-4-5')) return 'Claude Sonnet 4.5'
  if (model.includes('sonnet-3-5')) return 'Claude Sonnet 3.5'
  if (model.includes('opus')) return 'Claude Opus'
  if (model.includes('haiku')) return 'Claude Haiku'
  return model
}

export default function DevModeDetailModal({ isOpen, onClose, messageId, usageData }) {
  const [activeTab, setActiveTab] = useState('overview')
  
  if (!isOpen || !usageData) return null
  
  const {
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    inputCost,
    outputCost,
    totalCost,
    apiCalls,
    toolCalls,
    ragieSearches,
    durationMs,
    workflowId,
  } = usageData
  
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tokens', label: 'Tokens' },
    { id: 'tools', label: `Tools (${toolCalls?.length || 0})` },
    { id: 'ragie', label: `Ragie (${ragieSearches?.length || 0})` },
  ]
  
  return (
    <div className="dev-modal-overlay" onClick={onClose}>
      <div className="dev-modal" onClick={e => e.stopPropagation()}>
        <div className="dev-modal-header">
          <h2>AI Response Details</h2>
          <button className="dev-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="dev-modal-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`dev-modal-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="dev-modal-content">
          {activeTab === 'overview' && (
            <div className="dev-modal-section">
              <div className="dev-stat-grid">
                <div className="dev-stat-card highlight">
                  <div className="dev-stat-label">Total Cost</div>
                  <div className="dev-stat-value">{formatCost(totalCost)}</div>
                </div>
                <div className="dev-stat-card">
                  <div className="dev-stat-label">Duration</div>
                  <div className="dev-stat-value">{formatDuration(durationMs)}</div>
                </div>
                <div className="dev-stat-card">
                  <div className="dev-stat-label">Model</div>
                  <div className="dev-stat-value">{formatModelName(model)}</div>
                </div>
                <div className="dev-stat-card">
                  <div className="dev-stat-label">API Calls</div>
                  <div className="dev-stat-value">{apiCalls || 1}</div>
                </div>
                <div className="dev-stat-card">
                  <div className="dev-stat-label">Tools Used</div>
                  <div className="dev-stat-value">{toolCalls?.length || 0}</div>
                </div>
                <div className="dev-stat-card">
                  <div className="dev-stat-label">Ragie Searches</div>
                  <div className="dev-stat-value">{ragieSearches?.length || 0}</div>
                </div>
              </div>
              
              {workflowId && (
                <div className="dev-workflow-id">
                  <span className="dev-workflow-label">Workflow ID:</span>
                  <code className="dev-workflow-value">{workflowId}</code>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'tokens' && (
            <div className="dev-modal-section">
              <div className="dev-token-breakdown">
                <div className="dev-token-row">
                  <div className="dev-token-type">
                    <span className="dev-token-icon input">↓</span>
                    Input Tokens
                  </div>
                  <div className="dev-token-count">{inputTokens?.toLocaleString() || 0}</div>
                  <div className="dev-token-cost">{formatCost(inputCost)}</div>
                </div>
                <div className="dev-token-row">
                  <div className="dev-token-type">
                    <span className="dev-token-icon output">↑</span>
                    Output Tokens
                  </div>
                  <div className="dev-token-count">{outputTokens?.toLocaleString() || 0}</div>
                  <div className="dev-token-cost">{formatCost(outputCost)}</div>
                </div>
                <div className="dev-token-row total">
                  <div className="dev-token-type">Total</div>
                  <div className="dev-token-count">{totalTokens?.toLocaleString() || 0}</div>
                  <div className="dev-token-cost">{formatCost(totalCost)}</div>
                </div>
              </div>
              
              <div className="dev-token-visual">
                <div className="dev-token-bar">
                  <div 
                    className="dev-token-bar-input" 
                    style={{ width: `${(inputTokens / totalTokens) * 100}%` }}
                    title={`Input: ${inputTokens} tokens`}
                  />
                  <div 
                    className="dev-token-bar-output" 
                    style={{ width: `${(outputTokens / totalTokens) * 100}%` }}
                    title={`Output: ${outputTokens} tokens`}
                  />
                </div>
                <div className="dev-token-bar-legend">
                  <span className="dev-legend-item input">
                    <span className="dev-legend-dot" />
                    Input ({Math.round((inputTokens / totalTokens) * 100)}%)
                  </span>
                  <span className="dev-legend-item output">
                    <span className="dev-legend-dot" />
                    Output ({Math.round((outputTokens / totalTokens) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'tools' && (
            <div className="dev-modal-section">
              {toolCalls?.length > 0 ? (
                <div className="dev-tool-list">
                  {toolCalls.map((tool, index) => (
                    <div key={index} className={`dev-tool-item ${tool.success ? 'success' : 'error'}`}>
                      <div className="dev-tool-header">
                        <span className="dev-tool-name">{tool.name}</span>
                        <span className="dev-tool-category">{tool.category}</span>
                        <span className="dev-tool-duration">{formatDuration(tool.durationMs)}</span>
                        <span className={`dev-tool-status ${tool.success ? 'success' : 'error'}`}>
                          {tool.success ? '✓' : '✗'}
                        </span>
                      </div>
                      {tool.input && (
                        <details className="dev-tool-details">
                          <summary>Input Parameters</summary>
                          <pre className="dev-tool-json">
                            {JSON.stringify(tool.input, null, 2)}
                          </pre>
                        </details>
                      )}
                      {tool.error && (
                        <div className="dev-tool-error">
                          Error: {tool.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dev-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  <p>No tools were used for this response</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'ragie' && (
            <div className="dev-modal-section">
              {ragieSearches?.length > 0 ? (
                <div className="dev-ragie-list">
                  {ragieSearches.map((search, index) => (
                    <div key={index} className="dev-ragie-item">
                      <div className="dev-ragie-header">
                        <span className="dev-ragie-query">"{search.query}"</span>
                        <span className="dev-ragie-duration">{formatDuration(search.durationMs)}</span>
                      </div>
                      <div className="dev-ragie-meta">
                        <span className="dev-ragie-results">
                          {search.resultsCount} result{search.resultsCount !== 1 ? 's' : ''} found
                        </span>
                        {(search.startDate || search.endDate) && (
                          <span className="dev-ragie-dates">
                            {search.startDate && `From: ${new Date(search.startDate).toLocaleDateString()}`}
                            {search.startDate && search.endDate && ' - '}
                            {search.endDate && `To: ${new Date(search.endDate).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dev-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <p>No Ragie searches were performed</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
