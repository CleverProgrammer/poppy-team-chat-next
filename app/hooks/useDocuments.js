'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook for managing documents (upload, list, delete)
 */
export function useDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)

  // Fetch all documents
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/documents')
      const data = await response.json()
      
      if (data.success) {
        setDocuments(data.documents)
      } else {
        setError(data.error || 'Failed to fetch documents')
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load documents on mount
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Upload a document
  const uploadDocument = useCallback(async (file, user) => {
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    try {
      setUploading(true)
      setUploadProgress({ status: 'uploading', message: 'Uploading file...' })
      setError(null)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', user.uid)
      formData.append('userName', user.displayName || user.email)

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setUploadProgress({ status: 'processing', message: 'Processing document...' })
        
        // Add the new document to the list
        setDocuments(prev => [data.document, ...prev])
        
        // Start polling for status updates
        pollDocumentStatus(data.document.id)
        
        return { success: true, document: data.document }
      } else {
        setError(data.error)
        return { success: false, error: data.error }
      }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }, [])

  // Poll for document processing status
  const pollDocumentStatus = useCallback(async (documentId) => {
    const maxAttempts = 60 // 5 minutes max
    let attempts = 0

    const poll = async () => {
      if (attempts >= maxAttempts) {
        console.warn('Document processing polling timed out')
        return
      }

      try {
        const response = await fetch(`/api/documents/${documentId}`)
        const data = await response.json()

        if (data.success && data.document) {
          // Update the document in the list
          setDocuments(prev => 
            prev.map(doc => 
              doc.id === documentId ? data.document : doc
            )
          )

          // If still processing, poll again
          if (data.document.status === 'processing') {
            attempts++
            setTimeout(poll, 5000) // Poll every 5 seconds
          }
        }
      } catch (err) {
        console.error('Error polling document status:', err)
      }
    }

    // Start polling after a delay
    setTimeout(poll, 3000)
  }, [])

  // Delete a document
  const deleteDocument = useCallback(async (documentId) => {
    try {
      setError(null)

      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        // Remove from local state
        setDocuments(prev => prev.filter(doc => doc.id !== documentId))
        return { success: true }
      } else {
        setError(data.error)
        return { success: false, error: data.error }
      }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    }
  }, [])

  // Get document by ID
  const getDocument = useCallback((documentId) => {
    return documents.find(doc => doc.id === documentId)
  }, [documents])

  // Get documents count by status
  const getStatusCounts = useCallback(() => {
    const counts = {
      total: documents.length,
      ready: 0,
      processing: 0,
      error: 0
    }

    documents.forEach(doc => {
      if (counts[doc.status] !== undefined) {
        counts[doc.status]++
      }
    })

    return counts
  }, [documents])

  return {
    documents,
    loading,
    error,
    uploading,
    uploadProgress,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    getDocument,
    getStatusCounts
  }
}

export default useDocuments
