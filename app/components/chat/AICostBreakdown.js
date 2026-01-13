'use client'

import { useState } from 'react'
import { useDevMode } from '../../contexts/DevModeContext'

/**
 * AI Cost Breakdown - Shows combined cost details for AI responses
 * Includes: AI chat response cost + tagging/classification cost
 * Clickable to show a modal with full breakdown
 */
export default function AICostBreakdown({ costBreakdown, aiTags }) {
  const [showModal, setShowModal] = useState(false)
  const { isDevMode } = useDevMode()

  // Only show in dev mode
  if (!isDevMode) return null

  // Get costs from both sources
  const responseCost = costBreakdown?.totalCost || 0
  const taggingCost = aiTags?._cost || 0
  const combinedCost = responseCost + taggingCost

  // If no costs at all, don't show anything
  if (combinedCost === 0) return null

  const { toolsUsed = [], apiCalls = [] } = costBreakdown || {}

  return (
    <>
      {/* Inline cost display - shows combined total + tokens */}
      <button
        onClick={e => {
          e.stopPropagation()
          setShowModal(true)
        }}
        className="inline-flex items-center gap-1.5 cursor-pointer opacity-70 hover:opacity-100 transition-opacity ml-2"
        title="Click to see AI cost breakdown"
      >
        <span className="text-[9px] font-mono text-green-400">
          ${combinedCost.toFixed(4)}
        </span>
        {costBreakdown?.totalInputTokens && (
          <span className="text-[8px] font-mono text-gray-500">
            {((costBreakdown.totalInputTokens + (costBreakdown.totalOutputTokens || 0)) / 1000).toFixed(1)}k
          </span>
        )}
        {toolsUsed.length > 0 && (
          <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full border bg-purple-500/10 text-purple-400/70 border-purple-500/20">
            {toolsUsed.length} tool{toolsUsed.length > 1 ? 's' : ''}
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
            className="bg-gray-900 border border-gray-700 rounded-xl p-5 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                💰 AI Cost Breakdown
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Combined Total Cost */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Cost</span>
                <span className="text-2xl font-mono text-green-400">
                  ${combinedCost.toFixed(6)}
                </span>
              </div>
              {costBreakdown && (
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-gray-500">
                    {costBreakdown.totalInputTokens?.toLocaleString() || 0} input + {costBreakdown.totalOutputTokens?.toLocaleString() || 0} output tokens
                  </span>
                </div>
              )}
            </div>

            {/* Cost Breakdown Summary */}
            <div className="space-y-2 mb-4">
              <h4 className="text-sm font-medium text-gray-400">📊 Cost Summary</h4>
              <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                {responseCost > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">🤖 AI Response</span>
                    <span className="font-mono text-green-400">${responseCost.toFixed(6)}</span>
                  </div>
                )}
                {taggingCost > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">🏷️ Classification/Tagging</span>
                    <span className="font-mono text-green-400">${taggingCost.toFixed(6)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-700">
                  <span className="text-gray-200 font-medium">Combined Total</span>
                  <span className="font-mono text-green-400 font-medium">${combinedCost.toFixed(6)}</span>
                </div>
              </div>
            </div>

            {/* AI Response Details */}
            {apiCalls.length > 0 && (
              <div className="space-y-3 mb-4">
                <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  🤖 AI Response Calls ({apiCalls.length})
                </h4>
                {apiCalls.map((call, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-300 font-medium">
                        {i === 0 ? '📤 Initial Request' : `🔧 Tool Response #${i}`}
                      </span>
                      <span className="font-mono text-green-400 text-xs">
                        ${call.cost?.toFixed(6)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>
                        Tokens: {call.inputTokens?.toLocaleString()} in / {call.outputTokens?.toLocaleString()} out
                      </div>
                      {call.toolsRequested?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {call.toolsRequested.map((tool, j) => (
                            <span
                              key={j}
                              className="text-[10px] bg-purple-900/30 text-purple-300 px-1.5 py-0.5 rounded"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tagging Details */}
            {aiTags && taggingCost > 0 && (
              <div className="space-y-3 mb-4">
                <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  🏷️ Classification Details
                </h4>
                <div className="bg-gray-800/50 rounded-lg p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Type</span>
                    <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded">
                      {aiTags.type || 'general'}
                    </span>
                  </div>
                  {aiTags._tokens && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Tokens</span>
                      <span className="font-mono">
                        {aiTags._tokens.input_tokens} in / {aiTags._tokens.output_tokens} out
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Cost</span>
                    <span className="font-mono text-green-400 text-xs">${taggingCost.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tools Used */}
            {toolsUsed.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  🔧 Tools Used ({toolsUsed.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {toolsUsed.map((tool, i) => (
                    <span
                      key={i}
                      className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded-full border border-blue-500/20"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Model Info */}
            <div className="mt-4 pt-3 border-t border-gray-800">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Model:</span>
                <span className="font-mono text-gray-400">{costBreakdown?.model || 'claude-sonnet-4-5'}</span>
              </div>
            </div>

            {/* Raw JSON toggle */}
            <details className="mt-4 pt-3 border-t border-gray-800">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                Raw JSON
              </summary>
              <pre className="mt-2 text-[10px] text-gray-400 bg-gray-950 p-3 rounded overflow-auto max-h-40">
                {JSON.stringify({ costBreakdown, aiTags: aiTags ? { _cost: aiTags._cost, _tokens: aiTags._tokens, type: aiTags.type } : null }, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </>
  )
}
