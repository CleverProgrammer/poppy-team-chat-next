'use client';

import { formatDistanceToNow } from 'date-fns';

export default function PostItem({ post, user, onDelete }) {
  const isOwnPost = post.senderId === user.uid;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className="post-item">
      <div className="post-header">
        <div className="post-author">
          <img
            src={post.photoURL || '/default-avatar.png'}
            alt={post.sender}
            className="post-avatar"
          />
          <div className="post-meta">
            <span className="post-sender">{post.sender}</span>
            <span className="post-timestamp">{formatTimestamp(post.timestamp)}</span>
            {post.edited && <span className="edited-badge">(edited)</span>}
          </div>
        </div>
        {isOwnPost && (
          <button
            className="delete-post-btn"
            onClick={() => onDelete(post.id)}
            title="Delete post"
          >
            ×
          </button>
        )}
      </div>

      {post.title && (
        <h3 className="post-title">{post.title}</h3>
      )}

      <div className="post-content">
        {post.content}
      </div>
    </div>
  );
}
