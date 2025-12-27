'use client'

import { useState } from 'react'

/**
 * Dev mode component that shows AI tag info (cost + type)
 * Clickable to show a modal with full classification details
 */
export default function DevTagInfo({ aiTags }) {
  const [showModal, setShowModal] = useState(false)

  if (!aiTags) return null

  const cost = aiTags._cost
  const type = aiTags.type

  // Type badge colors based on classification
  const getTypeBadgeClasses = (type) => {
    switch (type) {
      case 'task':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      case 'feature_request':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'question':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
      case 'decision':
        return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'bug_report':
        return 'bg-red-500/20 text-red-300 border-red-500/30'
      case 'status_update':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
      case 'blocker':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
      case 'praise':
        return 'bg-pink-500/20 text-pink-300 border-pink-500/30'
      case 'general':
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  // Priority badge colors
  const getPriorityBadgeClasses = (priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-600/30 text-red-200'
      case 'high':
        return 'bg-orange-500/30 text-orange-200'
      case 'medium':
        return 'bg-yellow-500/30 text-yellow-200'
      case 'low':
        return 'bg-green-500/30 text-green-200'
      default:
        return 'bg-gray-500/30 text-gray-300'
    }
  }

  return (
    <>
      {/* Inline badge - clickable */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowModal(true)
        }}
        className="inline-flex items-center gap-1.5 ml-1.5 cursor-pointer hover:opacity-100 transition-opacity"
        title="Click to see AI classification details"
      >
        {/* Cost */}
        {cost && (
          <span className="text-[9px] font-mono text-gray-400 opacity-60">
            ${cost.toFixed(4)}
          </span>
        )}
        
        {/* Type badge */}
        {type && (
          <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full border ${getTypeBadgeClasses(type)}`}>
            {type.replace('_', ' ')}
          </span>
        )}
      </button>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                🏷️ AI Classification
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Classification Details */}
            <div className="space-y-3">
              {/* Type */}
              {type && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20">Type</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getTypeBadgeClasses(type)}`}>
                    {type.replace('_', ' ')}
                  </span>
                </div>
              )}

              {/* Priority */}
              {aiTags.priority && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20">Priority</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${getPriorityBadgeClasses(aiTags.priority)}`}>
                    {aiTags.priority}
                  </span>
                </div>
              )}

              {/* Status */}
              {aiTags.status && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20">Status</span>
                  <span className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded">
                    {aiTags.status}
                  </span>
                </div>
              )}

              {/* Canonical Tag */}
              {aiTags.canonical_tag && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20">Canonical</span>
                  <span className="text-xs text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded font-mono">
                    {aiTags.canonical_tag}
                  </span>
                </div>
              )}

              {/* Summary */}
              {aiTags.summary && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-20 shrink-0">Summary</span>
                  <span className="text-xs text-gray-300">
                    {aiTags.summary}
                  </span>
                </div>
              )}

              {/* Tags */}
              {aiTags.tags && aiTags.tags.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-20 shrink-0">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {aiTags.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignee (for tasks) */}
              {aiTags.assignee && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20">Assignee</span>
                  <span className="text-xs text-purple-300">
                    @{aiTags.assignee}
                  </span>
                </div>
              )}

              {/* Due Date */}
              {aiTags.due_date && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20">Due Date</span>
                  <span className="text-xs text-yellow-300">
                    📅 {aiTags.due_date}
                  </span>
                </div>
              )}

              {/* Cost */}
              {cost && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                  <span className="text-xs text-gray-500 w-20">API Cost</span>
                  <span className="text-xs font-mono text-green-400">
                    ${cost.toFixed(6)}
                  </span>
                </div>
              )}

              {/* Tokens */}
              {aiTags._tokens && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20">Tokens</span>
                  <span className="text-xs font-mono text-gray-400">
                    {aiTags._tokens.input_tokens} in / {aiTags._tokens.output_tokens} out
                  </span>
                </div>
              )}
            </div>

            {/* Raw JSON toggle (for debugging) */}
            <details className="mt-4 pt-3 border-t border-gray-800">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                Raw JSON
              </summary>
              <pre className="mt-2 text-[10px] text-gray-400 bg-gray-950 p-3 rounded overflow-auto max-h-40">
                {JSON.stringify(aiTags, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </>
  )
}

