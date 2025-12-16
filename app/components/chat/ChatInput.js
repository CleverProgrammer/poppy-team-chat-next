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
        <div className="input-row">
          {/* Plus button for attachments (mobile) */}
          <button
            className="input-plus-btn"
            onClick={() => {
              const fileInput = document.querySelector('input[type="file"]');
              if (fileInput) fileInput.click();
            }}
            aria-label="Add attachment"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>

          <div className="input-field-wrapper">
            <textarea
              ref={inputRef}
              placeholder={editingMessage ? "Edit your message..." : "iMessage"}
              rows="1"
              onInput={handleTextareaChange}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck="true"
              name="chat-message-input"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />

            {/* Mic icon inside input (mobile) */}
            <button
              className="input-mic-btn"
              aria-label="Voice input (coming soon)"
              title="Voice input coming soon!"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 19V23M8 23H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <button
            className="input-send-btn"
            onClick={handleSend}
            disabled={sending}
          >
            {editingMessage ? '✓' : '➤'}
          </button>
        </div>
      </div>
    </>
  );
}
