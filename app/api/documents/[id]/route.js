import { NextResponse } from 'next/server'
import { db, storage } from '../../../lib/firebase'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { deleteDocumentVectors } from '../../../lib/pinecone'

/**
 * GET /api/documents/[id] - Get document details
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params
    
    const docRef = doc(db, 'documents', id)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }
    
    const data = docSnap.data()
    
    return NextResponse.json({
      success: true,
      document: {
        id: docSnap.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || null,
        indexedAt: data.indexedAt?.toDate?.()?.toISOString() || null
      }
    })
  } catch (error) {
    console.error('Error getting document:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/documents/[id] - Delete a document
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    
    // Get document first to get storage path
    const docRef = doc(db, 'documents', id)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }
    
    const data = docSnap.data()
    
    // Delete from Firebase Storage
    if (data.storagePath) {
      try {
        const storageRef = ref(storage, data.storagePath)
        await deleteObject(storageRef)
        console.log(`🗑️ Deleted file from storage: ${data.storagePath}`)
      } catch (storageError) {
        // File might not exist, continue with deletion
        console.warn('Failed to delete file from storage:', storageError.message)
      }
    }
    
    // Delete vectors from Pinecone
    try {
      await deleteDocumentVectors(id, data.pineconeNamespace || 'team-docs')
      console.log(`🗑️ Deleted vectors from Pinecone for document: ${id}`)
    } catch (pineconeError) {
      // Vectors might not exist, continue with deletion
      console.warn('Failed to delete vectors from Pinecone:', pineconeError.message)
    }
    
    // Delete from Firestore
    await deleteDoc(docRef)
    console.log(`🗑️ Deleted document from Firestore: ${id}`)
    
    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
