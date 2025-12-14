'use client';

import { useState } from 'react';
import MessageTimestamp from './MessageTimestamp';
import { linkifyText, isSingleEmoji, isLoomUrl, getLoomEmbedUrl } from '../../utils/messageFormatting';
import { ALL_EMOJIS } from '../../constants/emojis';

export default function MessageItem({
  msg,
  index,
  messages,
  totalMessages,
  user,
  currentChat,
  allUsers,
  replyingTo,
  topReactions,
  openEmojiPanel,
  onReply,
  onEdit,
  onAddReaction,
  onToggleEmojiPanel,
  onImageClick,
  onScrollToMessage,
  onContextMenu,
  messageRef
}) {
  const [copied, setCopied] = useState(false);

  // Copy message text to clipboard
  const handleCopy = async () => {
    if (msg.text) {
      try {
        await navigator.clipboard.writeText(msg.text.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };
  // Handle AI typing indicator
  if (msg.isTyping) {
    return (
      <div className="message-wrapper received ai-typing">
        <div className="message-sender">{msg.sender}</div>
        <div className="message">
          <div className="ai-typing-with-status">
            <div className="ai-typing-indicator">
              <span></span><span></span><span></span>
            </div>
            {msg.text && (
              <div className="ai-status-text">{msg.text}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isSent = msg.senderId === user?.uid;
  const reactions = msg.reactions || {};
  const reactionCounts = {};
  const userReactedWith = {};
  const isJumboEmoji = msg.text && !msg.imageUrl && isSingleEmoji(msg.text);

  // Count reactions
  Object.entries(reactions).forEach(([userId, emoji]) => {
    if (!reactionCounts[emoji]) {
      reactionCounts[emoji] = { count: 0, userIds: [] };
    }
    reactionCounts[emoji].count++;
    reactionCounts[emoji].userIds.push(userId);
    if (userId === user?.uid) {
      userReactedWith[emoji] = true;
    }
  });

  const isReplyTarget = replyingTo?.msgId === msg.id;
  const isLastMessage = index === totalMessages - 1;

  // Find the last message from this specific sender
  let isLastMessageFromSender = true;
  for (let i = index + 1; i < totalMessages; i++) {
    if (messages[i].senderId === msg.senderId) {
      isLastMessageFromSender = false;
      break;
    }
  }

  // Render jumbo emoji differently (no bubble)
  if (isJumboEmoji) {
    return (
      <div
        ref={messageRef}
        data-msg-id={msg.id}
        className={`message-wrapper ${isSent ? 'sent' : 'received'} jumbo-emoji-wrapper`}
        onContextMenu={(e) => onContextMenu(e, msg)}
      >
        <div className="jumbo-emoji">
          {msg.text}
        </div>
        {isSent && (
          <div className="message-timestamp-sent">
            <MessageTimestamp timestamp={msg.timestamp} />
          </div>
        )}
        {!isSent && (
          <div className="message-timestamp-received">
            <MessageTimestamp timestamp={msg.timestamp} />
          </div>
        )}

        {/* Quick Reactions for jumbo emoji */}
        <div className={`quick-reactions ${isSent ? 'sent' : 'received'}`}>
          <div className="quick-reactions-row">
            <button className="reply-btn" onClick={() => onReply(msg.id, msg.sender, msg.text)} title="Reply">
              ↩
            </button>
            {isSent && (
              <button className="edit-btn" onClick={() => onEdit(msg.id, msg.text)} title="Edit">
                ✎
              </button>
            )}
            {topReactions.slice(0, isSent ? 4 : 5).map(emoji => (
              <span key={emoji} onClick={() => onAddReaction(msg.id, emoji)}>
                {emoji}
              </span>
            ))}
          </div>
          <div className="quick-reactions-row">
            {topReactions.slice(isSent ? 4 : 5, 10).map(emoji => (
              <span key={emoji} onClick={() => onAddReaction(msg.id, emoji)}>
                {emoji}
              </span>
            ))}
            <button className="more-reactions-btn" onClick={(e) => { e.stopPropagation(); onToggleEmojiPanel(msg.id); }}>
              +
            </button>
          </div>
        </div>

        {/* Emoji Panel */}
        {openEmojiPanel === msg.id && (
          <div className="emoji-panel" onClick={(e) => e.stopPropagation()}>
            <div className="emoji-panel-title">Reactions</div>
            <div className="emoji-grid">
              {ALL_EMOJIS.map(emoji => (
                <span key={emoji} onClick={() => onAddReaction(msg.id, emoji)}>
                  {emoji}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reaction Badges */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="reactions-display">
            {Object.entries(reactionCounts).map(([emoji, data]) => (
              <div
                key={emoji}
                className={`reaction-badge ${userReactedWith[emoji] ? 'user-reacted' : ''}`}
                onClick={() => onAddReaction(msg.id, emoji)}
              >
                <span>{emoji}</span>
                <span className="reaction-count">{data.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={messageRef}
      data-msg-id={msg.id}
      className={`message-wrapper ${isSent ? 'sent' : 'received'} ${isReplyTarget ? 'reply-target' : ''}`}
      onContextMenu={(e) => onContextMenu(e, msg)}
    >
      {!isSent && (
        <div className="message-sender">
          {msg.sender}
          <MessageTimestamp timestamp={msg.timestamp} />
        </div>
      )}
      <div className="message">
        {msg.replyTo && (
          <div className="reply-preview" onClick={() => onScrollToMessage(msg.replyTo.msgId)}>
            <div className="reply-sender">{msg.replyTo.sender}</div>
            <div className="reply-text">{msg.replyTo.text}</div>
          </div>
        )}
        {msg.imageUrl && (
          <img
            src={msg.imageUrl}
            alt="Shared image"
            className="message-image"
            loading="lazy"
            onClick={() => onImageClick(msg.imageUrl)}
          />
        )}
        {/* Loom video embed */}
        {msg.text && isLoomUrl(msg.text) && (
          <div className="loom-container">
            <iframe
              src={getLoomEmbedUrl(msg.text)}
              loading="lazy"
              allowFullScreen
              title="Loom video"
            />
          </div>
        )}
        {msg.text && (
          <div className="text">
            {linkifyText(msg.text)}
            {msg.edited && <span className="edited-indicator"> (edited)</span>}
          </div>
        )}

        {/* Copy button - only show if there's text */}
        {msg.text && (
          <button
            className="copy-message-btn"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy message"}
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
        )}
      </div>
      {isSent && (
        <div className="message-timestamp-sent">
          <MessageTimestamp timestamp={msg.timestamp} />
        </div>
      )}

      {/* Quick Reactions */}
      <div className={`quick-reactions ${isSent ? 'sent' : 'received'}`}>
        {/* First Row: Reply + Edit (if own message) + emojis */}
        <div className="quick-reactions-row">
          <button className="reply-btn" onClick={() => onReply(msg.id, msg.sender, msg.text)} title="Reply">
            ↩
          </button>
          {isSent && (
            <button className="edit-btn" onClick={() => onEdit(msg.id, msg.text)} title="Edit">
              ✎
            </button>
          )}
          {topReactions.slice(0, isSent ? 4 : 5).map(emoji => (
            <span key={emoji} onClick={() => onAddReaction(msg.id, emoji)}>
              {emoji}
            </span>
          ))}
        </div>

        {/* Second Row: emojis + More button */}
        <div className="quick-reactions-row">
          {topReactions.slice(isSent ? 4 : 5, 10).map(emoji => (
            <span key={emoji} onClick={() => onAddReaction(msg.id, emoji)}>
              {emoji}
            </span>
          ))}
          <button className="more-reactions-btn" onClick={(e) => { e.stopPropagation(); onToggleEmojiPanel(msg.id); }}>
            +
          </button>
        </div>
      </div>

      {/* Emoji Panel */}
      {openEmojiPanel === msg.id && (
        <div className="emoji-panel" onClick={(e) => e.stopPropagation()}>
          <div className="emoji-panel-title">Reactions</div>
          <div className="emoji-grid">
            {ALL_EMOJIS.map(emoji => (
              <span key={emoji} onClick={() => onAddReaction(msg.id, emoji)}>
                {emoji}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reactions Display */}
      {Object.keys(reactionCounts).length > 0 && (
        <div className="reactions-display">
          {Object.entries(reactionCounts).map(([emoji, data]) => {
            const reactedUsers = data.userIds.map(uid => allUsers.find(u => u.uid === uid)).filter(Boolean);

            return (
              <div
                key={emoji}
                className={`reaction-badge ${userReactedWith[emoji] ? 'mine' : ''}`}
                onClick={() => onAddReaction(msg.id, emoji)}
              >
                {emoji}
                <span className="count">{data.count}</span>

                {/* Reaction tooltip with user avatars */}
                <div className="reaction-tooltip">
                  <div className="reaction-tooltip-avatars">
                    {reactedUsers.map(reactedUser => (
                      <img
                        key={reactedUser.uid}
                        src={reactedUser.photoURL || ''}
                        alt={reactedUser.displayName}
                        className="reaction-tooltip-avatar"
                        title={reactedUser.displayName || reactedUser.email}
                      />
                    ))}
                  </div>
                  <div className="reaction-tooltip-names">
                    {reactedUsers.map(u => u.displayName || u.email).join(', ')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Read Receipt - Only show on messages I sent that were read by the other person */}
      {isSent && currentChat.type === 'dm' && msg.readBy && msg.readBy[currentChat.id] && isLastMessageFromSender && (
        <div className="read-receipt">
          <span className="read-text">Read {new Date(msg.readBy[currentChat.id].seconds * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          <img
            src={currentChat.user?.photoURL || ''}
            alt={currentChat.user?.displayName || 'User'}
            className="read-receipt-avatar"
          />
        </div>
      )}
    </div>
  );
}
