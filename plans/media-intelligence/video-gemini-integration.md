# Media Intelligence Integration

> **Goal**: Enable Poppy AI to understand and process images, videos, and voice messages.
> - **Images**: Claude Vision (Sonnet 4.5) ✅ IMPLEMENTED
> - **Audio**: AssemblyAI (Universal/Best model) ✅ IMPLEMENTED
> - **Video**: Gemini + AssemblyAI hybrid (planned)

## Overview

Currently, Poppy can only process text messages. This integration will give Poppy "eyes and ears" - the ability to see images, watch videos, and listen to voice notes.

### What We're Building

```
┌─────────────────────────────────────────────────────────────┐
│  User sends media (image/video/audio) + asks Poppy         │
│  "What's in this?" / "TLDR this" / "Extract action items"  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Media Processing Layer                                      │
│  → AssemblyAI transcribes audio (93.3% accuracy) ✅          │
│  → Claude Vision describes images ✅                         │
│  → Gemini analyzes video visuals (planned)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Context fed to Claude (existing Poppy AI)                  │
│  → Adds team context                                        │
│  → Generates intelligent response                           │
│  → Extracts action items                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     💬 Poppy responds with insight
```

---

## Phase 1: Setup & Authentication ✅ COMPLETE

### 1.1 Image Analysis (Claude Vision)
- [x] Using Claude Sonnet 4.5 via Keywords AI gateway
- [x] `app/api/media/analyze-image/route.js` implemented
- [x] OCR, description, and team-friendly TLDR

### 1.2 Audio Transcription (AssemblyAI)
- [x] AssemblyAI SDK installed: `yarn add assemblyai`
- [x] Client created: `app/lib/assemblyai-client.js`
- [x] API route: `app/api/media/transcribe-audio/route.js`
- [x] Add to environment: `ASSEMBLYAI_API_KEY`

### 1.3 Video Analysis (Gemini) - Planned
- [ ] Sign up for Google AI Studio: https://aistudio.google.com/
- [ ] Generate API key for Gemini
- [ ] Add to environment variables: `GEMINI_API_KEY`
- [ ] Create `app/lib/gemini-client.js`

---

## Phase 2: Image Understanding ✅ IMPLEMENTED

### 2.1 API Route for Image Analysis
`app/api/media/analyze-image/route.js` - **DONE**

**Input:**
- Image URL (from Firebase Storage)
- Optional: Accompanying text for context

**Output:**
- Description of the image
- OCR text (if any text in image)
- Key objects/people identified
- Team-friendly TLDR

### 2.2 How It Works
```javascript
// Using Claude Vision (Sonnet 4.5)
const anthropic = new Anthropic({
  apiKey: process.env.KEYWORDS_AI_API_KEY,
  baseURL: 'https://api.keywordsai.co/api/anthropic/',
});

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type, data: base64 } },
      { type: 'text', text: analysisPrompt }
    ],
  }],
});
```

### 2.3 Integration Points
- When user sends image + mentions @poppy → analyze image
- Image description stored in message metadata for RAG (Ragie)
- Feed image context to Claude for response

---

## Phase 3: Audio/Voice Message Understanding ✅ IMPLEMENTED

### 3.1 Why AssemblyAI Over Gemini?

| Feature | AssemblyAI | Gemini |
|---------|------------|--------|
| **Accuracy** | 93.3% WAR (industry-leading) | ~85-90% estimated |
| **Noisy Audio** | Excellent handling | Average |
| **Speaker Diarization** | Built-in, accurate | Basic |
| **Purpose-Built** | Yes, dedicated STT | No, multimodal generalist |

**Decision**: Use AssemblyAI for highest-quality transcription, then optionally feed to Claude for analysis.

### 3.2 API Route for Audio Transcription
`app/api/media/transcribe-audio/route.js` - **DONE**

**Input:**
- Audio URL (from Firebase Storage)
- Optional: Enable speaker diarization
- Optional: Generate summary for longer audio

**Output:**
- Full transcription (plain text)
- Speaker-labeled transcription (if diarization enabled)
- Speaker segments with timestamps
- Summary (if requested)

