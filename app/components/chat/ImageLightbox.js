'use client';

import { useRef, useCallback, useEffect } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

// Custom CSS for the lightbox
const lightboxStyles = `
  .yarl__root {
    --yarl__color_backdrop: rgba(0, 0, 0, 0.95);
  }
  .yarl__slide_image {
    max-height: 90vh;
    max-width: 90vw;
    object-fit: contain;
  }
  .yarl__button {
    color: white;
    filter: drop-shadow(0 0 4px rgba(0,0,0,0.5));
  }
  .yarl__navigation_prev,
  .yarl__navigation_next {
    padding: 16px;
  }
  /* Make close button much bigger and easier to tap on mobile */
  .yarl__button_close {
    width: 48px !important;
    height: 48px !important;
    padding: 12px !important;
  }
  .yarl__button_close svg {
    width: 24px !important;
    height: 24px !important;
  }
  /* Zoom button styling */
  .yarl__button_zoom {
    color: white;
  }
  /* Hide navigation arrows on mobile (swipe to navigate) */
  @media (max-width: 768px) {
    .yarl__navigation_prev,
    .yarl__navigation_next {
      display: none;
    }
    /* Even bigger close button on mobile */
    .yarl__button_close {
      width: 56px !important;
      height: 56px !important;
      padding: 14px !important;
      margin: 8px !important;
    }
    .yarl__button_close svg {
      width: 28px !important;
      height: 28px !important;
    }
  }
  /* Zoom hint for mobile users */
  .zoom-hint {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    pointer-events: none;
    opacity: 0;
    animation: fadeInOut 3s ease-in-out;
    z-index: 10000;
  }
  @keyframes fadeInOut {
    0% { opacity: 0; }
    10% { opacity: 1; }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
`;

export default function ImageLightbox({ images, open, onClose, startIndex = 0 }) {
  const zoomRef = useRef(null);
  const touchStartRef = useRef(null);
  const touchCountRef = useRef(0);
  const hasMovedRef = useRef(false);
  
  // Convert image URLs to lightbox slide format
  const slides = images.map((url) => ({
    src: url,
  }));

  // Track touch gestures to distinguish taps from pinches/swipes
  useEffect(() => {
    if (!open) return;

    const handleTouchStart = (e) => {
      touchCountRef.current = e.touches.length;
      hasMovedRef.current = false;
      if (e.touches.length === 1) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          time: Date.now(),
        };
      } else {
        // Multi-touch (pinch) - not a tap
        touchStartRef.current = null;
      }
    };

    const handleTouchMove = (e) => {
      hasMovedRef.current = true;
      // If we started with a potential tap, check if we've moved too much
      if (touchStartRef.current && e.touches.length === 1) {
        const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
        const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
        // If moved more than 10px, it's not a tap
        if (dx > 10 || dy > 10) {
          touchStartRef.current = null;
        }
      } else {
        touchStartRef.current = null;
      }
    };

    const handleTouchEnd = () => {
      // Small delay to let the gesture complete
      setTimeout(() => {
        touchCountRef.current = 0;
      }, 100);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [open]);

  // Handle click on the slide - close only on deliberate single tap when not zoomed
  const handleSlideClick = useCallback(() => {
    // Check if this was a real tap (not end of pinch/swipe)
    const touchStart = touchStartRef.current;
    const now = Date.now();
    
    // Only close if:
    // 1. We're not zoomed in
    // 2. It was a single touch (not multi-touch/pinch)
    // 3. We haven't moved much (it's a tap, not a swipe)
    // 4. The tap was quick (less than 300ms)
    const currentZoom = zoomRef.current?.zoom;
    const isNotZoomed = !currentZoom || currentZoom <= 1;
    const wasQuickTap = touchStart && (now - touchStart.time) < 300;
    const wasSingleTouch = touchCountRef.current <= 1;
    const didNotMove = !hasMovedRef.current;
    
    if (isNotZoomed && wasSingleTouch && (wasQuickTap || didNotMove)) {
      onClose();
    }
    
    // Reset
    touchStartRef.current = null;
  }, [onClose]);

  if (!open || slides.length === 0) return null;

  return (
    <>
      <style>{lightboxStyles}</style>
      <Lightbox
        open={open}
        close={onClose}
        slides={slides}
        index={startIndex}
        plugins={[Zoom]}
        zoom={{
          ref: zoomRef,
          // Max zoom level (5x)
          maxZoomPixelRatio: 5,
          // Enable scroll wheel zoom on desktop
          scrollToZoom: true,
          // Enable double-click/double-tap to zoom
          zoomInMultiplier: 2,
        }}
        controller={{
          closeOnBackdropClick: true,
          closeOnPullDown: true,
        }}
        on={{
          // Close on deliberate single tap when not zoomed
          click: handleSlideClick,
        }}
        animation={{
          swipe: 250,
          zoom: 300,
        }}
        carousel={{
          finite: slides.length <= 1,
          preload: 2,
        }}
        render={{
          buttonPrev: slides.length <= 1 ? () => null : undefined,
          buttonNext: slides.length <= 1 ? () => null : undefined,
        }}
      />
      {/* Hint for first-time users */}
      <div className="zoom-hint" key={open ? 'open' : 'closed'}>
        📱 Pinch to zoom • Double-tap to zoom in
      </div>
    </>
  );
}
