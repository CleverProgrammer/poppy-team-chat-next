'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';

export function useImageUpload() {
  // Support multiple images
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Legacy single image getters for backwards compatibility
  const imagePreview = imagePreviews[0] || null;
  const imageFile = imageFiles[0] || null;

  const handleImageSelect = useCallback((file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviews(prev => [...prev, reader.result]);
      setImageFiles(prev => [...prev, file]);
    };
    reader.readAsDataURL(file);
  }, []);

  // Add multiple images at once
  const handleMultipleImageSelect = useCallback((files) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result]);
        setImageFiles(prev => [...prev, file]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Remove a specific image by index
  const handleRemoveImageAtIndex = useCallback((index) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Legacy remove (removes first image)
  const handleRemoveImage = useCallback(() => {
    handleRemoveImageAtIndex(0);
  }, [handleRemoveImageAtIndex]);

  const clearImage = useCallback(() => {
    setImageFiles([]);
    setImagePreviews([]);
  }, []);

  // Paste image handler
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            handleImageSelect(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleImageSelect]);

  // Drag and drop handler - now supports multiple files
  const onDrop = useCallback((acceptedFiles) => {
    const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      handleMultipleImageSelect(imageFiles);
    }
  }, [handleMultipleImageSelect]);

  const dropzoneProps = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    multiple: true, // Allow multiple files
    noClick: true,
    noKeyboard: true
  });

  return {
    // Legacy single-image API
    imagePreview,
    imageFile,
    // New multi-image API
    imagePreviews,
    imageFiles,
    uploading,
    setUploading,
    handleImageSelect,
    handleMultipleImageSelect,
    handleRemoveImage,
    handleRemoveImageAtIndex,
    clearImage,
    dropzoneProps
  };
}

