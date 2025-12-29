'use client';

import React, { useState } from 'react';

// URL regex pattern used across the app
export const urlRegex = /(https?:\/\/[^\s]+)/g;

// Mention regex pattern - matches @Name (handles multi-word names like @John Doe)
// This captures @poppy and @DisplayName patterns
export const mentionRegex = /@(\S+(?:\s+\S+)?)/g;

// Helper to get first name from display name
function getFirstName(displayName) {
  if (!displayName) return '';
  return displayName.split(' ')[0];
}

// Mention pill component - shows profile photo + first name in a styled pill
function MentionPill({ mentionText, allUsers, currentUser }) {
  // Check if it's @poppy (AI mention)
  const isPoppy = mentionText.toLowerCase() === 'poppy';
  
  // Find the mentioned user
  let mentionedUser = null;
  let isCurrentUserMentioned = false;
  
  if (isPoppy) {
    mentionedUser = {
      displayName: 'Poppy',
      photoURL: '/poppy-icon.png',
      uid: 'poppy-ai'
    };
  } else {
    // Try to find user by display name (case insensitive)
    mentionedUser = allUsers?.find(u => 
      u.displayName?.toLowerCase() === mentionText.toLowerCase() ||
      getFirstName(u.displayName)?.toLowerCase() === mentionText.toLowerCase()
    );
    
    // Check if current user is mentioned
    if (mentionedUser && currentUser) {
      isCurrentUserMentioned = mentionedUser.uid === currentUser.uid;
    }
    
    // Also check if @mentionText matches current user's name
    if (!isCurrentUserMentioned && currentUser) {
      const currentUserFirstName = getFirstName(currentUser.displayName)?.toLowerCase();
      const currentUserFullName = currentUser.displayName?.toLowerCase();
      isCurrentUserMentioned = 
        mentionText.toLowerCase() === currentUserFirstName ||
        mentionText.toLowerCase() === currentUserFullName;
    }
  }
  
  const firstName = mentionedUser 
    ? getFirstName(mentionedUser.displayName) 
    : mentionText;
  
  const photoURL = mentionedUser?.photoURL;
  
  return (
    <span 
      className={`mention-pill ${isCurrentUserMentioned ? 'mention-pill-highlighted' : ''} ${isPoppy ? 'mention-pill-poppy' : ''}`}
    >
      {photoURL ? (
        <img 
          src={photoURL} 
          alt={firstName}
          className="mention-pill-avatar"
        />
      ) : (
        <span className="mention-pill-avatar-placeholder">
          {firstName.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="mention-pill-name">{firstName}</span>
    </span>
  );
}

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

// Process mentions in a text segment
function processMentions(text, allUsers, currentUser, keyPrefix = '') {
  if (!text || typeof text !== 'string') return text;
  
  // Match @FirstName or @FirstName LastName (captures full name to hide last name)
  // This regex captures: @Word or @Word Word (two words max)
  const mentionRegex = /@(\S+)(?:\s+(\S+))?/g;
  
  const result = [];
  let lastIndex = 0;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before this mention
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    
    const firstName = match[1];
    const possibleLastName = match[2];
    
    // Check if this is a known user with a two-word name
    const fullName = possibleLastName ? `${firstName} ${possibleLastName}` : firstName;
    const isKnownFullName = allUsers?.some(u => 
      u.displayName?.toLowerCase() === fullName.toLowerCase()
    );
    
    // If it's a known full name, consume both words. Otherwise just the first word.
    if (isKnownFullName && possibleLastName) {
      // Full name matched - consume both words, show first name only
      result.push(
        <MentionPill
          key={`${keyPrefix}mention-${result.length}`}
          mentionText={fullName}
          allUsers={allUsers}
          currentUser={currentUser}
        />
      );
      lastIndex = match.index + match[0].length;
    } else {
      // Just first name or unknown - consume only the first word
      result.push(
        <MentionPill
          key={`${keyPrefix}mention-${result.length}`}
          mentionText={firstName}
          allUsers={allUsers}
          currentUser={currentUser}
        />
      );
      // Only consume @firstName, leave the rest
      lastIndex = match.index + 1 + firstName.length; // @firstName
    }
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  
  return result.length > 0 ? result : text;
}

export function linkifyText(text, onImageClick = null, allUsers = [], currentUser = null) {
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
    // Process mentions in non-URL parts
    return (
      <React.Fragment key={index}>
        {processMentions(part, allUsers, currentUser, `${index}-`)}
      </React.Fragment>
    );
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
