import { AssemblyAI } from 'assemblyai'

/**
 * AssemblyAI Client for high-quality audio transcription
 *
 * Uses AssemblyAI's Universal model (speech_model: 'best') which achieves
 * 93.3% Word Accuracy Rate - the highest in the industry.
 *
 * Features:
 * - Speaker diarization (who said what)
 * - Automatic punctuation & casing
 * - Filler word detection
 * - Auto language detection (60+ languages)
 */
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
})

export default client

