# Documents & RAG Implementation Plan

## Overview

Add a team-wide document knowledge base to Poppy Chat with RAG-first AI responses. Users can upload PDFs, DOCX, TXT, and Markdown files that get indexed into Pinecone for semantic search. Poppy will always search documents first before answering questions.

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| Document Types | PDF, DOCX, TXT, Markdown |
| Scope | Team-wide knowledge base |
| Vector Database | Pinecone |
| RAG Strategy | Always search docs first |
| UI Location | New Documents section in sidebar |

---

## Architecture Overview

```
                                    User Question
                                          |
                                          v
                              +-------------------+
                              |   AI Chat Route   |
                              |  /api/ai-chat     |
                              +-------------------+
                                          |
                    +---------------------+---------------------+
                    |                                           |
                    v                                           v
         +------------------+                        +------------------+
         |  RAG Search API  |                        |   MCP Tools      |
         | /api/rag/search  |                        | Notion, Mem0     |
         +------------------+                        +------------------+
                    |
                    v
         +------------------+
         |    Pinecone      |
         |  Vector Search   |
         +------------------+
                    |
                    v
         +------------------+
         | Relevant Chunks  |
         | + Source Docs    |
         +------------------+


                              Document Upload Flow
                              
    User Upload -> Firebase Storage -> Parse Text -> Generate Embeddings -> Pinecone
         |                |                |               |                   |
         v                v                v               v                   v
    +--------+      +-----------+    +----------+   +------------+      +----------+
    |  File  | ---> |  Storage  | -> | Extract  | ->| OpenAI     | ---> | Upsert   |
    | Select |      |  Bucket   |    | Text     |   | Embeddings |      | Vectors  |
    +--------+      +-----------+    +----------+   +------------+      +----------+
                          |
                          v
                    +-----------+
                    | Firestore |
                    | Metadata  |
                    +-----------+
```

---

## 1. Document Storage Architecture

### Firebase Storage Structure

```
documents/
  {documentId}/
    original.pdf          # Original uploaded file
    extracted.txt         # Extracted text content (backup)
```

### Firestore Data Model

```javascript
// Collection: documents
{
  id: "doc_abc123",
  filename: "company-handbook.pdf",
  originalName: "Company Handbook 2024.pdf",
  mimeType: "application/pdf",
  size: 1024000,  // bytes
  storageUrl: "gs://bucket/documents/doc_abc123/original.pdf",
  downloadUrl: "https://storage.googleapis.com/...",
  
  // Processing status
  status: "ready",  // uploading | processing | ready | error
  errorMessage: null,
  
  // Content metadata
  pageCount: 24,
  wordCount: 15000,
  chunkCount: 45,  // Number of chunks in Pinecone
  
  // Upload info
  uploadedBy: "userId123",
  uploadedByName: "John Doe",
  uploadedAt: Timestamp,
  
  // Indexing info
  indexedAt: Timestamp,
  pineconeNamespace: "team-docs"
}
```

### Pinecone Vector Structure

```javascript
// Pinecone index: poppy-documents
// Namespace: team-docs

{
  id: "doc_abc123_chunk_0",
  values: [0.123, -0.456, ...],  // 1536-dim embedding
  metadata: {
    documentId: "doc_abc123",
    filename: "company-handbook.pdf",
    chunkIndex: 0,
    totalChunks: 45,
    text: "This is the actual text content of this chunk...",
    pageNumber: 1,  // For PDFs
    section: "Introduction",  // If detected
    uploadedAt: "2024-01-15T10:30:00Z"
  }
}
```

---

## 2. Document Parsing Pipeline

### Supported File Types & Libraries

| File Type | Library | Notes |
|-----------|---------|-------|
| PDF | `pdf-parse` | Extracts text, preserves page numbers |
| DOCX | `mammoth` | Converts to plain text or HTML |
| TXT | Native | Read as UTF-8 text |
| Markdown | Native | Read as-is, optionally strip formatting |

### Text Chunking Strategy

Use overlapping chunks with semantic boundaries:

```javascript
const CHUNK_CONFIG = {
  maxChunkSize: 1000,      // characters
  chunkOverlap: 200,       // overlap for context
  minChunkSize: 100,       // avoid tiny chunks
  separators: ["\n\n", "\n", ". ", " "]  // Split priorities
}
```

### Processing Pipeline

```
1. Upload file to Firebase Storage
2. Create Firestore document with status: "processing"
3. Trigger processing (via API route or Cloud Function):
   a. Download file from Storage
   b. Extract text based on file type
   c. Split text into overlapping chunks
   d. Generate embeddings for each chunk (OpenAI ada-002)
   e. Upsert vectors to Pinecone with metadata
   f. Update Firestore document with status: "ready"
4. Handle errors gracefully, update status: "error"
```

---

## 3. Pinecone RAG Integration

### Pinecone Setup

