import { NextResponse } from 'next/server'
import { db, storage } from '../../../lib/firebase'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, getBytes } from 'firebase/storage'
import { parseDocument, getWordCount, getFileType } from '../../../lib/document-parser'
import { chunkText, chunkTextWithPages } from '../../../lib/text-chunker'
import { generateEmbeddings } from '../../../lib/embeddings'
import { upsertVectors } from '../../../lib/pinecone'

/**
 * POST /api/rag/process - Process a document for RAG
 * This extracts text, chunks it, generates embeddings, and stores in Pinecone
 */
export async function POST(request) {
  let documentId = null
  
  try {
    const { documentId: docId } = await request.json()
    documentId = docId
    
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }
    
    console.log(`📄 Processing document: ${documentId}`)
    
    // Get document from Firestore
    const docRef = doc(db, 'documents', documentId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }
    
    const documentData = docSnap.data()
    
    // Check if already processed
    if (documentData.status === 'ready') {
      return NextResponse.json({
        success: true,
        message: 'Document already processed'
      })
    }
    
    // Download file from Firebase Storage
    console.log(`📥 Downloading file: ${documentData.storagePath}`)
    const storageRef = ref(storage, documentData.storagePath)
    const fileBuffer = Buffer.from(await getBytes(storageRef))
    
    // Parse document to extract text
    console.log(`📝 Extracting text from ${documentData.mimeType}`)
    const { text, metadata } = await parseDocument(fileBuffer, documentData.mimeType)
    
    if (!text || text.trim().length === 0) {
      await updateDoc(docRef, {
        status: 'error',
        errorMessage: 'No text content found in document'
      })
      
      return NextResponse.json(
        { success: false, error: 'No text content found in document' },
        { status: 400 }
      )
    }
    
    // Get word count
    const wordCount = getWordCount(text)
    console.log(`📊 Word count: ${wordCount}`)
    
    // Chunk the text
    console.log(`✂️ Chunking text...`)
    const fileType = getFileType(documentData.mimeType)
    const chunks = fileType === 'pdf' 
      ? chunkTextWithPages(text)
      : chunkText(text)
    
    console.log(`📦 Created ${chunks.length} chunks`)
    
    if (chunks.length === 0) {
      await updateDoc(docRef, {
        status: 'error',
        errorMessage: 'Failed to create text chunks'
      })
      
      return NextResponse.json(
        { success: false, error: 'Failed to create text chunks' },
        { status: 400 }
      )
    }
    
    // Generate embeddings for all chunks
    console.log(`🔢 Generating embeddings...`)
    const chunkTexts = chunks.map(chunk => chunk.text)
    const embeddings = await generateEmbeddings(chunkTexts)
    
    // Prepare vectors for Pinecone
    console.log(`📤 Preparing vectors for Pinecone...`)
    const vectors = chunks.map((chunk, index) => ({
      id: `${documentId}_chunk_${index}`,
      values: embeddings[index],
      metadata: {
        documentId: documentId,
        filename: documentData.filename,
        chunkIndex: index,
        totalChunks: chunks.length,
        text: chunk.text,
        pageNumber: chunk.pageNumber || null,
        charCount: chunk.charCount,
        wordCount: chunk.wordCount,
        uploadedAt: new Date().toISOString()
      }
    }))
    
    // Upsert to Pinecone
    console.log(`📤 Upserting to Pinecone...`)
    await upsertVectors(vectors, documentData.pineconeNamespace || 'team-docs')
    
    // Update document status in Firestore
    await updateDoc(docRef, {
      status: 'ready',
      errorMessage: null,
      pageCount: metadata.pageCount || null,
      wordCount: wordCount,
      chunkCount: chunks.length,
      indexedAt: serverTimestamp()
    })
    
    console.log(`✅ Document processed successfully: ${documentId}`)
    
    return NextResponse.json({
      success: true,
      message: 'Document processed successfully',
      stats: {
        wordCount,
        chunkCount: chunks.length,
        pageCount: metadata.pageCount || null
      }
    })
  } catch (error) {
    console.error('Error processing document:', error)
    
    // Update document status to error
    if (documentId) {
      try {
        const docRef = doc(db, 'documents', documentId)
        await updateDoc(docRef, {
          status: 'error',
          errorMessage: error.message
        })
      } catch (updateError) {
        console.error('Failed to update document status:', updateError)
      }
    }
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
