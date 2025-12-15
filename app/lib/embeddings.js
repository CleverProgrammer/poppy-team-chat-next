import OpenAI from 'openai'

// OpenAI client singleton
let openaiClient = null

// Embedding model to use
const EMBEDDING_MODEL = 'text-embedding-ada-002'
const EMBEDDING_DIMENSIONS = 1536

/**
 * Get or create an OpenAI client instance
 * @returns {OpenAI} OpenAI client
 */
function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    
    openaiClient = new OpenAI({
      apiKey: apiKey
    })
    
    console.log('✅ OpenAI client initialized for embeddings')
  }
  
  return openaiClient
}

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @returns {Array<number>} Embedding vector (1536 dimensions)
 */
export async function generateEmbedding(text) {
  const client = getOpenAIClient()
  
  // Clean and truncate text if needed (ada-002 has 8191 token limit)
  const cleanedText = text.replace(/\n+/g, ' ').trim()
  
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleanedText
  })
  
  return response.data[0].embedding
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {Array<string>} texts - Array of texts to embed
 * @returns {Array<Array<number>>} Array of embedding vectors
 */
export async function generateEmbeddings(texts) {
  const client = getOpenAIClient()
  
  // OpenAI recommends batching up to 2048 texts at once
  const BATCH_SIZE = 100
  const embeddings = []
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    
    // Clean texts
    const cleanedBatch = batch.map(text => 
      text.replace(/\n+/g, ' ').trim()
    )
    
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanedBatch
    })
    
    // Extract embeddings in order
    const batchEmbeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding)
    
    embeddings.push(...batchEmbeddings)
    
    console.log(`🔢 Generated embeddings batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}`)
  }
  
  return embeddings
}

/**
 * Generate embedding for a search query
 * @param {string} query - Search query
 * @returns {Array<number>} Query embedding vector
 */
export async function generateQueryEmbedding(query) {
  return generateEmbedding(query)
}

/**
 * Get the embedding model info
 * @returns {Object} Model information
 */
export function getModelInfo() {
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS
  }
}

export default {
  generateEmbedding,
  generateEmbeddings,
  generateQueryEmbedding,
  getModelInfo
}
