'use client';

import { formatDistanceToNow } from 'date-fns';

export default function PostPreview({ post, onClick, onContextMenu }) {
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

  const handleContextMenu = (e) => {
    if (onContextMenu) {
      onContextMenu(e, post);
    }
  };

  return (
    <div
      className="post-as-message"
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      <div className="post-label">📌 Post</div>
      <div className="message-sender">
        {post.sender}
        <span className="message-timestamp">{formatTimestamp(post.timestamp)}</span>
      </div>
      <div className="message">
        {post.title && (
          <div className="post-title">{post.title}</div>
        )}
        <div className="text">
          {truncateContent(post.content)}
        </div>
      </div>
    </div>
  );
}
