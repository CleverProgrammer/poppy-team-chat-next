'use client'

import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

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
  setMentionMenuIndex,
}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let Keyboard
    const setupKeyboard = async () => {
      try {
        const capKeyboard = await import('@capacitor/keyboard')
        Keyboard = capKeyboard.Keyboard

        // Set resize mode to none to prevent webview resize lag
        await Keyboard.setResizeMode({ mode: 'none' })

        await Keyboard.addListener('keyboardWillShow', info => {
          setKeyboardHeight(info.keyboardHeight)
        })

        await Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardHeight(0)
        })
      } catch (error) {
        console.error('Failed to setup keyboard listeners:', error)
      }
    }

    setupKeyboard()

    return () => {
      if (Keyboard) {
        Keyboard.removeAllListeners()
      }
    }
  }, [])

  const handleInput = e => {
    handleTextareaChange(e)
    setHasContent(e.target.value.trim().length > 0)
  }

  const onSend = e => {
    handleSend(e)
    setHasContent(false)
  }

  useEffect(() => {
    if (inputRef.current) {
      setHasContent(inputRef.current.value.trim().length > 0)
    }
  }, [sending])

  return (
    <>
      {/* Reply Bar */}
      {replyingTo && (
        <div
          className='reply-bar active'
          style={{
            bottom: keyboardHeight ? `${keyboardHeight + 60}px` : undefined,
          }}
        >
          <div className='reply-bar-content'>
            <div className='reply-bar-sender'>
              Replying to {replyingTo.sender}
            </div>
            <div className='reply-bar-text'>
              {replyingTo.text.length > 50
                ? replyingTo.text.substring(0, 50) + '...'
                : replyingTo.text}
            </div>
          </div>
          <button className='reply-bar-close' onClick={cancelReply}>
            ✕
          </button>
        </div>
      )}

      {/* Edit Bar */}
      {editingMessage && (
        <div
          className='reply-bar active'
          style={{
            background: 'var(--bg-hover)',
            bottom: keyboardHeight ? `${keyboardHeight + 60}px` : undefined,
          }}
        >
          <div className='reply-bar-content'>
            <div className='reply-bar-sender'>Editing message</div>
            <div className='reply-bar-text'>
              {editingMessage.text.length > 50
                ? editingMessage.text.substring(0, 50) + '...'
                : editingMessage.text}
            </div>
          </div>
          <button className='reply-bar-close' onClick={cancelEdit}>
            ✕
          </button>
        </div>
      )}

      {/* Mention Menu */}
      {mentionMenu &&
        (() => {
          const items = getMentionMenuItems()
          return items.length > 0 ? (
            <div
              className='mention-menu'
              style={{
                bottom: keyboardHeight ? `${keyboardHeight + 80}px` : undefined,
              }}
            >
              <div className='mention-menu-title'>Mention</div>
              <div className='mention-menu-items'>
                {items.map((item, index) => (
                  <div
                    key={item.uid || item.type}
                    className={`mention-menu-item ${
                      index === mentionMenuIndex ? 'selected' : ''
                    }`}
                    onClick={() => selectMentionItem(item)}
                    onMouseEnter={() => setMentionMenuIndex(index)}
                  >
                    {item.photoURL ? (
                      <img
                        src={item.photoURL}
                        alt={item.name}
                        className='mention-avatar'
                      />
                    ) : (
                      <div className='mention-avatar-placeholder'>
                        {item.name.substring(0, 2)}
                      </div>
                    )}
                    <div className='mention-info'>
                      <div className='mention-name'>{item.name}</div>
                      {item.description && (
                        <div className='mention-description'>
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className='mention-menu-hint'>
                <kbd>↑</kbd> <kbd>↓</kbd> to navigate • <kbd>↵</kbd> or{' '}
                <kbd>Tab</kbd> to select • <kbd>Esc</kbd> to cancel
              </div>
            </div>
          ) : null
        })()}

      {/* Input Section */}
      <div
        className='input-section'
        style={{
          bottom: keyboardHeight ? `${keyboardHeight - 20}px` : 0,
          paddingBottom: keyboardHeight ? '10px' : undefined,
          transition: 'bottom 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {imagePreview && (
          <div className='image-preview-container'>
            <img src={imagePreview} alt='Preview' className='image-preview' />
            <button
              onClick={handleRemoveImage}
              className='remove-image-btn'
              aria-label='Remove image'
            >
              ✕
            </button>
          </div>
        )}
        <div className='input-row'>
          {/* Plus button for attachments (mobile) */}
          <button
            className='input-plus-btn'
            onClick={() => {
              const fileInput = document.querySelector('input[type="file"]')
              if (fileInput) fileInput.click()
            }}
            aria-label='Add attachment'
          >
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none'>
              <path
                d='M12 5V19M5 12H19'
                stroke='currentColor'
                strokeWidth='2.5'
                strokeLinecap='round'
              />
            </svg>
          </button>

          <div className='input-field-wrapper'>
            <textarea
              ref={inputRef}
              placeholder={
                editingMessage
                  ? 'Edit your message...'
                  : 'Message, press @ for AI'
              }
              rows='1'
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              autoComplete='off'
              autoCorrect='on'
              autoCapitalize='sentences'
              spellCheck='true'
              name='chat-message-input'
              data-form-type='other'
              data-lpignore='true'
              data-1p-ignore='true'
            />

            {/* Mic icon or Send icon inside input (mobile) */}
            {hasContent ? (
              <button
                onClick={onSend}
                aria-label='Send message'
                className='mobile-send-btn'
              >
                <div className='mobile-send-btn-inner'>
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='white'
                    strokeWidth='3'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <path d='m5 12 7-7 7 7' />
                    <path d='M12 19V5' />
                  </svg>
                </div>
              </button>
            ) : (
              <button
                className='input-mic-btn'
                aria-label='Voice input (coming soon)'
                title='Voice input coming soon!'
              >
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none'>
                  <path
                    d='M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M12 19V23M8 23H16'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </button>
            )}
          </div>

          <button
            className='input-send-btn'
            onClick={onSend}
            disabled={sending}
          >
            {editingMessage ? '✓' : '➤'}
          </button>
        </div>
      </div>
    </>
  )
}
