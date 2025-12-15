import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

/**
 * Supported file types and their MIME types
 */
export const SUPPORTED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md'
}

/**
 * Maximum file size (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Check if a file type is supported
 * @param {string} mimeType - MIME type of the file
 * @returns {boolean} Whether the file type is supported
 */
export function isSupported(mimeType) {
  return mimeType in SUPPORTED_TYPES
}

/**
 * Get file type from MIME type
 * @param {string} mimeType - MIME type of the file
 * @returns {string} File type (pdf, docx, txt, md)
 */
export function getFileType(mimeType) {
  return SUPPORTED_TYPES[mimeType] || 'unknown'
}

/**
 * Extract text from a PDF buffer
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Object} Extracted text and metadata
 */
async function parsePDF(buffer) {
  try {
    const data = await pdfParse(buffer)
    
    return {
      text: data.text,
      metadata: {
        pageCount: data.numpages,
        info: data.info || {}
      }
    }
  } catch (error) {
    console.error('Error parsing PDF:', error)
    throw new Error(`Failed to parse PDF: ${error.message}`)
  }
}

/**
 * Extract text from a DOCX buffer
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Object} Extracted text and metadata
 */
async function parseDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer })
    
    return {
      text: result.value,
      metadata: {
        messages: result.messages
      }
    }
  } catch (error) {
    console.error('Error parsing DOCX:', error)
    throw new Error(`Failed to parse DOCX: ${error.message}`)
  }
}

/**
 * Extract text from a plain text buffer
 * @param {Buffer} buffer - Text file buffer
 * @returns {Object} Extracted text and metadata
 */
function parseTXT(buffer) {
  return {
    text: buffer.toString('utf-8'),
    metadata: {}
  }
}

/**
 * Extract text from a Markdown buffer
 * @param {Buffer} buffer - Markdown file buffer
 * @returns {Object} Extracted text and metadata
 */
function parseMarkdown(buffer) {
  // For RAG purposes, we keep the markdown as-is since it's already text
  // The semantic meaning is preserved better this way
  return {
    text: buffer.toString('utf-8'),
    metadata: {
      format: 'markdown'
    }
  }
}

/**
 * Parse a document and extract text
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type of the file
 * @returns {Object} Extracted text and metadata
 */
export async function parseDocument(buffer, mimeType) {
  const fileType = getFileType(mimeType)
  
  console.log(`📄 Parsing document of type: ${fileType}`)
  
  switch (fileType) {
    case 'pdf':
      return parsePDF(buffer)
    case 'docx':
      return parseDOCX(buffer)
    case 'txt':
      return parseTXT(buffer)
    case 'md':
      return parseMarkdown(buffer)
    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }
}

/**
 * Validate a file for upload
 * @param {Object} file - File object with name, type, size
 * @returns {Object} Validation result
 */
export function validateFile(file) {
  const errors = []
  
  // Check file type
  if (!isSupported(file.type)) {
    errors.push(`Unsupported file type: ${file.type}. Supported types: PDF, DOCX, TXT, Markdown`)
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size: 10MB`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get word count from text
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
export function getWordCount(text) {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

export default {
  SUPPORTED_TYPES,
  MAX_FILE_SIZE,
  isSupported,
  getFileType,
  parseDocument,
  validateFile,
  getWordCount
}
