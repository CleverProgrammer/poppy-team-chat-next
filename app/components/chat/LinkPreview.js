'use client'

import { useState, useEffect } from 'react'

// Cache for link previews to avoid refetching
const previewCache = new Map()

export default function LinkPreview({ url, isSent = false }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!url) {
      setLoading(false)
      return
    }

    // Check cache first
    if (previewCache.has(url)) {
      setPreview(previewCache.get(url))
      setLoading(false)
      return
    }

    const fetchPreview = async () => {
      try {
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch preview')
        }

        const data = await response.json()
        
        if (data.error) {
          throw new Error(data.error)
        }

        // Cache the result
        previewCache.set(url, data)
        setPreview(data)
      } catch (err) {
        console.error('Link preview error:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchPreview()
  }, [url])

  // Don't render anything if loading, error, or no preview data
  if (loading || error || !preview) {
    return null
  }

  // Get the best image
  const image = preview.images?.[0] || null
  const favicon = preview.favicons?.[0] || null
  const domain = new URL(url).hostname.replace('www.', '')

  // Don't show preview if there's no meaningful content
  if (!preview.title && !preview.description && !image) {
    return null
  }

  return (
    <a 
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`link-preview ${isSent ? 'link-preview-sent' : 'link-preview-received'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {image && (
        <div className="link-preview-image-container">
          <img 
            src={image} 
            alt={preview.title || 'Link preview'} 
            className="link-preview-image"
            loading="lazy"
            onError={(e) => {
              // Hide image container if image fails to load
              e.target.parentElement.style.display = 'none'
            }}
          />
        </div>
      )}
      <div className="link-preview-content">
        <div className="link-preview-site">
          {favicon && (
            <img 
              src={favicon} 
              alt="" 
              className="link-preview-favicon"
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          <span className="link-preview-domain">{domain}</span>
        </div>
        {preview.title && (
          <div className="link-preview-title">{preview.title}</div>
        )}
        {preview.description && (
          <div className="link-preview-description">
            {preview.description.length > 120 
              ? preview.description.substring(0, 120) + '...' 
              : preview.description
            }
          </div>
        )}
      </div>
    </a>
  )
}

