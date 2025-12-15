import { NextResponse } from 'next/server'
import { db, storage } from '../../lib/firebase'
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { validateFile, MAX_FILE_SIZE } from '../../lib/document-parser'

/**
 * GET /api/documents - List all documents
 */
export async function GET() {
  try {
    const documentsRef = collection(db, 'documents')
    const q = query(documentsRef, orderBy('uploadedAt', 'desc'))
    const snapshot = await getDocs(q)
    
    const documents = []
    snapshot.forEach((doc) => {
      const data = doc.data()
      documents.push({
        id: doc.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || null,
        indexedAt: data.indexedAt?.toDate?.()?.toISOString() || null
      })
    })
    
    return NextResponse.json({
      success: true,
      documents
    })
  } catch (error) {
    console.error('Error listing documents:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/documents - Upload a new document
 */
export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const userId = formData.get('userId')
    const userName = formData.get('userName')
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }
    
    // Validate file
    const validation = validateFile({
      type: file.type,
      size: file.size
    })
    
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(', ') },
        { status: 400 }
      )
    }
    
    // Generate a unique document ID
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Upload to Firebase Storage
    const storageRef = ref(storage, `documents/${docId}/original_${file.name}`)
    await uploadBytes(storageRef, buffer, {
      contentType: file.type
    })
    
    // Get download URL
    const downloadUrl = await getDownloadURL(storageRef)
    
    // Create Firestore document
    const documentData = {
      filename: file.name,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      storagePath: `documents/${docId}/original_${file.name}`,
      downloadUrl: downloadUrl,
      
      // Processing status
      status: 'processing',
      errorMessage: null,
      
      // Content metadata (will be updated after processing)
      pageCount: null,
      wordCount: null,
      chunkCount: null,
      
      // Upload info
      uploadedBy: userId,
      uploadedByName: userName || 'Unknown',
      uploadedAt: serverTimestamp(),
      
      // Indexing info
      indexedAt: null,
      pineconeNamespace: 'team-docs'
    }
    
    const docRef = await addDoc(collection(db, 'documents'), documentData)
    
    // Trigger async processing via the process API
    // This is done in the background
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/rag/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docRef.id })
    }).catch(err => {
      console.error('Failed to trigger document processing:', err)
    })
    
    return NextResponse.json({
      success: true,
      document: {
        id: docRef.id,
        ...documentData,
        uploadedAt: new Date().toISOString()
      },
      message: 'Document uploaded successfully. Processing in background.'
    })
  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
