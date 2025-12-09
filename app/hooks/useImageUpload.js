'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';

export function useImageUpload() {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleImageSelect = useCallback((file) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
  }, []);

  const clearImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
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

  // Drag and drop handler
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type.startsWith('image/')) {
        handleImageSelect(file);
      }
    }
  }, [handleImageSelect]);

  const dropzoneProps = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    multiple: false,
    noClick: true,
    noKeyboard: true
  });

  return {
    imagePreview,
    imageFile,
    uploading,
    setUploading,
    handleImageSelect,
    handleRemoveImage,
    clearImage,
    dropzoneProps
  };
}
