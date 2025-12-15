import { Pinecone } from '@pinecone-database/pinecone'

// Pinecone client singleton
let pineconeClient = null

/**
 * Get or create a Pinecone client instance
 * @returns {Pinecone} Pinecone client
 */
export function getPineconeClient() {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is not set')
    }
    
    pineconeClient = new Pinecone({
      apiKey: apiKey
    })
    
    console.log('✅ Pinecone client initialized')
  }
  
  return pineconeClient
}

/**
 * Get the documents index
 * @returns {Object} Pinecone index
 */
export function getDocumentsIndex() {
  const client = getPineconeClient()
  const indexName = process.env.PINECONE_INDEX || 'poppy-documents'
  return client.index(indexName)
}

/**
 * Upsert vectors to the documents index
 * @param {Array} vectors - Array of vectors to upsert
 * @param {string} namespace - Namespace for the vectors (default: 'team-docs')
 */
export async function upsertVectors(vectors, namespace = 'team-docs') {
  const index = getDocumentsIndex()
  
  // Pinecone has a limit of 100 vectors per upsert
  const BATCH_SIZE = 100
  
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE)
    await index.namespace(namespace).upsert(batch)
    console.log(`📤 Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(vectors.length / BATCH_SIZE)}`)
  }
  
  console.log(`✅ Upserted ${vectors.length} vectors to namespace: ${namespace}`)
}

/**
 * Query vectors from the documents index
 * @param {Array<number>} queryVector - Query embedding vector
 * @param {number} topK - Number of results to return
 * @param {string} namespace - Namespace to query (default: 'team-docs')
 * @param {Object} filter - Optional metadata filter
 * @returns {Array} Query results with metadata
 */
export async function queryVectors(queryVector, topK = 5, namespace = 'team-docs', filter = null) {
  const index = getDocumentsIndex()
  
  const queryParams = {
    vector: queryVector,
    topK: topK,
    includeMetadata: true
  }
  
  if (filter) {
    queryParams.filter = filter
  }
  
  const results = await index.namespace(namespace).query(queryParams)
  
  return results.matches || []
}

/**
 * Delete vectors for a specific document
 * @param {string} documentId - Document ID to delete vectors for
 * @param {string} namespace - Namespace (default: 'team-docs')
 */
export async function deleteDocumentVectors(documentId, namespace = 'team-docs') {
  const index = getDocumentsIndex()
  
  // Delete all vectors with this document ID in metadata
  await index.namespace(namespace).deleteMany({
    filter: {
      documentId: { $eq: documentId }
    }
  })
  
  console.log(`🗑️ Deleted vectors for document: ${documentId}`)
}

/**
 * Get index stats
 * @returns {Object} Index statistics
 */
export async function getIndexStats() {
  const index = getDocumentsIndex()
  return await index.describeIndexStats()
}

export default {
  getPineconeClient,
  getDocumentsIndex,
  upsertVectors,
  queryVectors,
  deleteDocumentVectors,
  getIndexStats
}