```javascript
// Environment variables needed:
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=poppy-documents
PINECONE_ENVIRONMENT=us-east-1  // or your region

// OpenAI for embeddings:
OPENAI_API_KEY=your_openai_api_key  // For ada-002 embeddings
```

### RAG Search Flow

```javascript
async function searchDocuments(query, topK = 5) {
  // 1. Generate query embedding
  const queryEmbedding = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: query
  });
  
  // 2. Search Pinecone
  const results = await pinecone.query({
    namespace: "team-docs",
    vector: queryEmbedding.data[0].embedding,
    topK: topK,
    includeMetadata: true
  });
  
  // 3. Format results with source attribution
  return results.matches.map(match => ({
    text: match.metadata.text,
    score: match.score,
    source: {
      documentId: match.metadata.documentId,
      filename: match.metadata.filename,
      pageNumber: match.metadata.pageNumber
    }
  }));
}
```

### Relevance Threshold

Only include results above a similarity threshold to avoid noise:

```javascript
const RELEVANCE_THRESHOLD = 0.75;  // Adjust based on testing

const relevantResults = results.filter(r => r.score >= RELEVANCE_THRESHOLD);
```

---

## 4. AI Response Cascade Flow

### Modified AI Chat Flow

```
User Message
     |
     v
+--------------------+
| 1. RAG Search      |  <-- Always first
|    Search docs     |
+--------------------+
     |
     v
+--------------------+
| 2. Build Context   |
|    Include doc     |
|    excerpts        |
+--------------------+
     |
     v
+--------------------+
| 3. Claude API      |
|    With context +  |
|    MCP tools       |
+--------------------+
     |
     v
+--------------------+
| 4. Tool Loop       |  <-- If Claude needs more info
|    Notion, Mem0    |
+--------------------+
     |
     v
Final Response with
Source Citations
```

### Updated System Prompt

```javascript
const systemPrompt = `You are Poppy, a friendly AI assistant in Poppy Chat.

${userContext}

KNOWLEDGE BASE CONTEXT:
The following excerpts are from the team's document knowledge base. Use this information to answer questions when relevant:

${ragContext}

IMPORTANT GUIDELINES:
1. If the knowledge base contains relevant information, use it and cite the source
2. Format citations as: [Source: filename, page X]
3. If the knowledge base doesn't have the answer, you can use your tools (Notion, Mem0)
4. Be honest if you don't know something even after checking all sources
5. Keep responses SHORT but well-spaced

${existingFormattingRules}
`;
```

### Source Citation Format

When Poppy uses document info, cite sources inline:

```
Based on the Company Handbook, the vacation policy is 20 days per year 
[Source: company-handbook.pdf, page 12]

For remote work, you need manager approval 48 hours in advance
[Source: remote-work-policy.pdf, page 3]
```

---

## 5. UI Components Design

### Sidebar Documents Section

```
+----------------------------------+
|  # general                       |
|  # random                        |
|  # engineering                   |
+----------------------------------+
|  DOCUMENTS                   [+] |  <-- New section
+----------------------------------+
|  📄 Company Handbook        24p  |
|  📄 Engineering Standards   12p  |
|  📄 Onboarding Guide         8p  |
|  📄 API Documentation       156p |
+----------------------------------+
|  DIRECT MESSAGES                 |
+----------------------------------+
```

### Document List View

When clicking "DOCUMENTS" header, show full document management:

```
+--------------------------------------------------+
| Documents                              [Upload]   |
+--------------------------------------------------+
| Search documents...                      🔍       |
+--------------------------------------------------+
| 📄 Company Handbook.pdf                          |
|    Uploaded by John • 24 pages • Jan 15, 2024    |
|    [View] [Delete]                               |
+--------------------------------------------------+
| 📄 Engineering Standards.docx                    |
|    Uploaded by Sarah • 12 pages • Jan 10, 2024   |
|    [View] [Delete]                               |
+--------------------------------------------------+
| 📄 Onboarding Guide.md                           |
|    Uploaded by Mike • Processing...              |
|    [Cancel]                                      |
+--------------------------------------------------+
```

### Upload Modal

```
+--------------------------------------------------+
|              Upload Document                  X   |
+--------------------------------------------------+
|                                                   |
|    +------------------------------------------+  |
|    |                                          |  |
|    |     📁 Drop files here or click to       |  |
|    |        browse                            |  |
|    |                                          |  |
|    |     Supported: PDF, DOCX, TXT, MD        |  |
|    |     Max size: 10MB                       |  |
|    |                                          |  |
|    +------------------------------------------+  |
|                                                   |
|    Selected: company-handbook.pdf (2.4 MB)       |
|                                                   |
|    [Cancel]                        [Upload]       |
+--------------------------------------------------+
```

### Processing Status Indicator

Show real-time processing status:

