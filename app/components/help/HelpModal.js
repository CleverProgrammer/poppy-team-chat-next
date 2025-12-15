'use client';

import { useState, useEffect, useMemo } from 'react';
import { KEYBOARD_SHORTCUTS, FEATURES_GUIDE, GETTING_STARTED } from '../../constants/helpContent';

// Detect Mac at module level (safe for SSR since we provide default)
const getIsMac = () => {
  if (typeof navigator === 'undefined') return true;
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
};

export default function HelpModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('getting-started');
  
  // Use useMemo to detect Mac only on client side
  const isMac = useMemo(() => getIsMac(), []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatKeys = (keys) => {
    return keys.map(key => {
      if (key === 'Cmd/Ctrl') {
        return isMac ? '⌘' : 'Ctrl';
      }
      if (key === 'Shift') {
        return isMac ? '⇧' : 'Shift';
      }
      return key;
    });
  };

  const renderGettingStarted = () => (
    <div className="help-content-section">
      <div className="getting-started-header">
        <h3>{GETTING_STARTED.welcome}</h3>
        <p>{GETTING_STARTED.subtitle}</p>
      </div>
      
      <div className="quick-start-steps">
        {GETTING_STARTED.steps.map((step) => (
          <div key={step.number} className="quick-start-step">
            <div className="step-number">{step.number}</div>
            <div className="step-content">
              <h4>{step.title}</h4>
              <p>{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pro-tip">
        <span className="pro-tip-badge">Tip</span>
        <span>{GETTING_STARTED.tip}</span>
      </div>
    </div>
  );

  const renderShortcuts = () => (
    <div className="help-content-section">
      {KEYBOARD_SHORTCUTS.map((category) => (
        <div key={category.category} className="shortcuts-category">
          <h4 className="shortcuts-category-title">{category.category}</h4>
          <div className="shortcuts-list">
            {category.shortcuts.map((shortcut, idx) => (
              <div key={idx} className="shortcut-item">
                <div className="shortcut-keys">
                  {formatKeys(shortcut.keys).map((key, keyIdx) => (
                    <span key={keyIdx}>
                      <kbd>{key}</kbd>
                      {keyIdx < shortcut.keys.length - 1 && <span className="key-separator">+</span>}
                    </span>
                  ))}
                </div>
                <span className="shortcut-description">{shortcut.description}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderFeatures = () => (
    <div className="help-content-section features-section">
      {FEATURES_GUIDE.map((feature) => (
        <details key={feature.id} className="feature-item">
          <summary className="feature-header">
            <span className="feature-icon">{feature.icon}</span>
            <span className="feature-title">{feature.title}</span>
          </summary>
          <div className="feature-content">
            {feature.content.split('\n\n').map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );

  return (
    <>
      <div className="help-modal-overlay" onClick={onClose} />
      <div className="help-modal">
        <div className="help-modal-header">
          <span className="help-modal-icon">❓</span>
          <h3>Help & Shortcuts</h3>
          <button className="help-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="help-modal-tabs">
          <button 
            className={`help-tab ${activeTab === 'getting-started' ? 'active' : ''}`}
            onClick={() => setActiveTab('getting-started')}
          >
            Getting Started
          </button>
          <button 
            className={`help-tab ${activeTab === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            Shortcuts
          </button>
          <button 
            className={`help-tab ${activeTab === 'features' ? 'active' : ''}`}
            onClick={() => setActiveTab('features')}
          >
            Features
          </button>
        </div>

        <div className="help-modal-body">
          {activeTab === 'getting-started' && renderGettingStarted()}
          {activeTab === 'shortcuts' && renderShortcuts()}
          {activeTab === 'features' && renderFeatures()}
        </div>

        <div className="help-modal-footer">
          <span>Press</span>
          <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>
          <kbd>?</kbd>
          <span>anytime to open help</span>
        </div>
      </div>
    </>
  );
}
