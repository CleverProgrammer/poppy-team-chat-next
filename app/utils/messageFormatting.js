export function linkifyText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
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
