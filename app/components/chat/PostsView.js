'use client';

import { useState, useEffect } from 'react';
import { subscribeToPosts, createPost, deletePost, getDMId } from '../../lib/firestore';
import PostItem from './PostItem';
import PostComposer from './PostComposer';

export default function PostsView({ user, currentChat, onViewModeChange }) {
  const [posts, setPosts] = useState([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  useEffect(() => {
    if (!currentChat) return;

    const chatId = currentChat.type === 'dm'
      ? getDMId(user.uid, currentChat.id)
      : currentChat.id;

    const unsubscribe = subscribeToPosts(
      currentChat.type,
      chatId,
      (loadedPosts) => {
        setPosts(loadedPosts);
      }
    );

    return () => unsubscribe();
  }, [currentChat, user]);

  const handleCreatePost = async (title, content) => {
    const chatId = currentChat.type === 'dm'
      ? getDMId(user.uid, currentChat.id)
      : currentChat.id;

    try {
      await createPost(currentChat.type, chatId, user, title, content);
      setIsComposerOpen(false);
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
    }
  };

  const handleDeletePost = async (postId) => {
    const chatId = currentChat.type === 'dm'
      ? getDMId(user.uid, currentChat.id)
      : currentChat.id;

    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      await deletePost(currentChat.type, chatId, postId);
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    }
  };

  return (
    <div className="posts-view">
      <div className="posts-header">
        <button
          className="posts-back-btn"
          onClick={() => onViewModeChange?.('messages')}
        >
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
            <path
              d="M10 2L2 10L10 18"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Messages</span>
        </button>
        <h2>Posts</h2>
        <button
          className="create-post-btn"
          onClick={() => setIsComposerOpen(true)}
        >
          + New Post
        </button>
      </div>

      {isComposerOpen && (
        <PostComposer
          onSubmit={handleCreatePost}
          onCancel={() => setIsComposerOpen(false)}
        />
      )}

      <div className="posts-list">
        {posts.length === 0 ? (
          <div className="empty-posts">
            <p>No posts yet. Create one to get started!</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              user={user}
              onDelete={handleDeletePost}
            />
          ))
        )}
      </div>
    </div>
  );
}
