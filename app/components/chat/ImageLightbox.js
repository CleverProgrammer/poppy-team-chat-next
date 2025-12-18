'use client';

import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

// Custom CSS for the lightbox
const lightboxStyles = `
  .yarl__root {
    --yarl__color_backdrop: rgba(0, 0, 0, 0.9);
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
  @media (max-width: 768px) {
    .yarl__navigation_prev,
    .yarl__navigation_next {
      display: none;
    }
  }
`;

export default function ImageLightbox({ images, open, onClose, startIndex = 0 }) {
  // Convert image URLs to lightbox slide format
  const slides = images.map((url) => ({
    src: url,
  }));

  if (!open || slides.length === 0) return null;

  return (
    <>
      <style>{lightboxStyles}</style>
      <Lightbox
        open={open}
        close={onClose}
        slides={slides}
        index={startIndex}
        controller={{
          closeOnBackdropClick: true,
          closeOnPullDown: true,
        }}
        animation={{
          swipe: 250,
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
    </>
  );
}

