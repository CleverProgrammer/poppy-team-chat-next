'use client';

export default function ImagePreviewModal({ imageUrl, onClose }) {
  if (!imageUrl) return null;

  return (
    <div className="image-modal" onClick={onClose}>
      <div className="image-modal-content">
        <img src={imageUrl} alt="Preview" />
        <button
          className="image-modal-close"
          onClick={onClose}
          aria-label="Close preview"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
