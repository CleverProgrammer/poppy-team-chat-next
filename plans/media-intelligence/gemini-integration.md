# Media Intelligence Integration

> **Goal**: Enable Poppy AI to understand and process images, videos, and voice messages.
> - **Images**: Claude Vision (Sonnet 4.5) ✅ IMPLEMENTED
> - **Audio/Video**: Gemini 3 Pro (planned)

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
│  Gemini 3 Pro processes the media                           │
│  → Transcribes audio                                        │
│  → Describes images                                         │
│  → Summarizes videos                                        │
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

## Phase 1: Setup & Authentication

### 1.1 Get Gemini API Access
- [ ] Sign up for Google AI Studio: https://aistudio.google.com/
- [ ] Generate API key for Gemini 3 Pro
- [ ] Add to environment variables: `GEMINI_API_KEY`

### 1.2 Install SDK
```bash
yarn add @google/generative-ai
```

### 1.3 Create Gemini Client
Create `app/lib/gemini-client.js`:
```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const geminiPro = genAI.getGenerativeModel({ 
  model: 'gemini-2.0-flash-exp' // or 'gemini-1.5-pro' for longer context
});

export default genAI;
```

---

## Phase 2: Image Understanding

### 2.1 API Route for Image Analysis
Create `app/api/media/analyze-image/route.js`

**Input:**
- Image URL (from Firebase Storage)
- Optional: User's question about the image

**Output:**
- Description of the image
- OCR text (if any text in image)
- Key objects/people identified

### 2.2 How It Works
```javascript
// Fetch image and convert to base64
const imageResponse = await fetch(imageUrl);
const imageBuffer = await imageResponse.arrayBuffer();
const base64Image = Buffer.from(imageBuffer).toString('base64');

// Send to Gemini
const result = await geminiPro.generateContent([
  {
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64Image,
    },
  },
  { text: 'Describe this image in detail. Extract any text visible.' },
]);
```

### 2.3 Integration Points
- When user sends image + mentions @poppy → analyze image
- Image description stored in message metadata for RAG (Ragie)
- Feed image context to Claude for response

---

## Phase 3: Audio/Voice Message Understanding

### 3.1 API Route for Audio Transcription
Create `app/api/media/transcribe-audio/route.js`

**Input:**
- Audio URL (from Firebase Storage)
- Audio duration

**Output:**
- Full transcription
- Summary (if > 30 seconds)
- Speaker identification (if multiple voices)

### 3.2 How It Works
```javascript
// Fetch audio file
const audioResponse = await fetch(audioUrl);
const audioBuffer = await audioResponse.arrayBuffer();
const base64Audio = Buffer.from(audioBuffer).toString('base64');

// Send to Gemini
const result = await geminiPro.generateContent([
  {
    inlineData: {
      mimeType: 'audio/webm', // or audio/mp4, audio/wav
      data: base64Audio,
    },
  },
  { text: 'Transcribe this audio. If longer than 30 seconds, also provide a summary.' },
]);
```

### 3.3 Voice Message Enhancements
- Show transcription below voice message bubble (optional toggle)
- Allow searching voice messages by content
- Sync transcriptions to Ragie for memory

---

## Phase 4: Video Understanding

### 4.1 API Route for Video Analysis
Create `app/api/media/analyze-video/route.js`

**Input:**
- Video URL (from Mux or Firebase)
- Mux playback ID (if applicable)
- User's question about the video

**Output:**
- Transcription of audio
- Visual description / summary
- Action items (if meeting/discussion)
- Key moments with timestamps

### 4.2 How It Works
```javascript
// For videos, we have options:
// Option A: Send video file directly (up to 2GB, 1 hour)
// Option B: Extract audio + sample frames

// Option A - Direct video upload
const videoResponse = await fetch(videoUrl);
const videoBuffer = await videoResponse.arrayBuffer();
const base64Video = Buffer.from(videoBuffer).toString('base64');

const result = await geminiPro.generateContent([
  {
    inlineData: {
      mimeType: 'video/mp4',
      data: base64Video,
    },
  },
  { 
    text: `Analyze this video:
    1. Transcribe all spoken content
    2. Summarize what happens visually
    3. Extract any action items or decisions made
    4. Note key timestamps for important moments`
  },
]);
```

### 4.3 Mux Integration
- Get video download URL from Mux API
- Process through Gemini
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
    // Get image analysis from Gemini (cached or fresh)
    const analysis = await getImageAnalysis(msg.imageUrls || [msg.imageUrl]);
    mediaContext.push(`[Image from ${msg.sender}]: ${analysis}`);
  }
  
  if (msg.audioUrl) {
    // Get audio transcription
    const transcription = await getAudioTranscription(msg.audioUrl);
    mediaContext.push(`[Voice message from ${msg.sender}]: "${transcription}"`);
  }
  
  if (msg.muxPlaybackIds?.length) {
    // Get video analysis
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

### Gemini API Limits
| Content Type | Limit |
|--------------|-------|
| Images (inline) | 7 MB per image |
| Audio | 10 min combined (free), higher for paid |
| Video | 2 GB max, 1 hour (paid) |
| Total request | 20 MB combined |

### Supported Formats
- **Images**: PNG, JPEG, WebP, HEIC, HEIF
- **Audio**: MP3, M4A, WAV, WEBM
- **Video**: MP4, MOV, WEBM

### Cost Estimates (Gemini 1.5 Pro)
- Input: $0.00125 / 1K tokens
- Output: $0.005 / 1K tokens
- ~$0.01-0.05 per media analysis (varies by size)

---

## Implementation Order

### Week 1: Foundation
- [ ] Set up Gemini API credentials
- [ ] Create gemini-client.js
- [ ] Build image analysis route
- [ ] Test with sample images

### Week 2: Audio & Voice
- [ ] Build audio transcription route
- [ ] Integrate with VoiceMessage component
- [ ] Add transcription display toggle
- [ ] Test with voice messages

### Week 3: Video
- [ ] Build video analysis route
- [ ] Handle Mux video URLs
- [ ] Implement caching
- [ ] Test with various video lengths

### Week 4: AI Chat Integration
- [ ] Modify ai-chat route to include media context
- [ ] Add smart TLDR prompts
- [ ] Implement action item extraction
- [ ] End-to-end testing

---

## Future Enhancements (Post-MVP)

### Twelve Labs Integration (Video Clipping)
When ready to add video editing:
- Add Twelve Labs for semantic video search
- Enable "clip this part" functionality
- Natural language video editing

### Real-time Transcription
- Live transcription for video calls
- Integration with WebRTC

### Multi-language Support
- Auto-detect language
- Translate transcriptions

---

## Files to Create/Modify

### New Files
```
app/lib/gemini-client.js           # Gemini SDK setup
app/api/media/analyze-image/route.js
app/api/media/transcribe-audio/route.js
app/api/media/analyze-video/route.js
```

### Modified Files
```
app/api/ai-chat/route.js           # Add media context
app/components/chat/VoiceMessage.js # Optional transcription display
app/components/chat/MessageItem.js  # Show media analysis status
```

### Environment Variables
```
GEMINI_API_KEY=your_api_key_here
```

---

## Success Metrics

- [ ] Poppy can describe any image sent in chat
- [ ] Voice messages are searchable by content
- [ ] Videos can be summarized with action items
- [ ] Response time < 5 seconds for images, < 15 seconds for short videos
- [ ] Cached results load instantly

