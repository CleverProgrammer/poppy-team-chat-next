import { NextResponse } from 'next/server'
import { generateQueryEmbedding } from '../../../lib/embeddings'
import { queryVectors } from '../../../lib/pinecone'

// Relevance threshold for including results
const RELEVANCE_THRESHOLD = 0.7

/**
 * POST /api/rag/search - Search documents with a query
 */
export async function POST(request) {
  try {
    const { query, topK = 5, threshold = RELEVANCE_THRESHOLD } = await request.json()
    
    if (!query || !query.trim()) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }
    
    console.log(`🔍 RAG Search: "${query.substring(0, 50)}..."`)
    
    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query)
    
    // Search Pinecone
    const results = await queryVectors(queryEmbedding, topK, 'team-docs')
    
    // Filter by relevance threshold
    const relevantResults = results.filter(match => match.score >= threshold)
    
    console.log(`📊 Found ${results.length} results, ${relevantResults.length} above threshold (${threshold})`)
    
    // Format results with source attribution
    const formattedResults = relevantResults.map(match => ({
      text: match.metadata?.text || '',
      score: match.score,
      source: {
        documentId: match.metadata?.documentId,
        filename: match.metadata?.filename,
        pageNumber: match.metadata?.pageNumber,
        chunkIndex: match.metadata?.chunkIndex
      }
    }))
    
    return NextResponse.json({
      success: true,
      query,
      results: formattedResults,
      totalFound: results.length,
      relevantCount: relevantResults.length
    })
  } catch (error) {
    console.error('Error in RAG search:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Helper function to search and format results for AI context
 * This is exported for use in the AI chat route
 */
export async function searchDocumentsForContext(query, topK = 5, threshold = RELEVANCE_THRESHOLD) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query)
    
    // Search Pinecone
    const results = await queryVectors(queryEmbedding, topK, 'team-docs')
    
    // Filter by relevance threshold
    const relevantResults = results.filter(match => match.score >= threshold)
    
    if (relevantResults.length === 0) {
      return {
        hasResults: false,
        context: '',
        sources: []
      }
    }
    
    // Build context string for AI
    const contextParts = relevantResults.map((match, index) => {
      const source = match.metadata?.filename || 'Unknown document'
      const page = match.metadata?.pageNumber ? `, page ${match.metadata.pageNumber}` : ''
      const text = match.metadata?.text || ''
      
      return `[${index + 1}] From "${source}"${page}:\n${text}`
    })
    
    // Build sources list
    const sources = relevantResults.map(match => ({
      filename: match.metadata?.filename,
      pageNumber: match.metadata?.pageNumber,
      documentId: match.metadata?.documentId,
      score: match.score
    }))
    
    return {
      hasResults: true,
      context: contextParts.join('\n\n'),
      sources
    }
  } catch (error) {
    console.error('Error searching documents for context:', error)
    return {
      hasResults: false,
      context: '',
      sources: [],
      error: error.message
    }
  }
}
