'use client';

import MessageTimestamp from './MessageTimestamp';
import { linkifyText } from '../../utils/messageFormatting';
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
  // Handle AI typing indicator
  if (msg.isTyping) {
    return (
      <div className="message-wrapper received ai-typing">
        <div className="message-sender">{msg.sender}</div>
        <div className="message">
          <div className="ai-typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    );
  }

  const isSent = msg.senderId === user?.uid;
  const reactions = msg.reactions || {};
  const reactionCounts = {};
  const userReactedWith = {};

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
        {msg.text && (
          <div className="text">
            {linkifyText(msg.text)}
            {msg.edited && <span className="edited-indicator"> (edited)</span>}
          </div>
        )}
        {isSent && (
          <div className="message-timestamp-sent">
            <MessageTimestamp timestamp={msg.timestamp} />
          </div>
        )}
      </div>

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

      {/* Read Receipt - Show for last message from each sender in DM */}
      {currentChat.type === 'dm' && msg.readBy && isLastMessageFromSender && (() => {
        // Determine the recipient (the other person in the DM)
        const recipientId = isSent ? currentChat.id : user.uid;
        const readTimestamp = msg.readBy[recipientId];

        if (!readTimestamp) return null;

        // Get the recipient's user data for avatar
        const recipientUser = isSent ? currentChat.user : (allUsers.find(u => u.uid === user.uid) || user);

        return (
          <div className="read-receipt">
            <span className="read-text">Read {new Date(readTimestamp.seconds * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            <img
              key={`avatar-${readTimestamp.seconds}`}
              src={recipientUser?.photoURL || ''}
              alt={recipientUser?.displayName || 'User'}
              className="read-receipt-avatar"
            />
          </div>
        );
      })()}
    </div>
  );
}
