'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

const SUPPORTED_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/x-markdown': '.md'
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Document upload modal with drag-and-drop
 */
export default function DocumentUpload({ onUpload, onClose, uploading }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState(null)
  const [uploadStatus, setUploadStatus] = useState(null)

  const validateFile = (file) => {
    const errors = []
    
    if (!Object.keys(SUPPORTED_TYPES).includes(file.type)) {
      // Also check by extension as a fallback
      const ext = file.name.split('.').pop().toLowerCase()
      const validExtensions = ['pdf', 'docx', 'txt', 'md']
      if (!validExtensions.includes(ext)) {
        errors.push('Unsupported file type. Please upload PDF, DOCX, TXT, or Markdown files.')
      }
    }
    
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`)
    }
    
    return errors
  }

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError(null)
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      if (rejection.errors.some(e => e.code === 'file-too-large')) {
        setError('File is too large. Maximum size is 10MB.')
      } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
        setError('Unsupported file type. Please upload PDF, DOCX, TXT, or Markdown files.')
      } else {
        setError('Invalid file. Please try again.')
      }
      return
    }
    
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      const validationErrors = validateFile(file)
      
      if (validationErrors.length > 0) {
        setError(validationErrors.join(' '))
        return
      }
      
      setSelectedFile(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/x-markdown': ['.md']
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false
  })

  const handleUpload = async () => {
    if (!selectedFile) return
    
    setError(null)
    setUploadStatus('Uploading...')
    
    const result = await onUpload(selectedFile)
    
    if (result.success) {
      setUploadStatus('Processing document...')
      // The modal will be closed by the parent after successful upload
    } else {
      setError(result.error || 'Upload failed. Please try again.')
      setUploadStatus(null)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setError(null)
  }

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    switch (ext) {
      case 'pdf':
        return '📕'
      case 'docx':
        return '📘'
      case 'txt':
        return '📄'
      case 'md':
        return '📝'
      default:
        return '📄'
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Upload Document</h3>
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Dropzone */}
          {!selectedFile ? (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-gray-600 hover:border-gray-500 hover:bg-gray-750'
                }
              `}
            >
              <input {...getInputProps()} />
              <div className="text-4xl mb-4">📁</div>
              {isDragActive ? (
                <p className="text-blue-400">Drop the file here...</p>
              ) : (
                <>
                  <p className="text-gray-300 mb-2">
                    Drag and drop a file here, or click to browse
                  </p>
                  <p className="text-gray-500 text-sm">
                    Supported: PDF, DOCX, TXT, Markdown
                  </p>
                  <p className="text-gray-500 text-sm">
                    Max size: 10MB
                  </p>
                </>
              )}
            </div>
          ) : (
            /* Selected file preview */
            <div className="border border-gray-600 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getFileIcon(selectedFile.name)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                {!uploading && (
                  <button
                    onClick={handleRemoveFile}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                    title="Remove file"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              {uploadStatus && (
                <div className="mt-3 flex items-center gap-2 text-blue-400 text-sm">
                  <span className="animate-spin">⏳</span>
                  <span>{uploadStatus}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
