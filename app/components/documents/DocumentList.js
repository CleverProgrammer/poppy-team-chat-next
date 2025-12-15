'use client'

import { useState } from 'react'
import DocumentUpload from './DocumentUpload'

/**
 * Document list component with upload functionality
 */
export default function DocumentList({ 
  documents, 
  loading, 
  error, 
  onUpload, 
  onDelete,
  uploading,
  user 
}) {
  const [showUpload, setShowUpload] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const handleUpload = async (file) => {
    const result = await onUpload(file, user)
    if (result.success) {
      setShowUpload(false)
    }
    return result
  }

  const handleDelete = async (documentId) => {
    await onDelete(documentId)
    setDeleteConfirm(null)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ready':
        return '✅'
      case 'processing':
        return '⏳'
      case 'error':
        return '❌'
      default:
        return '📄'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'ready':
        return 'Indexed'
      case 'processing':
        return 'Processing...'
      case 'error':
        return 'Error'
      default:
        return status
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-400">
        Loading documents...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Documents</h2>
        <button
          onClick={() => setShowUpload(true)}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
        >
          + Upload
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 m-4 bg-red-500/20 border border-red-500 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-4">
        {documents.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="text-4xl mb-4">📁</p>
            <p>No documents yet</p>
            <p className="text-sm mt-2">Upload PDFs, DOCX, TXT, or Markdown files to build your knowledge base</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="text-xl flex-shrink-0">
                      {getStatusIcon(doc.status)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium truncate" title={doc.filename}>
                        {doc.filename}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{formatFileSize(doc.size)}</span>
                        <span>•</span>
                        <span>{getStatusText(doc.status)}</span>
                        {doc.chunkCount && (
                          <>
                            <span>•</span>
                            <span>{doc.chunkCount} chunks</span>
                          </>
                        )}
                        {doc.pageCount && (
                          <>
                            <span>•</span>
                            <span>{doc.pageCount} pages</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Uploaded by {doc.uploadedByName} • {formatDate(doc.uploadedAt)}
                      </div>
                      {doc.status === 'error' && doc.errorMessage && (
                        <div className="text-xs text-red-400 mt-1">
                          Error: {doc.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-2">
                    {doc.downloadUrl && (
                      <a
                        href={doc.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title="Download"
                      >
                        ⬇️
                      </a>
                    )}
                    {deleteConfirm === doc.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(doc.id)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <DocumentUpload
          onUpload={handleUpload}
          onClose={() => setShowUpload(false)}
          uploading={uploading}
        />
      )}
    </div>
  )
}