### 3.3 How It Works
```javascript
import assemblyai from '../../../lib/assemblyai-client.js';

const config = {
  audio_url: audioUrl,
  speech_model: 'best', // 93.3% accuracy - highest in industry
  speaker_labels: true,  // Who said what
  punctuate: true,
  format_text: true,
};

const transcript = await assemblyai.transcripts.transcribe(config);
```

### 3.4 AssemblyAI Features Used
- **Universal Model** (`speech_model: 'best'`): Highest accuracy
- **Speaker Diarization**: Identifies who said what
- **Auto Punctuation**: Proper sentences
- **60+ Languages**: Auto-detected

### 3.5 Cost
- **$0.00025/second** (~$0.90/hour)
- Very affordable for voice messages (typically < 60 seconds)
- Example: 30-second voice note = $0.0075

### 3.6 Voice Message Enhancements (Planned)
- [ ] Show transcription below voice message bubble (optional toggle)
- [ ] Allow searching voice messages by content
- [ ] Sync transcriptions to Ragie for memory

---

## Phase 4: Video Understanding

### 4.1 Hybrid Approach
For videos, we use **both** services:
1. **AssemblyAI**: Transcribe the audio track (highest accuracy)
2. **Gemini**: Analyze the visual content (what's happening on screen)

### 4.2 API Route for Video Analysis
Create `app/api/media/analyze-video/route.js`

**Input:**
- Video URL (from Mux or Firebase)
- Mux playback ID (if applicable)
- User's question about the video

**Output:**
- Audio transcription (via AssemblyAI)
- Visual description / summary (via Gemini)
- Action items (if meeting/discussion)
- Key moments with timestamps

### 4.3 How It Works
```javascript
// Step 1: Transcribe audio with AssemblyAI (highest quality)
const audioTranscript = await transcribeAudio(videoUrl);

// Step 2: Analyze visuals with Gemini
const visualAnalysis = await analyzeVideoVisuals(videoUrl);

// Step 3: Combine and summarize
const combined = `
WHAT WAS SAID:
${audioTranscript.formatted}

WHAT WAS SHOWN:
${visualAnalysis}
`;

// Step 4: Feed to Claude for intelligent summary
const summary = await claudeSummarize(combined, userQuestion);
```

### 4.4 Mux Integration
- Get video download URL from Mux API
- Extract audio for AssemblyAI
- Process full video through Gemini
- Cache results in Firestore for repeat queries

---

## Phase 5: AI Chat Integration

### 5.1 Modify `ai-chat/route.js`
Add media context to Claude's prompt when relevant messages contain media.

```javascript
// In processAIRequest function
const mediaContext = [];

// Check recent messages for media
for (const msg of chatHistory.slice(-10)) {
  if (msg.imageUrl || msg.imageUrls?.length) {
    // Get image analysis from Claude Vision (cached or fresh)
    const analysis = await getImageAnalysis(msg.imageUrls || [msg.imageUrl]);
    mediaContext.push(`[Image from ${msg.sender}]: ${analysis}`);
  }
  
  if (msg.audioUrl) {
    // Get audio transcription from AssemblyAI
    const transcription = await getAudioTranscription(msg.audioUrl);
    mediaContext.push(`[Voice message from ${msg.sender}]: "${transcription}"`);
  }
  
  if (msg.muxPlaybackIds?.length) {
    // Get video analysis (AssemblyAI + Gemini hybrid)
    const videoAnalysis = await getVideoAnalysis(msg.muxPlaybackIds[0]);
    mediaContext.push(`[Video from ${msg.sender}]: ${videoAnalysis}`);
  }
}

// Add to system prompt
if (mediaContext.length > 0) {
  systemPrompt += `\n\n=== MEDIA IN CONVERSATION ===\n${mediaContext.join('\n')}`;
}
```

### 5.2 Caching Strategy
- Store media analysis in Firestore (under message doc)
- Cache key: `mediaAnalysis_{messageId}`
- Re-use cached analysis for same media
- Reduces API calls and latency

---

## Phase 6: Action Items & TLDR

### 6.1 Smart Video Summary Prompt
```javascript
const meetingSummaryPrompt = `
Analyze this video as if it were a meeting or discussion:

1. **TLDR** (2-3 sentences max)
2. **Key Topics Discussed** (bullet points)
3. **Decisions Made** (if any)
4. **Action Items** (format: "- [Person]: Task by [deadline if mentioned]")
5. **Questions/Open Items** (unresolved discussions)

Be concise. Use the speaker's actual names if you can identify them.
`;
```

### 6.2 Integration with Tasks System
When action items are extracted:
- Optionally auto-create tasks in the DM Tasks system
- Tag relevant people
- Link back to original video message

---

## Technical Specifications

### Service Comparison

| Service | Use Case | Accuracy | Cost |
|---------|----------|----------|------|
| **Claude Vision** | Images | Excellent | ~$0.01-0.05/image |
| **AssemblyAI** | Audio transcription | 93.3% WAR | $0.00025/sec |
| **Gemini** | Video visuals | Good | ~$0.01-0.05/video |

### AssemblyAI Specifics
- **Model**: Universal (`speech_model: 'best'`)
- **Accuracy**: 93.3% Word Accuracy Rate
- **Speaker Diarization**: Included at no extra cost
- **Languages**: 60+ supported (auto-detected)
- **Formats**: MP3, M4A, WAV, WEBM, MP4, etc.

### Gemini API Limits (for video)
| Content Type | Limit |
|--------------|-------|
| Video | 2 GB max, 1 hour (paid) |
| Total request | 20 MB combined |

### Supported Formats
- **Images**: PNG, JPEG, WebP, HEIC, HEIF
- **Audio**: MP3, M4A, WAV, WEBM
- **Video**: MP4, MOV, WEBM

---

## Implementation Status

### ✅ Completed
- [x] Image analysis with Claude Vision
- [x] Audio transcription with AssemblyAI
- [x] Usage tracking to Firestore
- [x] Speaker diarization support

### 🔄 In Progress
- [ ] Integrate transcription with VoiceMessage component
- [ ] Add transcription display toggle in UI

### 📋 Planned
- [ ] Video analysis (Gemini + AssemblyAI hybrid)
- [ ] AI Chat integration with media context
- [ ] Caching layer for media analysis
- [ ] Action item extraction from meetings

---

## Files Created/Modified

### New Files
```
app/lib/assemblyai-client.js          # AssemblyAI SDK setup ✅
app/api/media/analyze-image/route.js  # Claude Vision ✅
app/api/media/transcribe-audio/route.js # AssemblyAI ✅
app/api/media/analyze-video/route.js  # (planned)
app/lib/gemini-client.js              # (planned)
```

### Modified Files
```
app/api/ai-chat/route.js              # Add media context (planned)
app/components/chat/VoiceMessage.js   # Transcription display (planned)
app/components/chat/MessageItem.js    # Media analysis status (planned)
```

### Environment Variables
```
ASSEMBLYAI_API_KEY=your_api_key_here  # ✅ Required
GEMINI_API_KEY=your_api_key_here      # (planned)
```

---

## Success Metrics

- [x] Poppy can describe any image sent in chat (Claude Vision)
- [x] Voice messages can be transcribed with 93%+ accuracy (AssemblyAI)
- [ ] Voice messages are searchable by content
- [ ] Videos can be summarized with action items
- [ ] Response time < 5 seconds for images, < 15 seconds for short videos
- [ ] Cached results load instantly

---

## API Usage Examples

### Transcribe a Voice Message
```bash
curl -X POST http://localhost:3000/api/media/transcribe-audio \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://firebasestorage.googleapis.com/.../voice.webm",
    "messageId": "msg_123",
    "sender": "Rafeh Qazi",
    "enableSpeakerDiarization": true
  }'
```

**Response:**
```json
{
  "success": true,
  "transcription": {
    "text": "Hey team, just wanted to follow up on the design review...",
    "formatted": "Speaker A: Hey team, just wanted to follow up...",
    "speakerCount": 1,
    "confidence": 0.95
  },
  "audio": {
    "durationSeconds": 45,
    "durationFormatted": "45s"
  },
  "cost": {
    "amount": 0.01125,
    "breakdown": "45s × $0.00025/s"
  }
}
```
