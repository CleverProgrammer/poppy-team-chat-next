'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import generateMediaThumbnail from 'browser-thumbnail-generator';

export function useImageUpload() {
  // Support multiple images
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Legacy single image getters for backwards compatibility
  const imagePreview = imagePreviews[0] || null;
  const imageFile = imageFiles[0] || null;

  const handleImageSelect = useCallback(async (file) => {
    // For videos, generate a thumbnail using the library
    if (file.type.startsWith('video/')) {
      try {
        const response = await generateMediaThumbnail({
          file,
          width: 200,
          height: 200,
          maintainAspectRatio: true,
          timestamp: 0.1
        });
        const thumbnailUrl = URL.createObjectURL(response.thumbnail);
        setImagePreviews(prev => [...prev, thumbnailUrl]);
        setImageFiles(prev => [...prev, file]);
      } catch (error) {
        console.error('Error generating video thumbnail:', error);
        // Fallback: just use a placeholder or the file URL
        setImagePreviews(prev => [...prev, URL.createObjectURL(file)]);
        setImageFiles(prev => [...prev, file]);
      }
    } else {
      // For images, use the original approach
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result]);
        setImageFiles(prev => [...prev, file]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Add multiple images/videos at once
  const handleMultipleImageSelect = useCallback((files) => {
    files.forEach(file => handleImageSelect(file));
  }, [handleImageSelect]);

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

  // Paste image/video handler
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('video') !== -1) {
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

  // Drag and drop handler - now supports multiple files including videos
  const onDrop = useCallback((acceptedFiles) => {
    const mediaFiles = acceptedFiles.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    if (mediaFiles.length > 0) {
      handleMultipleImageSelect(mediaFiles);
    }
  }, [handleMultipleImageSelect]);

  const { open, ...dropzoneProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.webm', '.m4v']
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
    dropzoneProps,
    openFilePicker: open, // Expose to trigger file picker programmatically
  };
}

