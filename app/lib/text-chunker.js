/**
 * Text chunking utility for RAG
 * Splits text into overlapping chunks with semantic boundaries
 */

/**
 * Default chunking configuration
 */
export const DEFAULT_CONFIG = {
  maxChunkSize: 1000,      // Maximum characters per chunk
  chunkOverlap: 200,       // Overlap between chunks for context
  minChunkSize: 100,       // Minimum chunk size to avoid tiny chunks
  separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ']
}

/**
 * Split text by a separator
 * @param {string} text - Text to split
 * @param {string} separator - Separator to use
 * @returns {Array<string>} Split text segments
 */
function splitBySeparator(text, separator) {
  if (separator === '') {
    return text.split('')
  }
  return text.split(separator)
}

/**
 * Recursively split text into chunks
 * @param {string} text - Text to split
 * @param {Array<string>} separators - Separators to try in order
 * @param {number} maxSize - Maximum chunk size
 * @returns {Array<string>} Text chunks
 */
function recursiveSplit(text, separators, maxSize) {
  // If text is small enough, return it
  if (text.length <= maxSize) {
    return [text]
  }
  
  // Try each separator
  for (const separator of separators) {
    const splits = splitBySeparator(text, separator)
    
    if (splits.length > 1) {
      const chunks = []
      let currentChunk = ''
      
      for (const split of splits) {
        const potentialChunk = currentChunk
          ? currentChunk + separator + split
          : split
        
        if (potentialChunk.length <= maxSize) {
          currentChunk = potentialChunk
        } else {
          if (currentChunk) {
            chunks.push(currentChunk)
          }
          
          // If this split is still too big, recurse with remaining separators
          if (split.length > maxSize) {
            const remainingSeparators = separators.slice(separators.indexOf(separator) + 1)
            if (remainingSeparators.length > 0) {
              const subChunks = recursiveSplit(split, remainingSeparators, maxSize)
              chunks.push(...subChunks)
              currentChunk = ''
            } else {
              // No more separators, just split by character
              currentChunk = split.slice(0, maxSize)
              let remaining = split.slice(maxSize)
              while (remaining.length > 0) {
                chunks.push(currentChunk)
                currentChunk = remaining.slice(0, maxSize)
                remaining = remaining.slice(maxSize)
              }
            }
          } else {
            currentChunk = split
          }
        }
      }
      
      if (currentChunk) {
        chunks.push(currentChunk)
      }
      
      return chunks
    }
  }
  
  // No separators worked, split by character
  const chunks = []
  for (let i = 0; i < text.length; i += maxSize) {
    chunks.push(text.slice(i, i + maxSize))
  }
  return chunks
}

/**
 * Add overlap to chunks
 * @param {Array<string>} chunks - Chunks to add overlap to
 * @param {number} overlap - Number of characters to overlap
 * @returns {Array<string>} Chunks with overlap
 */
function addOverlap(chunks, overlap) {
  if (chunks.length <= 1 || overlap <= 0) {
    return chunks
  }
  
  const result = [chunks[0]]
  
  for (let i = 1; i < chunks.length; i++) {
    const prevChunk = chunks[i - 1]
    const currentChunk = chunks[i]
    
    // Get overlap from previous chunk
    const overlapText = prevChunk.slice(-overlap)
    
    // Prepend overlap to current chunk
    result.push(overlapText + currentChunk)
  }
  
  return result
}

/**
 * Clean a chunk (trim whitespace, normalize spaces)
 * @param {string} chunk - Chunk to clean
 * @returns {string} Cleaned chunk
 */
function cleanChunk(chunk) {
  return chunk
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
}

/**
 * Split text into chunks for RAG
 * @param {string} text - Text to chunk
 * @param {Object} config - Chunking configuration
 * @returns {Array<Object>} Array of chunk objects with text and metadata
 */
export function chunkText(text, config = {}) {
  const {
    maxChunkSize = DEFAULT_CONFIG.maxChunkSize,
    chunkOverlap = DEFAULT_CONFIG.chunkOverlap,
    minChunkSize = DEFAULT_CONFIG.minChunkSize,
    separators = DEFAULT_CONFIG.separators
  } = config
  
  // Clean input text
  const cleanedText = text.trim()
  
  if (!cleanedText) {
    return []
  }
  
  // Split into initial chunks
  let chunks = recursiveSplit(cleanedText, separators, maxChunkSize)
  
  // Add overlap
  chunks = addOverlap(chunks, chunkOverlap)
  
  // Clean and filter chunks
  chunks = chunks
    .map(cleanChunk)
    .filter(chunk => chunk.length >= minChunkSize)
  
  // Create chunk objects with metadata
  return chunks.map((text, index) => ({
    text,
    index,
    charCount: text.length,
    wordCount: text.split(/\s+/).length
  }))
}

/**
 * Estimate the number of chunks for a given text
 * @param {string} text - Text to estimate
 * @param {number} maxChunkSize - Maximum chunk size
 * @returns {number} Estimated number of chunks
 */
export function estimateChunkCount(text, maxChunkSize = DEFAULT_CONFIG.maxChunkSize) {
  if (!text) return 0
  return Math.ceil(text.length / (maxChunkSize * 0.8)) // Account for overlap
}

/**
 * Split text by pages (for PDFs)
 * @param {string} text - Text with page breaks
 * @param {string} pageMarker - Page break marker
 * @returns {Array<Object>} Array of page objects
 */
export function splitByPages(text, pageMarker = '\f') {
  const pages = text.split(pageMarker)
  
  return pages.map((content, index) => ({
    pageNumber: index + 1,
    content: content.trim()
  })).filter(page => page.content.length > 0)
}

/**
 * Chunk text with page awareness (for PDFs)
 * @param {string} text - Text to chunk
 * @param {Object} config - Chunking configuration
 * @returns {Array<Object>} Chunks with page numbers
 */
export function chunkTextWithPages(text, config = {}) {
  const pages = splitByPages(text)
  const allChunks = []
  
  for (const page of pages) {
    const pageChunks = chunkText(page.content, config)
    
    for (const chunk of pageChunks) {
      allChunks.push({
        ...chunk,
        pageNumber: page.pageNumber,
        index: allChunks.length
      })
    }
  }
  
  return allChunks
}

export default {
  DEFAULT_CONFIG,
  chunkText,
  chunkTextWithPages,
  estimateChunkCount,
  splitByPages
}
