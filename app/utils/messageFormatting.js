'use client';

import React, { useState, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// URL regex pattern used across the app
export const urlRegex = /(https?:\/\/[^\s]+)/g;

// Email regex pattern - matches common email formats
export const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

// Phone regex pattern - matches various phone formats
// Matches: (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890, 1234567890, etc.
export const phoneRegex = /(\+?1?\s*[-.]?\s*)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;

// Mindmap block pattern - matches ```mindmap ... ``` or ```mindmap ... </mindmap> blocks
// Supports both proper markdown closing (```) and XML-style closing (</mindmap>)
export const mindmapBlockRegex = /```mindmap\s*\n([\s\S]*?)(?:```|<\/mindmap>)/g;

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

// Email link component - clickable email with copy-to-clipboard
function EmailLink({ email }) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Copy to clipboard
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy email:', err);
    });
  }, [email]);

  return (
    <span 
      className={`email-link ${copied ? 'email-link-copied' : ''}`}
      onClick={handleClick}
      title={copied ? 'Copied!' : 'Click to copy'}
    >
      {email}
      {copied && <span className="email-copied-badge">✓</span>}
    </span>
  );
}

// Phone link component - clickable phone with copy-to-clipboard
function PhoneLink({ phone }) {
  const [copied, setCopied] = useState(false);

  // Clean phone number for copying (remove formatting, keep digits and +)
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Copy to clipboard
    navigator.clipboard.writeText(cleanPhone).then(() => {
      setCopied(true);
      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy phone:', err);
    });
  }, [cleanPhone]);

  return (
    <span 
      className={`phone-link ${copied ? 'phone-link-copied' : ''}`}
      onClick={handleClick}
      title={copied ? 'Copied!' : 'Click to copy'}
    >
      📞 {phone}
      {copied && <span className="phone-copied-badge">✓</span>}
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

// Process emails in a text segment - returns array with EmailLink components
function processEmails(text, keyPrefix = '') {
  if (!text || typeof text !== 'string') return [text];
  
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const result = [];
  let lastIndex = 0;
  let match;
  
  while ((match = emailPattern.exec(text)) !== null) {
    // Add text before this email
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    
    // Add email component
    result.push(
      <EmailLink
        key={`${keyPrefix}email-${result.length}`}
        email={match[1]}
      />
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  
  return result.length > 0 ? result : [text];
}

// Process phone numbers in a text segment - returns array with PhoneLink components
function processPhones(text, keyPrefix = '') {
  if (!text || typeof text !== 'string') return [text];
  
  // Match phone patterns: (123) 456-7890, 123-456-7890, +1 123 456 7890, etc.
  const phonePattern = /(\+?1?\s*[-.]?\s*)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const result = [];
  let lastIndex = 0;
  let match;
  
  while ((match = phonePattern.exec(text)) !== null) {
    const phoneNumber = match[0].trim();
    
    // Skip if it looks like it could be part of a longer number (like a credit card)
    // Phone numbers should be 10-15 digits max
    const digitCount = phoneNumber.replace(/\D/g, '').length;
    if (digitCount < 10 || digitCount > 15) continue;
    
    // Add text before this phone
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    
    // Add phone component
    result.push(
      <PhoneLink
        key={`${keyPrefix}phone-${result.length}`}
        phone={phoneNumber}
      />
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  
  return result.length > 0 ? result : [text];
}

// Process mentions in a text segment (handles text that may already have email components)
function processMentionsOnly(text, allUsers, currentUser, keyPrefix = '') {
  if (!text || typeof text !== 'string') return text;
  
  // Match @FirstName or @FirstName LastName (captures full name to hide last name)
  // This regex captures: @Word or @Word Word (two words max)
  const mentionRegex = /@(\S+)(?:\s+(\S+))?/g;
  
  const result = [];
  let lastIndex = 0;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    // Check if there's a non-whitespace character immediately before the @
    // If so, this is likely an email address (e.g., someone@email.com) - skip it
    if (match.index > 0) {
      const charBefore = text.charAt(match.index - 1);
      if (charBefore && !/\s/.test(charBefore)) {
        // This is an email, not a mention - skip it entirely
        continue;
      }
    }
    
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

// Process both emails, phones, and mentions in text
function processMentions(text, allUsers, currentUser, keyPrefix = '') {
  if (!text || typeof text !== 'string') return text;
  
  // First, process emails
  const withEmails = processEmails(text, keyPrefix);
  
  // Then, process phone numbers on string parts
  const withPhones = withEmails.flatMap((part, idx) => {
    if (typeof part === 'string') {
      return processPhones(part, `${keyPrefix}${idx}-`);
    }
    return part;
  });
  
  // Finally, process mentions on remaining string parts
  const result = withPhones.flatMap((part, idx) => {
    if (typeof part === 'string') {
      return processMentionsOnly(part, allUsers, currentUser, `${keyPrefix}p${idx}-`);
    }
    return part;
  });
  
  return result;
}

export function linkifyAIText(text, onImageClick = null, allUsers = [], currentUser = null) {
  if (!text) return null;

  const renderMentions = value => processMentions(value, allUsers, currentUser, 'md-');

  return (
    <div className="markdown-ai">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Links
          a: ({ href, children }) => {
            if (href && isFirebaseImageUrl(href)) {
              return <InlineImage src={href} onImageClick={onImageClick} />;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="message-link"
                onClick={e => e.stopPropagation()}
              >
                {href}
              </a>
            );
          },
          // Headings with tight spacing
          h1: ({ children }) => <h1 className="m-0 mb-1 text-xl font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="m-0 mb-1 text-lg font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="m-0 mb-1 text-base font-semibold">{children}</h3>,
          h4: ({ children }) => <h4 className="m-0 mb-1 text-base font-medium">{children}</h4>,
          // Paragraphs
          p: ({ children }) => <p className="m-0 mb-1 leading-relaxed">{children}</p>,
          // Lists
          ul: ({ children }) => <ul className="m-0 mb-1 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="m-0 mb-1 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="m-0 leading-relaxed">{children}</li>,
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="m-0 mb-1 border-l-2 border-white/20 pl-3 leading-relaxed text-white/90">
              {children}
            </blockquote>
          ),
          // Code
          code: ({ inline, className, children }) =>
            inline ? (
              <code className={`inline-code ${className || ''}`.trim()}>{children}</code>
            ) : (
              <pre className={`m-0 mb-1 rounded-lg bg-black/40 p-3 text-sm overflow-x-auto ${className || ''}`.trim()}>
                <code>{children}</code>
              </pre>
            ),
          // Horizontal rule
          hr: () => <hr className="my-2 border-white/10" />,
          // Images
          img: ({ src, alt }) => <InlineImage src={src} onImageClick={onImageClick} alt={alt || 'Shared image'} />,
          // Text node: process mentions
          text: ({ children }) => {
            const content = Array.isArray(children) ? children.join('') : children;
            return <>{renderMentions(content)}</>;
          },
        }}
      >
        {text}
      </Markdown>
    </div>
  );
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

/**
 * Check if text contains a mindmap block
 * Mindmap blocks are formatted as: ```mindmap\n...content...\n```
 * or ```mindmap title="..."\n...content...\n```
 * Also supports </mindmap> closing tag (some AI responses use this)
 */
export function containsMindmap(text) {
  if (!text || typeof text !== 'string') return false;
  // Match ```mindmap optionally followed by title="..." then newline and content
  // Supports both ``` and </mindmap> as closing
  return /```mindmap(?:\s+title="[^"]*")?\s*\n[\s\S]*?(?:```|<\/mindmap>)/.test(text);
}

/**
 * Extract mindmap content from a text block
 * Returns { markdown, title, remainingText } or null if no mindmap found
 * Supports both ``` and </mindmap> as closing tags
 */
export function extractMindmap(text) {
  if (!text || typeof text !== 'string') return null;
  
  const match = text.match(/```mindmap(?:\s*title="([^"]*)")?\s*\n([\s\S]*?)(?:```|<\/mindmap>)/);
  if (!match) return null;
  
  const title = match[1] || null;
  const markdown = match[2].trim();
  const remainingText = text.replace(match[0], '').trim();
  
  return { markdown, title, remainingText };
}

/**
 * Split text into segments, separating mindmap blocks from regular text
 * Returns array of { type: 'text' | 'mindmap', content: string, title?: string }
 * Supports both ``` and </mindmap> as closing tags
 */
export function splitTextAndMindmaps(text) {
  if (!text || typeof text !== 'string') return [{ type: 'text', content: '' }];
  
  const segments = [];
  // Match ```mindmap optionally followed by title="..." then whitespace/newline and content
  // Supports both ``` and </mindmap> as closing
  const regex = /```mindmap(?:\s+title="([^"]*)")?\s*\n([\s\S]*?)(?:```|<\/mindmap>)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the mindmap
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index).trim();
      if (textBefore) {
        segments.push({ type: 'text', content: textBefore });
      }
    }
    
    // Add the mindmap
    segments.push({
      type: 'mindmap',
      content: match[2].trim(),
      title: match[1] || null,
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last mindmap
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex).trim();
    if (remainingText) {
      segments.push({ type: 'text', content: remainingText });
    }
  }
  
  // If no mindmaps found, return original text
  if (segments.length === 0) {
    return [{ type: 'text', content: text }];
  }
  
  return segments;
}
