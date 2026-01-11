'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import generateMediaThumbnail from 'browser-thumbnail-generator';

/**
 * Extract duration from an audio file using HTML Audio element
 * @param {File} file - Audio file to get duration from
 * @returns {Promise<number>} Duration in seconds
 */
export function getAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'metadata'
    
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src)
      resolve(audio.duration)
    }
    
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src)
      resolve(0) // Fallback to 0 if can't determine
    }
    
    audio.src = URL.createObjectURL(file)
  })
}

/**
 * Format duration in seconds to mm:ss format
 */
export function formatAudioDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function useImageUpload() {
  // Support multiple images
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Support multiple audio files (like images - for AI questions)
  // Each audio preview contains: { file, blobUrl, duration, name }
  const [audioPreviews, setAudioPreviews] = useState([]);
  const [audioFiles, setAudioFiles] = useState([]);

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

  // Handle audio file selection - extracts duration and creates preview
  const handleAudioSelect = useCallback(async (file) => {
    try {
      const duration = await getAudioDuration(file);
      const blobUrl = URL.createObjectURL(file);
      
      const audioPreview = {
        file,
        blobUrl,
        duration,
        name: file.name,
        type: file.type,
      };
      
      setAudioPreviews(prev => [...prev, audioPreview]);
      setAudioFiles(prev => [...prev, file]);
      console.log(`🎵 Audio file added: ${file.name} (${formatAudioDuration(duration)})`);
    } catch (error) {
      console.error('Error processing audio file:', error);
    }
  }, []);

  // Add multiple audio files at once
  const handleMultipleAudioSelect = useCallback((files) => {
    files.forEach(file => handleAudioSelect(file));
  }, [handleAudioSelect]);

  // Remove a specific audio by index
  const handleRemoveAudioAtIndex = useCallback((index) => {
    setAudioPreviews(prev => {
      // Revoke the blob URL to free memory
      if (prev[index]?.blobUrl) {
        URL.revokeObjectURL(prev[index].blobUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
    setAudioFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all audio files
  const clearAudio = useCallback(() => {
    // Revoke all blob URLs
    audioPreviews.forEach(preview => {
      if (preview.blobUrl) {
        URL.revokeObjectURL(preview.blobUrl);
      }
    });
    setAudioFiles([]);
    setAudioPreviews([]);
  }, [audioPreviews]);

  // Clear all media (images + audio)
  const clearAllMedia = useCallback(() => {
    clearImage();
    clearAudio();
  }, [clearImage, clearAudio]);

  // Paste image/video/audio handler - supports multiple files at once
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles = [];
      const audioFiles = [];

      // Collect all media files from clipboard
      for (let i = 0; i < items.length; i++) {
        const type = items[i].type;
        const file = items[i].getAsFile();
        if (!file) continue;

        if (type.startsWith('image/') || type.startsWith('video/')) {
          imageFiles.push(file);
        } else if (type.startsWith('audio/')) {
          audioFiles.push(file);
        }
      }

      // Handle all collected files
      if (imageFiles.length > 0 || audioFiles.length > 0) {
        e.preventDefault();
        
        imageFiles.forEach(file => handleImageSelect(file));
        audioFiles.forEach(file => handleAudioSelect(file));
        
        if (audioFiles.length > 0) {
          console.log(`📋 Pasted ${audioFiles.length} audio file(s)`);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleImageSelect, handleAudioSelect]);

  // Drag and drop handler - supports images, videos, AND audio files
  const onDrop = useCallback((acceptedFiles) => {
    // Separate audio files from other media
    const droppedAudioFiles = acceptedFiles.filter(file => file.type.startsWith('audio/'));
    const mediaFiles = acceptedFiles.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    
    // Handle audio files - add to state for preview (like images)
    if (droppedAudioFiles.length > 0) {
      handleMultipleAudioSelect(droppedAudioFiles);
    }
    
    // Handle images/videos as before
    if (mediaFiles.length > 0) {
      handleMultipleImageSelect(mediaFiles);
    }
  }, [handleMultipleImageSelect, handleMultipleAudioSelect]);

  const { open, ...dropzoneProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.webm', '.m4v'],
      'audio/*': ['.m4a', '.mp3', '.wav', '.aac', '.ogg', '.webm', '.caf', '.flac']
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
    // Audio file API (same pattern as images)
    audioPreviews,
    audioFiles,
    handleAudioSelect,
    handleMultipleAudioSelect,
    handleRemoveAudioAtIndex,
    clearAudio,
    clearAllMedia,
    // Dropzone
    dropzoneProps,
    openFilePicker: open, // Expose to trigger file picker programmatically
  };
}

