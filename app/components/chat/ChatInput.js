'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { useWavesurfer } from '@wavesurfer/react'

export default function ChatInput({
  inputRef,
  editingMessage,
  replyingTo,
  sending,
  imagePreview,
  imagePreviews = [],
  imageFiles = [],
  mentionMenu,
  mentionMenuIndex,
  handleTextareaChange,
  handleKeyDown,
  handleSend,
  handleSendAudio,
  handleRemoveImage,
  handleRemoveImageAtIndex,
  cancelEdit,
  cancelReply,
  getMentionMenuItems,
  selectMentionItem,
  setMentionMenuIndex,
  onScrollToBottom,
  onKeyboardHeightChange,
}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [hasContent, setHasContent] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedAudio, setRecordedAudio] = useState(null) // Blob after stopping
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null) // Blob URL for WaveSurfer
  const [recordedDuration, setRecordedDuration] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [waveformData, setWaveformData] = useState([])
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [showComingSoonModal, setShowComingSoonModal] = useState(false)
  const recordingIntervalRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const isRecordingRef = useRef(false)
  const previewWaveformContainerRef = useRef(null)
  const tripleTapTimerRef = useRef(null)
  const tapCountRef = useRef(0)
  const lastTapTimeRef = useRef(0)

  // WaveSurfer for preview state - only initialize when we have audio URL
  const { wavesurfer: previewWavesurfer } = useWavesurfer({
    container: previewWaveformContainerRef,
    url: recordedAudioUrl || undefined,
    height: 24,
    waveColor: 'rgba(255, 255, 255, 0.5)',
    progressColor: 'rgba(255, 255, 255, 0.9)',
    barWidth: 2,
    barGap: 1,
    barRadius: 1,
    cursorWidth: 0,
    normalize: true,
    interact: false, // Disable interaction - we handle play/pause separately
    autoplay: false,
  })

  // Handle WaveSurfer events for preview playback
  useEffect(() => {
    if (!previewWavesurfer) return

    const subscriptions = [
      previewWavesurfer.on('play', () => setIsPlayingPreview(true)),
      previewWavesurfer.on('pause', () => setIsPlayingPreview(false)),
      previewWavesurfer.on('finish', () => setIsPlayingPreview(false)),
    ]

    return () => {
      subscriptions.forEach((unsub) => unsub())
    }
  }, [previewWavesurfer])

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
          console.log('⌨️ Keyboard height:', info.keyboardHeight)
          setKeyboardHeight(info.keyboardHeight)
          // Notify parent about keyboard height change
          if (onKeyboardHeightChange) {
            onKeyboardHeightChange(info.keyboardHeight)
          }
          // Scroll to bottom when keyboard shows (with delay for animation)
          if (onScrollToBottom) {
            setTimeout(() => onScrollToBottom(), 350)
          }
        })

        await Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardHeight(0)
          if (onKeyboardHeightChange) {
            onKeyboardHeightChange(0)
          }
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

  // Cleanup MediaRecorder on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [isRecording])

  const handleInput = e => {
    handleTextareaChange(e)
    setHasContent(e.target.value.trim().length > 0 || imagePreviews.length > 0)
  }

  // Handle triple tap to select all text (iOS)
  const handleTripleTap = useCallback((e) => {
    // Only handle on touch devices (iOS/mobile)
    if (!e.touches || e.touches.length === 0) return

    const now = Date.now()
    const timeSinceLastTap = now - lastTapTimeRef.current

    // Reset if too much time has passed (more than 500ms)
    if (timeSinceLastTap > 500) {
      tapCountRef.current = 0
    }

    tapCountRef.current++
    lastTapTimeRef.current = now

    // Clear existing timer
    if (tripleTapTimerRef.current) {
      clearTimeout(tripleTapTimerRef.current)
    }

    // If we've detected 3 taps, select all text
    if (tapCountRef.current >= 3) {
      e.preventDefault()
      e.stopPropagation()
      
      if (inputRef.current) {
        inputRef.current.focus()
        // Use setTimeout to ensure focus happens before selection
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.select()
          }
        }, 0)
        tapCountRef.current = 0 // Reset after selection
      }
      return
    }

    // Set a timer to reset tap count if no more taps come
    tripleTapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0
    }, 500)
  }, [])

  const onSend = e => {
    handleSend(e)
    setHasContent(false)
  }

  useEffect(() => {
    if (inputRef.current) {
      setHasContent(inputRef.current.value.trim().length > 0 || imagePreviews.length > 0)
    }
  }, [sending, imagePreviews])

  // Handle recording duration display and waveform visualization
  useEffect(() => {
    if (isRecording) {
      isRecordingRef.current = true
      setRecordingDuration(0)
      setWaveformData([])
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } else {
      isRecordingRef.current = false
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
      // Clean up audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setWaveformData([])
    }
    return () => {
      isRecordingRef.current = false
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRecording])

  // Update waveform visualization in real-time
  const updateWaveform = useCallback(() => {
    if (!analyserRef.current || !isRecordingRef.current) {
      return
    }

    try {
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyserRef.current.getByteFrequencyData(dataArray)

      // Sample the data to get ~20 bars for visualization
      const sampleSize = Math.floor(bufferLength / 20)
      const samples = []
      for (let i = 0; i < 20; i++) {
        let sum = 0
        const startIdx = i * sampleSize
        const endIdx = Math.min(startIdx + sampleSize, bufferLength)
        for (let j = startIdx; j < endIdx; j++) {
          sum += dataArray[j]
        }
        const avg = sum / (endIdx - startIdx)
        // Normalize to 0-100 for height percentage, with minimum height of 10%
        const normalized = Math.max(10, (avg / 255) * 100)
        samples.push(normalized)
      }

      setWaveformData(samples)
      
      // Continue animation loop
      if (isRecordingRef.current && analyserRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateWaveform)
      }
    } catch (error) {
      console.error('Error updating waveform:', error)
    }
  }, [])

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      })
      
      // Set up Web Audio API for real-time waveform visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)
      
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      microphone.connect(analyser)
      
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        
        // Close audio context
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close()
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        
        // Store the recorded audio for preview instead of sending immediately
        if (audioBlob.size > 0) {
          setRecordedAudio(audioBlob)
          setRecordedDuration(recordingDuration)
          // Create blob URL for WaveSurfer
          const blobUrl = URL.createObjectURL(audioBlob)
          setRecordedAudioUrl(blobUrl)
        }
        
        mediaRecorderRef.current = null
        audioChunksRef.current = []
        analyserRef.current = null
        audioContextRef.current = null
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      isRecordingRef.current = true
      setIsRecording(true)
      
      // Initialize with some default bars so something shows immediately
      setWaveformData(Array.from({ length: 20 }, () => 30))
      
      // Start waveform visualization after a small delay to ensure analyser is ready
      setTimeout(() => {
        if (analyserRef.current && isRecordingRef.current) {
          updateWaveform()
        }
      }, 50)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Failed to access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      isRecordingRef.current = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      // Don't clear recordingDuration - we'll use it for recordedDuration
    }
  }

  // Handle WaveSurfer events for preview playback
  useEffect(() => {
    if (!previewWavesurfer) return

    const subscriptions = [
      previewWavesurfer.on('play', () => setIsPlayingPreview(true)),
      previewWavesurfer.on('pause', () => setIsPlayingPreview(false)),
      previewWavesurfer.on('finish', () => setIsPlayingPreview(false)),
    ]

    return () => {
      subscriptions.forEach((unsub) => unsub())
    }
  }, [previewWavesurfer])

  const handlePlayPreview = () => {
    if (!previewWavesurfer) return
    previewWavesurfer.playPause()
  }

  const handleCancelRecording = () => {
    // Stop preview if playing
    if (previewWavesurfer) {
      previewWavesurfer.pause()
    }
    // Clean up blob URL
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl)
    }
    setIsPlayingPreview(false)
    setRecordedAudio(null)
    setRecordedAudioUrl(null)
    setRecordedDuration(0)
    setRecordingDuration(0)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewWavesurfer) {
        previewWavesurfer.destroy()
      }
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl)
      }
      if (tripleTapTimerRef.current) {
        clearTimeout(tripleTapTimerRef.current)
      }
    }
  }, [previewWavesurfer, recordedAudioUrl])

  const handleSendRecording = () => {
    if (recordedAudio && handleSendAudio) {
      handleSendAudio(recordedAudio, recordedDuration)
      handleCancelRecording()
    }
  }

  const isMobile = () => {
    return Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.innerWidth <= 768)
  }

  const handleMicClick = () => {
    // On mobile, show "coming soon" modal instead of recording
    if (isMobile()) {
      setShowComingSoonModal(true)
      return
    }
    
    // Desktop functionality - proceed with recording
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

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
              {replyingTo.text.length > 500
                ? replyingTo.text.substring(0, 500) + '...'
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
              {editingMessage.text.length > 500
                ? editingMessage.text.substring(0, 500) + '...'
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
                    {item.icon ? (
                      <img src={item.icon} alt={item.name} className='mention-avatar' style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                    ) : item.photoURL ? (
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

      {/* Recording Indicator - Recording State */}
      {isRecording && (
        <div className='recording-indicator recording-state'>
          <span className='recording-duration'>{formatDuration(recordingDuration)}</span>
          <div className='recording-waveform'>
            {waveformData.length > 0 ? (
              waveformData.map((height, index) => {
                // Convert percentage to pixels (container is 24px tall)
                const barHeight = Math.max(4, (height / 100) * 24)
                return (
                  <div
                    key={index}
                    className='waveform-bar recording-bar'
                    style={{
                      height: `${barHeight}px`,
                      minHeight: '4px',
                    }}
                  />
                )
              })
            ) : (
              // Show placeholder bars while initializing
              Array.from({ length: 20 }).map((_, index) => (
                <div key={index} className='waveform-bar recording-bar' style={{ height: '8px' }} />
              ))
            )}
          </div>
          <button
            className='recording-stop-btn'
            onClick={stopRecording}
            aria-label='Stop recording'
            title='Stop recording'
          >
            <div className='recording-stop-circle'>
              <div className='recording-stop-square'></div>
            </div>
          </button>
        </div>
      )}

      {/* Recording Indicator - Preview State (after stopping) */}
      {recordedAudio && !isRecording && (
        <div className='recording-indicator preview-state'>
          <button
            className='recording-cancel-btn'
            onClick={handleCancelRecording}
            aria-label='Cancel recording'
            title='Cancel'
          >
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M18 6L6 18M6 6l12 12' />
            </svg>
          </button>
          <button
            className='recording-play-btn'
            onClick={handlePlayPreview}
            aria-label={isPlayingPreview ? 'Pause preview' : 'Play preview'}
            title={isPlayingPreview ? 'Pause' : 'Play'}
          >
            {isPlayingPreview ? (
              <svg width='16' height='16' viewBox='0 0 24 24' fill='currentColor'>
                <rect x='6' y='4' width='4' height='16' />
                <rect x='14' y='4' width='4' height='16' />
              </svg>
            ) : (
              <svg width='16' height='16' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M8 5v14l11-7z' />
              </svg>
            )}
          </button>
          <div className='recording-waveform preview-waveform-container'>
            <div ref={previewWaveformContainerRef} style={{ width: '100%', height: '24px' }} />
          </div>
          <span className='recording-duration preview-duration'>{formatDuration(recordedDuration)}</span>
          <button
            className='recording-send-btn'
            onClick={handleSendRecording}
            aria-label='Send recording'
            title='Send'
          >
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M5 12h14M12 5l7 7-7 7' />
            </svg>
          </button>
        </div>
      )}

      {/* Input Section */}
      <div
        className='input-section'
        style={{
          bottom: keyboardHeight ? `${keyboardHeight - 20}px` : 0,
          paddingBottom: keyboardHeight ? '10px' : undefined,
          transition: 'bottom 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {imagePreviews.length > 0 && (
          <div className={`image-preview-container ${imagePreviews.length > 1 ? 'multi-image' : ''}`}>
            {imagePreviews.map((preview, index) => {
              const isVideo = imageFiles[index]?.type?.startsWith('video/');
              return (
                <div key={index} className='image-preview-wrapper'>
                  <img src={preview} alt={`Preview ${index + 1}`} className='image-preview' />
                  <button
                    onClick={() => handleRemoveImageAtIndex ? handleRemoveImageAtIndex(index) : handleRemoveImage()}
                    className='remove-image-btn-mini'
                    aria-label='Remove media'
                    type='button'
                  >
                    <svg width='8' height='8' viewBox='0 0 12 12' fill='none' stroke='white' strokeWidth='2.5' strokeLinecap='round'>
                      <path d='M2 2L10 10M10 2L2 10' />
                    </svg>
                  </button>
                  {isVideo && <div className='video-badge'>🎬</div>}
                </div>
              );
            })}
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
              onTouchStart={handleTripleTap}
              onFocus={() => {
                // Scroll to bottom when input is focused (for web mobile)
                // Native platforms use Capacitor Keyboard events instead
                if (onScrollToBottom && !Capacitor.isNativePlatform()) {
                  setTimeout(() => onScrollToBottom(), 300)
                }
              }}
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
                className={`input-mic-btn ${isRecording ? 'recording' : ''}`}
                onClick={handleMicClick}
                aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
                title={isRecording ? 'Tap to stop recording' : 'Tap to record voice message'}
              >
                {isRecording ? (
                  <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                    <rect x='6' y='6' width='12' height='12' rx='2' />
                  </svg>
                ) : (
                  <svg width='20' height='20' viewBox='0 0 24 24' fill='none'>
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
                )}
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

      {/* Coming Soon Modal for Mobile */}
      {showComingSoonModal && (
        <>
          <div 
            className='coming-soon-modal-overlay' 
            onClick={() => setShowComingSoonModal(false)}
          />
          <div className='coming-soon-modal'>
            <div className='coming-soon-modal-content'>
              <div className='coming-soon-modal-icon'>🎤</div>
              <h3 className='coming-soon-modal-title'>Voice Messages Coming Soon</h3>
              <p className='coming-soon-modal-text'>
                Voice messages are currently available on desktop. This feature will be coming to mobile soon!
              </p>
              <button 
                className='coming-soon-modal-button'
                onClick={() => setShowComingSoonModal(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
