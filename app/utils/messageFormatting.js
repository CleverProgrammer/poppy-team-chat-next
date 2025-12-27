'use client';

import React, { useState } from 'react';

// URL regex pattern used across the app
export const urlRegex = /(https?:\/\/[^\s]+)/g;

// Check if URL is a Firebase Storage image URL
export function isFirebaseImageUrl(url) {
  if (!url) return false;
  // Very simple check - if it contains firebasestorage, treat it as an image
  // The component will handle errors gracefully
  return url.includes('firebasestorage');
}

// Inline image component with loading/error state
function InlineImage({ src, onImageClick }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Clean the URL - remove any trailing punctuation that might have been captured
  // Also remove trailing closing parentheses/brackets that might have been captured
  const cleanSrc = src.replace(/[,.:;!?)>\]]+$/, '');
  
  // Debug log - show full URL for debugging 404 issues
  console.log('🖼️ InlineImage rendering:');
  console.log('   Original src:', src);
  console.log('   Cleaned src:', cleanSrc);
  console.log('   State:', { failed, loaded });

  if (failed) {
    return (
      <a
        href={cleanSrc}
        target="_blank"
        rel="noopener noreferrer"
        className="message-link inline-image-link"
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
      >
        🖼️ View Image
      </a>
    );
  }

  return (
    <div className="inline-image-container" style={{ margin: '8px 0' }}>
      {!loaded && (
        <div style={{ 
          width: '200px', 
          height: '150px', 
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)'
        }}>
          Loading...
        </div>
      )}
      <img
        src={cleanSrc}
        alt="Shared image"
        className="inline-image"
        referrerPolicy="no-referrer"
        style={{
          maxWidth: '240px',
          maxHeight: '280px',
          borderRadius: '8px',
          cursor: 'pointer',
          display: loaded ? 'block' : 'none',
        }}
        onClick={(e) => {
          e.stopPropagation();
          // Use lightbox if callback provided, otherwise fallback to new window
          if (onImageClick) {
            onImageClick([cleanSrc], 0);
          } else {
            window.open(cleanSrc, '_blank');
          }
        }}
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          console.error('❌ Image failed to load (404?)');
          console.error('   URL attempted:', cleanSrc);
          console.error('   Original URL:', src);
          console.error('   Error event:', e);
          setFailed(true);
        }}
      />
    </div>
  );
}

export function linkifyText(text, onImageClick = null) {
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      // Check if it's a Firebase Storage image URL - render as image
      if (isFirebaseImageUrl(part)) {
        return <InlineImage key={index} src={part} onImageClick={onImageClick} />;
      }
      // Regular link
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="message-link"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// Extract the first URL from text
export function extractFirstUrl(text) {
  if (!text) return null;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
}

// Check if text is a single emoji (or up to 3 emojis)
export function isSingleEmoji(text) {
  if (!text || typeof text !== 'string') return false;

  // Remove whitespace
  const trimmed = text.trim();

  // Split by potential emoji boundaries while preserving ZWJ sequences
  const emojiOnlyRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\p{Emoji_Modifier})?(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\p{Emoji_Modifier})?)*/gu;
  const emojis = trimmed.match(emojiOnlyRegex) || [];

  // Check if the entire string is just emojis (no other characters)
  const reconstructed = emojis.join('');
  if (reconstructed !== trimmed) return false;

  // Allow 1-3 emojis
  return emojis.length >= 1 && emojis.length <= 3;
}

// Detect Loom share URLs
export function isLoomUrl(url) {
  return /https?:\/\/(www\.)?loom\.com\/share\/[a-zA-Z0-9]+/.test(url);
}

// Convert Loom share URL to embed URL
export function getLoomEmbedUrl(url) {
  const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  return match ? `https://www.loom.com/embed/${match[1]}` : null;
}