```
📄 New Document.pdf
   ⏳ Processing... (Extracting text)
   
📄 New Document.pdf
   ⏳ Processing... (Generating embeddings 45%)
   
📄 New Document.pdf
   ✅ Ready • 45 chunks indexed
```

---

## 6. API Routes Design

### New API Routes

```
/api/documents
  GET    - List all documents
  POST   - Upload new document (multipart/form-data)

/api/documents/[id]
  GET    - Get document details
  DELETE - Delete document (and Pinecone vectors)

/api/documents/[id]/download
  GET    - Get download URL

/api/rag/search
  POST   - Search documents with query
  Body: { query: string, topK?: number }

/api/rag/process
  POST   - Process uploaded document (internal)
  Body: { documentId: string }
```

### Document Upload Route

```javascript
// /api/documents/route.js
export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  const userId = formData.get('userId');
  
  // 1. Validate file type and size
  // 2. Upload to Firebase Storage
  // 3. Create Firestore document
  // 4. Trigger async processing
  // 5. Return document ID and status
}
```

### RAG Search Route

```javascript
// /api/rag/search/route.js
export async function POST(request) {
  const { query, topK = 5 } = await request.json();
  
  // 1. Generate query embedding
  // 2. Search Pinecone
  // 3. Filter by relevance threshold
  // 4. Return formatted results with sources
}
```

---

## 7. New Dependencies

```json
{
  "dependencies": {
    "@pinecone-database/pinecone": "^2.0.0",
    "openai": "^4.0.0",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0",
    "langchain": "^0.1.0"  // Optional: for text splitting
  }
}
```

---

## 8. Environment Variables

Add to `.env.local`:

```bash
# Pinecone Vector Database
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=poppy-documents
PINECONE_ENVIRONMENT=us-east-1

# OpenAI (for embeddings)
OPENAI_API_KEY=your_openai_api_key
```

---

## 9. Implementation Order

### Phase 1: Document Storage (Foundation)
1. Create Firestore schema for documents
2. Set up Firebase Storage bucket/rules
3. Build document upload API route
4. Create basic document list component

### Phase 2: Document Processing
5. Implement PDF text extraction
6. Implement DOCX text extraction
7. Build text chunking utility
8. Create processing status tracking

### Phase 3: Pinecone Integration
9. Set up Pinecone client and index
10. Implement embedding generation
11. Build vector upsert logic
12. Create RAG search API route

### Phase 4: AI Integration
13. Modify AI chat route to include RAG
14. Update system prompt with document context
15. Add source citation formatting
16. Test RAG-first response flow

### Phase 5: UI Polish
17. Build Documents sidebar section
18. Create document upload modal
19. Add processing status indicators
20. Implement document management (view/delete)

---

## 10. File Structure

```
app/
├── api/
│   ├── documents/
│   │   ├── route.js              # List/Upload documents
│   │   └── [id]/
│   │       ├── route.js          # Get/Delete document
│   │       └── download/
│   │           └── route.js      # Download document
│   └── rag/
│       ├── search/
│       │   └── route.js          # RAG search endpoint
│       └── process/
│           └── route.js          # Process document (internal)
├── components/
│   └── documents/
│       ├── DocumentList.js       # List all documents
│       ├── DocumentItem.js       # Single document row
│       ├── DocumentUpload.js     # Upload modal
│       └── DocumentStatus.js     # Processing status
├── hooks/
│   └── useDocuments.js           # Document CRUD hook
├── lib/
│   ├── pinecone.js               # Pinecone client
│   ├── embeddings.js             # OpenAI embeddings
│   ├── document-parser.js        # PDF/DOCX extraction
│   └── text-chunker.js           # Text splitting logic
```

---

## 11. Security Considerations

1. **File Validation**: Check MIME types server-side, not just extension
2. **Size Limits**: Enforce 10MB max per file
3. **Rate Limiting**: Limit uploads per user per hour
4. **Storage Rules**: Authenticated users only
5. **Pinecone Namespaces**: Could support per-team isolation later

---

## 12. Future Enhancements

- **Per-channel documents**: Scope docs to specific channels
- **Document versioning**: Track document updates
- **Conversation-aware RAG**: Include chat context in search
- **Hybrid search**: Combine vector + keyword search
- **Document Q&A mode**: Dedicated mode for document queries
- **Auto-sync from Google Drive/Notion**: Import docs automatically

---

## Summary

This plan adds a complete document knowledge base with RAG to Poppy Chat:

1. **Upload**: Drag-and-drop PDFs, DOCX, TXT, Markdown files
2. **Process**: Extract text, chunk, generate embeddings, store in Pinecone
3. **Search**: Semantic search across all team documents
4. **AI Integration**: Poppy always checks docs first, cites sources
5. **UI**: New Documents section in sidebar with upload and management

The RAG-first approach means Poppy will be grounded in your team's actual documentation, making it much more useful for company-specific questions.
