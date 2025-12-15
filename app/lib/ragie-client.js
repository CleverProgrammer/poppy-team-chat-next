import { Ragie } from 'ragie';

// Initialize Ragie client for RAG operations
const ragie = new Ragie({
  auth: process.env.RAGIE_API_KEY
});

export default ragie;