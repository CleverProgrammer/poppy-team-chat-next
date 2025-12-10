'use client';

import { formatDistanceToNow } from 'date-fns';

export default function PostPreview({ post, onClick }) {
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
    <div className="post-preview" onClick={onClick}>
      <div className="post-preview-badge">📌 Post</div>
      <div className="post-preview-header">
        <img
          src={post.photoURL || '/default-avatar.png'}
          alt={post.sender}
          className="post-preview-avatar"
        />
        <div>
          <span className="post-preview-sender">{post.sender}</span>
          <span className="post-preview-timestamp">{formatTimestamp(post.timestamp)}</span>
        </div>
      </div>
      {post.title && (
        <div className="post-preview-title">{post.title}</div>
      )}
      <div className="post-preview-content">
        {truncateContent(post.content)}
      </div>
      <div className="post-preview-action">Click to view full post →</div>
    </div>
  );
}
