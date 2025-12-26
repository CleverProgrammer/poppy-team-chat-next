'use client'

import { useState, useEffect, useRef } from 'react'
import SkeletonView from './SkeletonView'
import { cn } from '../../utils/cn'

// Cache for link previews to avoid refetching
const previewCache = new Map()

// Default dimensions for link preview images (OG standard)
const DEFAULT_OG_WIDTH = 1200
const DEFAULT_OG_HEIGHT = 630
const MAX_PREVIEW_IMAGE_WIDTH = 320

export default function LinkPreview({ 
  url, 
  isSent = false,
  // Stored preview data from Firestore (for new messages)
  storedPreview = null,
  // For on-demand migration of old messages
  onPreviewMigrate = null,
}) {
  const [preview, setPreview] = useState(storedPreview)
  const [loading, setLoading] = useState(!storedPreview)
  const [error, setError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const migrationCalledRef = useRef(false)

  useEffect(() => {
    // If we have stored preview data, use it directly
    if (storedPreview) {
      setPreview(storedPreview)
      setLoading(false)
      return
    }

    if (!url) {
      setLoading(false)
      return
    }

    // Check cache first
    if (previewCache.has(url)) {
      const cachedPreview = previewCache.get(url)
      setPreview(cachedPreview)
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

        // Normalize to stored format
        const normalizedPreview = {
          url: data.url || url,
          title: data.title || null,
          description: data.description || null,
          siteName: data.siteName || null,
          image: data.images?.[0] || null,
          favicon: data.favicons?.[0] || null,
          imageDimensions: data.imageDimensions || null,
        }

        // Cache the result
        previewCache.set(url, normalizedPreview)
        setPreview(normalizedPreview)
        
        // On-demand migration: update Firestore for old messages
        if (!migrationCalledRef.current && onPreviewMigrate) {
          migrationCalledRef.current = true
          onPreviewMigrate(normalizedPreview)
        }
      } catch (err) {
        console.error('Link preview error:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchPreview()
  }, [url, storedPreview, onPreviewMigrate])

  // Show skeleton while loading
  if (loading) {
    return (
      <div 
        className={cn(
          'link-preview rounded-xl overflow-hidden',
          isSent ? 'link-preview-sent' : 'link-preview-received'
        )}
        style={{ maxWidth: MAX_PREVIEW_IMAGE_WIDTH }}
      >
        <SkeletonView 
          width={DEFAULT_OG_WIDTH} 
          height={DEFAULT_OG_HEIGHT} 
          loaded={false}
        >
          <div />
        </SkeletonView>
        <div className="link-preview-content p-3">
          <div className="h-3 bg-white/10 rounded w-1/3 mb-2" />
          <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
          <div className="h-3 bg-white/10 rounded w-full" />
        </div>
      </div>
    )
  }

  // Don't render if error or no preview data
  if (error || !preview) {
    return null
  }

  // Get the best image (skip GIFs and images without valid dimensions)
  // If imageDimensions is null, the image couldn't be validated during fetch - skip it to prevent layout shifts
  const rawImage = preview.image || null
  const isGif = rawImage && rawImage.toLowerCase().endsWith('.gif')
  const hasValidDimensions = preview.imageDimensions?.width && preview.imageDimensions?.height
  const image = (isGif || !hasValidDimensions) ? null : rawImage
  const favicon = preview.favicon || null
  const domain = (() => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  })()

  // Don't show preview if there's no meaningful content
  if (!preview.title && !preview.description && !image) {
    return null
  }

  // Get image dimensions for skeleton
  const imgWidth = preview.imageDimensions?.width || DEFAULT_OG_WIDTH
  const imgHeight = preview.imageDimensions?.height || DEFAULT_OG_HEIGHT

  return (
    <a 
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'link-preview block rounded-xl overflow-hidden relative',
        isSent ? 'link-preview-sent' : 'link-preview-received'
      )}
      style={{ maxWidth: MAX_PREVIEW_IMAGE_WIDTH }}
      onClick={(e) => e.stopPropagation()}
    >
      {image && (
        <div className="link-preview-image-container">
          <SkeletonView
            width={imgWidth}
            height={imgHeight}
            loaded={imageLoaded}
            className="rounded-none"
          >
            <img 
              src={image} 
              alt={preview.title || 'Link preview'} 
              className="w-full h-full object-cover block"
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                // Hide image container if image fails to load
                e.target.parentElement.parentElement.style.display = 'none'
                setImageLoaded(true)
              }}
            />
          </SkeletonView>
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
