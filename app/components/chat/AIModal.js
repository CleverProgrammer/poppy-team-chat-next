'use client';

import { useState, useRef, useEffect } from 'react';

export default function AIModal({ isOpen, onClose, onInsert, insertPosition }) {
  const [aiModalInput, setAiModalInput] = useState('');
  const [aiModalChat, setAiModalChat] = useState([]);
  const [aiModalProcessing, setAiModalProcessing] = useState(false);
  const aiModalInputRef = useRef(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => aiModalInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendAiModalMessage = async () => {
    if (!aiModalInput.trim() || aiModalProcessing) return;

    const userMessage = aiModalInput.trim();
    setAiModalProcessing(true);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          chatHistory: []
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.response;

      setAiModalChat([{ role: 'assistant', text: aiResponse }]);
    } catch (error) {
      console.error('AI Modal error:', error);
      setAiModalChat([{ role: 'assistant', text: `Sorry, I had a problem: ${error.message}. Try again!` }]);
    } finally {
      setAiModalProcessing(false);
    }
  };

  const handleInsert = () => {
    const aiMessage = aiModalChat.find(msg => msg.role === 'assistant');
    if (aiMessage) {
      onInsert(aiMessage.text, insertPosition);
      handleClose();
    }
  };

  const handleClose = () => {
    setAiModalInput('');
    setAiModalChat([]);
    setAiModalProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="ai-modal-overlay" onClick={handleClose} />
      <div className="ai-modal">
        <div className="ai-modal-header">
          <span>🤖</span>
          <h3>Ask Poppy</h3>
          <button className="ai-modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="ai-modal-body">
          <input
            ref={aiModalInputRef}
            type="text"
            className="ai-modal-input"
            value={aiModalInput}
            onChange={(e) => setAiModalInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendAiModalMessage();
              }
              if (e.key === 'Escape') {
                handleClose();
              }
            }}
            placeholder="What do you need help with?"
            disabled={aiModalProcessing}
          />

          {aiModalProcessing && (
            <div className="ai-modal-result loading">
              <div className="ai-typing">
                <span></span><span></span><span></span>
              </div>
              <span>Thinking...</span>
            </div>
          )}

          {!aiModalProcessing && aiModalChat.length > 0 && (
            <>
              <div className="ai-modal-result">
                {aiModalChat[0].text}
              </div>
              <div className="ai-modal-actions">
                <button onClick={handleInsert} className="ai-modal-btn primary">
                  Insert
                </button>
                <button onClick={handleClose} className="ai-modal-btn secondary">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
