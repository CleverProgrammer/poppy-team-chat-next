'use client';

/**
 * Rich copy utility for messages - copies text and media to clipboard
 * Supports images, videos (as thumbnails), and text
 */

/**
 * Fetch an image and return it as a Blob
 */
async function fetchImageAsBlob(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');
    return await response.blob();
  } catch (err) {
    console.error('Failed to fetch image:', err);
    return null;
  }
}

/**
 * Convert image blob to PNG for clipboard compatibility
 * The clipboard API requires image/png for images
 */
async function convertToPng(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          resolve(pngBlob);
        } else {
          reject(new Error('Failed to convert to PNG'));
        }
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.crossOrigin = 'anonymous';
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Get video thumbnail URL from Mux
 */
function getMuxThumbnailUrl(playbackId, width = 640) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${width}&fit_mode=preserve`;
}

/**
 * Build plain text representation of the message (fallback)
 */
function buildPlainText(message) {
  const parts = [];
  
  // Add text content
  const text = message?.text || message?.content;
  if (text) {
    parts.push(text.trim());
  }
  
  // Add image URLs
  const imageUrls = message?.imageUrls || (message?.imageUrl ? [message.imageUrl] : []);
  if (imageUrls.length > 0) {
    imageUrls.forEach(url => parts.push(url));
  }
  
  // Add video URLs (Mux stream URLs)
  if (message?.muxPlaybackIds?.length > 0) {
    message.muxPlaybackIds.forEach(id => {
      parts.push(`https://stream.mux.com/${id}.m3u8`);
    });
  }
  
  // Add audio URL
  if (message?.audioUrl) {
    parts.push(message.audioUrl);
  }
  
  return parts.join('\n');
}

/**
 * Build HTML representation of the message for rich paste
 */
function buildHtml(message) {
  const parts = [];
  
  // Add text content
  const text = message?.text || message?.content;
  if (text) {
    // Convert newlines to <br> for HTML
    parts.push(`<p>${text.trim().replace(/\n/g, '<br>')}</p>`);
  }
  
  // Add images
  const imageUrls = message?.imageUrls || (message?.imageUrl ? [message.imageUrl] : []);
  if (imageUrls.length > 0) {
    imageUrls.forEach(url => {
      parts.push(`<img src="${url}" alt="Shared image" style="max-width: 400px; border-radius: 12px; margin: 4px 0;" />`);
    });
  }
  
  // Add video thumbnails with play overlay
  if (message?.muxPlaybackIds?.length > 0) {
    message.muxPlaybackIds.forEach(id => {
      const thumbUrl = getMuxThumbnailUrl(id);
      const streamUrl = `https://stream.mux.com/${id}.m3u8`;
      parts.push(`<a href="${streamUrl}"><img src="${thumbUrl}" alt="Video" style="max-width: 400px; border-radius: 12px; margin: 4px 0;" /></a>`);
    });
  }
  
  // Add audio reference
  if (message?.audioUrl) {
    const duration = message.audioDuration 
      ? `${Math.floor(message.audioDuration / 60)}:${String(Math.floor(message.audioDuration % 60)).padStart(2, '0')}`
      : '';
    parts.push(`<p>🎤 Voice message ${duration}</p>`);
  }
  
  return parts.join('\n');
}

/**
 * Copy message content to clipboard with rich media support
 * @param {Object} message - The message object to copy
 * @returns {Promise<boolean>} - Whether the copy was successful
 */
export async function copyMessageRich(message) {
  if (!message) return false;
  
  try {
    // Build text and HTML representations
    const plainText = buildPlainText(message);
    const html = buildHtml(message);
    
    // Get all image URLs (including video thumbnails)
    const imageUrls = message?.imageUrls || (message?.imageUrl ? [message.imageUrl] : []);
    const videoThumbnailUrls = (message?.muxPlaybackIds || []).map(id => getMuxThumbnailUrl(id));
    const allImageUrls = [...imageUrls, ...videoThumbnailUrls];
    
    // Try to use the modern ClipboardItem API for rich content
    if (typeof ClipboardItem !== 'undefined' && allImageUrls.length > 0) {
      try {
        // For single image messages without text, copy just the image
        if (allImageUrls.length === 1 && !plainText.includes('\n')) {
          const blob = await fetchImageAsBlob(allImageUrls[0]);
          if (blob) {
            // Convert to PNG for clipboard compatibility
            const pngBlob = await convertToPng(blob);
            
            const clipboardItems = [
              new ClipboardItem({
                'image/png': pngBlob,
                'text/plain': new Blob([plainText], { type: 'text/plain' }),
                'text/html': new Blob([html], { type: 'text/html' }),
              })
            ];
            
            await navigator.clipboard.write(clipboardItems);
            return true;
          }
        }
        
        // For multiple images or text + image, copy HTML + text
        // (Multiple images in ClipboardItem isn't well supported)
        const clipboardItems = [
          new ClipboardItem({
            'text/plain': new Blob([plainText], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          })
        ];
        
        await navigator.clipboard.write(clipboardItems);
        return true;
      } catch (clipboardErr) {
        console.warn('ClipboardItem failed, falling back to text:', clipboardErr);
      }
    }
    
    // Fallback: just copy plain text
    await navigator.clipboard.writeText(plainText);
    return true;
  } catch (err) {
    console.error('Failed to copy message:', err);
    
    // Ultimate fallback: try simple text copy
    try {
      const text = message?.text || message?.content || '';
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Check if a message has any copyable content
 */
export function hasAnyContent(message) {
  if (!message) return false;
  
  return !!(
    message.text ||
    message.content ||
    message.imageUrl ||
    message.imageUrls?.length > 0 ||
    message.muxPlaybackIds?.length > 0 ||
    message.audioUrl
  );
}

