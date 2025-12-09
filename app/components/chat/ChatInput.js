'use client';

export default function ChatInput({
  inputRef,
  editingMessage,
  replyingTo,
  sending,
  imagePreview,
  mentionMenu,
  mentionMenuIndex,
  handleTextareaChange,
  handleKeyDown,
  handleSend,
  handleRemoveImage,
  cancelEdit,
  cancelReply,
  getMentionMenuItems,
  selectMentionItem,
  setMentionMenuIndex
}) {
  return (
    <>
      {/* Reply Bar */}
      {replyingTo && (
        <div className="reply-bar active">
          <div className="reply-bar-content">
            <div className="reply-bar-sender">Replying to {replyingTo.sender}</div>
            <div className="reply-bar-text">{replyingTo.text.length > 50 ? replyingTo.text.substring(0, 50) + '...' : replyingTo.text}</div>
          </div>
          <button className="reply-bar-close" onClick={cancelReply}>
            ✕
          </button>
        </div>
      )}

      {/* Edit Bar */}
      {editingMessage && (
        <div className="reply-bar active" style={{ background: 'var(--bg-hover)' }}>
          <div className="reply-bar-content">
            <div className="reply-bar-sender">Editing message</div>
            <div className="reply-bar-text">{editingMessage.text.length > 50 ? editingMessage.text.substring(0, 50) + '...' : editingMessage.text}</div>
          </div>
          <button className="reply-bar-close" onClick={cancelEdit}>
            ✕
          </button>
        </div>
      )}

      {/* Mention Menu */}
      {mentionMenu && (() => {
        const items = getMentionMenuItems();
        return items.length > 0 ? (
          <div className="mention-menu">
            <div className="mention-menu-title">Mention</div>
            <div className="mention-menu-items">
              {items.map((item, index) => (
                <div
                  key={item.uid || item.type}
                  className={`mention-menu-item ${index === mentionMenuIndex ? 'selected' : ''}`}
                  onClick={() => selectMentionItem(item)}
                  onMouseEnter={() => setMentionMenuIndex(index)}
                >
                  {item.photoURL ? (
                    <img src={item.photoURL} alt={item.name} className="mention-avatar" />
                  ) : (
                    <div className="mention-avatar-placeholder">
                      {item.name.substring(0, 2)}
                    </div>
                  )}
                  <div className="mention-info">
                    <div className="mention-name">{item.name}</div>
                    {item.description && (
                      <div className="mention-description">{item.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mention-menu-hint">
              <kbd>↑</kbd> <kbd>↓</kbd> to navigate • <kbd>↵</kbd> or <kbd>Tab</kbd> to select • <kbd>Esc</kbd> to cancel
            </div>
          </div>
        ) : null;
      })()}

      {/* Input Section */}
      <div className="input-section">
        {imagePreview && (
          <div className="image-preview-container">
            <img src={imagePreview} alt="Preview" className="image-preview" />
            <button
              onClick={handleRemoveImage}
              className="remove-image-btn"
              aria-label="Remove image"
            >
              ✕
            </button>
          </div>
        )}
        <textarea
          ref={inputRef}
          placeholder={editingMessage ? "Edit your message..." : "Type a message... (or paste/drop an image)"}
          rows="1"
          onInput={handleTextareaChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        <button
          onClick={handleSend}
          disabled={sending}
        >
          {editingMessage ? '✓' : '➤'}
        </button>
      </div>
    </>
  );
}
