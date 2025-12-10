'use client';

import { useState } from 'react';

export default function PostComposer({ onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit(title, content);
  };

  return (
    <div className="post-composer">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Post title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="post-title-input"
        />
        <textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="post-content-input"
          rows={6}
          autoFocus
        />
        <div className="post-composer-actions">
          <button type="button" onClick={onCancel} className="cancel-btn">
            Cancel
          </button>
          <button
            type="submit"
            className="submit-btn"
            disabled={!content.trim()}
          >
            Post
          </button>
        </div>
      </form>
    </div>
  );
}
