'use client';

import { formatDistanceToNow } from 'date-fns';

export default function PostPreview({ post, onClick, isViewed }) {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Just now';
    }
  };

  const truncateContent = (text, maxLength = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className={`post-preview-message ${isViewed ? 'viewed' : 'unviewed'}`} onClick={onClick}>
      <div className="post-banner">📌 Post</div>
      <div className="message-content-wrapper">
        <img
          src={post.photoURL || '/default-avatar.png'}
          alt={post.sender}
          className="message-avatar"
        />
        <div className="message-text-content">
          <div className="message-header">
            <span className="message-sender">{post.sender}</span>
            <span className="message-timestamp">{formatTimestamp(post.timestamp)}</span>
          </div>
          {post.title && (
            <div className="post-message-title">{post.title}</div>
          )}
          <div className="post-message-text">
            {truncateContent(post.content)}
          </div>
          <div className="post-click-hint">Click to view full post →</div>
        </div>
      </div>
    </div>
  );
}
