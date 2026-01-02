'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * MindmapView - Renders markdown content as an interactive mindmap using Markmap
 * 
 * The AI returns markdown like:
 * # Topic
 * ## Subtopic 1
 * - Point A
 * - Point B
 * ## Subtopic 2
 * - Point C
 * 
 * This gets transformed into a beautiful interactive mindmap!
 */
export default function MindmapView({ markdown, title, onUpdate }) {
  const svgRef = useRef(null)
  const markmapRef = useRef(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editableMarkdown, setEditableMarkdown] = useState(markdown)
  const [currentMarkdown, setCurrentMarkdown] = useState(markdown)
  const [error, setError] = useState(null)

  // Render mindmap function - extracted so we can call it on edit
  const renderMindmap = useCallback(async (md) => {
    if (!svgRef.current || !md) return

    try {
      const { Transformer } = await import('markmap-lib')
      const { Markmap } = await import('markmap-view')

      // Transform markdown to mindmap data structure
      const transformer = new Transformer()
      const { root } = transformer.transform(md)

      // Clear any previous content
      svgRef.current.innerHTML = ''
      
      // Ensure SVG has dimensions before creating markmap
      const container = svgRef.current.parentElement
      if (container) {
        const rect = container.getBoundingClientRect()
        svgRef.current.setAttribute('width', rect.width || 600)
        svgRef.current.setAttribute('height', rect.height || 300)
      }

      // Create the markmap visualization
      markmapRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 500,
        maxWidth: 200,
        color: (node) => {
          const colors = [
            '#ff6b6b', '#ffa502', '#2ed573', '#1e90ff',
            '#a55eea', '#ff7f50', '#00d2d3',
          ]
          return colors[node.state?.depth % colors.length] || colors[0]
        },
        paddingX: 12,
        spacingVertical: 8,
        spacingHorizontal: 80,
      }, root)

      // Fit after a short delay to ensure proper rendering
      setTimeout(() => {
        markmapRef.current?.fit()
      }, 100)

      setIsLoaded(true)
    } catch (err) {
      console.error('Failed to initialize mindmap:', err)
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    if (!svgRef.current || !currentMarkdown) return

    // Dynamic import to avoid SSR issues with markmap
    const initMarkmap = async () => {
      try {
        const { Transformer } = await import('markmap-lib')
        const { Markmap } = await import('markmap-view')

        // Transform markdown to mindmap data structure
        const transformer = new Transformer()
        const { root } = transformer.transform(currentMarkdown)

        // Clear any previous content
        svgRef.current.innerHTML = ''
        
        // Ensure SVG has dimensions before creating markmap
        const container = svgRef.current.parentElement
        if (container) {
          const rect = container.getBoundingClientRect()
          svgRef.current.setAttribute('width', rect.width || 600)
          svgRef.current.setAttribute('height', rect.height || 300)
        }

        // Create the markmap visualization
        markmapRef.current = Markmap.create(svgRef.current, {
          // Mindmap options
          autoFit: true,
          duration: 500,
          maxWidth: 200,
          color: (node) => {
            // Beautiful color palette - gradient from warm to cool colors
            const colors = [
              '#ff6b6b', // Coral red (root)
              '#ffa502', // Orange
              '#2ed573', // Green
              '#1e90ff', // Dodger blue
              '#a55eea', // Purple
              '#ff7f50', // Coral
              '#00d2d3', // Cyan
            ]
            return colors[node.state?.depth % colors.length] || colors[0]
          },
          paddingX: 12,
          spacingVertical: 8,
          spacingHorizontal: 80,
        }, root)

        // Fit after a short delay to ensure proper rendering
        setTimeout(() => {
          markmapRef.current?.fit()
        }, 100)

        setIsLoaded(true)
      } catch (err) {
        console.error('Failed to initialize mindmap:', err)
        setError(err.message)
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initMarkmap, 50)

    // Cleanup
    return () => {
      clearTimeout(timer)
      if (markmapRef.current) {
        markmapRef.current = null
      }
    }
  }, [currentMarkdown])

  // Handle applying edits
  const handleApplyEdit = useCallback(() => {
    setCurrentMarkdown(editableMarkdown)
    setIsEditing(false)
    setIsLoaded(false)
    // If onUpdate callback provided, call it with new markdown
    onUpdate?.(editableMarkdown)
  }, [editableMarkdown, onUpdate])

  // Handle canceling edits - need to re-render mindmap after exiting edit mode
  const handleCancelEdit = useCallback(() => {
    setEditableMarkdown(currentMarkdown)
    setIsEditing(false)
    // Force re-render of mindmap by setting isLoaded to false briefly
    setIsLoaded(false)
    // Re-render the mindmap after a short delay to ensure SVG is in DOM
    setTimeout(() => {
      renderMindmap(currentMarkdown)
    }, 100)
  }, [currentMarkdown, renderMindmap])

  // Handle starting edit mode
  const handleStartEdit = useCallback(() => {
    setEditableMarkdown(currentMarkdown)
    setIsEditing(true)
  }, [currentMarkdown])

  // Handle resize when expanded/collapsed
  useEffect(() => {
    if (markmapRef.current && isLoaded) {
      setTimeout(() => {
        markmapRef.current.fit()
      }, 300) // Wait for CSS transition
    }
  }, [isExpanded, isLoaded])

  if (error) {
    return (
      <div className="mindmap-error">
        <span className="mindmap-error-icon">⚠️</span>
        <span>Failed to render mindmap: {error}</span>
      </div>
    )
  }

  return (
    <div className={`mindmap-container ${isExpanded ? 'expanded' : ''}`}>
      {/* Header */}
      <div className="mindmap-header">
        <div className="mindmap-title">
          <span className="mindmap-icon">🧠</span>
          <span>{title || 'Mindmap'}</span>
        </div>
        <div className="mindmap-actions">
          {/* Edit button */}
          <button
            className={`mindmap-action-btn ${isEditing ? 'active' : ''}`}
            onClick={isEditing ? handleCancelEdit : handleStartEdit}
            title={isEditing ? 'Cancel edit' : 'Edit mindmap'}
          >
            {isEditing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            )}
          </button>
          {/* Fit button */}
          <button
            className="mindmap-action-btn"
            onClick={() => markmapRef.current?.fit()}
            title="Fit to view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
          {/* Expand button */}
          <button
            className="mindmap-action-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mindmap Content or Edit Mode */}
      <div className="mindmap-content">
        {isEditing ? (
          /* Edit Mode */
          <div className="mindmap-edit-mode">
            <textarea
              className="mindmap-editor"
              value={editableMarkdown}
              onChange={(e) => setEditableMarkdown(e.target.value)}
              placeholder="# Main Topic
## Branch 1
- Item A
- Item B
## Branch 2
- Item C"
              spellCheck={false}
            />
            <div className="mindmap-edit-actions">
              <button
                className="mindmap-edit-btn mindmap-edit-cancel"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
              <button
                className="mindmap-edit-btn mindmap-edit-apply"
                onClick={handleApplyEdit}
              >
                ✓ Apply Changes
              </button>
            </div>
            <div className="mindmap-edit-help">
              <strong>Syntax:</strong> Use # for root, ## for branches, - for items, indent with spaces for nesting
            </div>
          </div>
        ) : (
          /* Mindmap View */
          <>
            {!isLoaded && (
              <div className="mindmap-loading">
                <div className="mindmap-loading-spinner" />
                <span>Generating mindmap...</span>
              </div>
            )}
            <svg
              ref={svgRef}
              className="mindmap-svg"
              style={{ opacity: isLoaded ? 1 : 0 }}
            />
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="mindmap-footer">
        <span className="mindmap-hint">
          💡 Click nodes to expand/collapse • Drag to pan • Scroll to zoom
        </span>
      </div>
    </div>
  )
}

