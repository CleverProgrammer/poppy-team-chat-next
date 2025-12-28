# 🎬 Poppy Gets Eyes AND Ears: The Video Understanding Saga

> **Status**: 📋 Ready to Build  
> **Priority**: 🔥 HIGH  
> **Prerequisite**: Audio ✅ | Images ✅ | Now it's VIDEO time baby  
> **Core Tech**: Google Gemini 2.5 Pro (State-of-the-Art Video Intelligence)

---

## The Dream

Picture this: Someone drops a 10-minute video in the team chat. Old Poppy? Just stares at it like a confused golden retriever. New Poppy? Watches the whole thing, understands what's happening visually AND audibly, who's talking, what's on screen, what decisions were made, and can chat about it like she was in the room.

**That's what we're building.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  🎥 User: *drops video* "Hey @poppy what did Rafeh say about the launch?"  │
│                                                                             │
│  🌸 Poppy: "Rafeh said the launch is moved to Friday because the API       │
│            integration took longer than expected. He also showed the new   │
│            dashboard design in Figma around 2:34 - looks like a purple     │
│            gradient theme with the updated nav. He wants everyone to       │
│            review the landing page before EOD Thursday."                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why Gemini Over AssemblyAI?

We already have AssemblyAI working great for audio/voice messages. But for VIDEO, we need VIDEO intelligence. Here's why:

### The Use Cases That Broke AssemblyAI

| Scenario | AssemblyAI (Audio-Only) | Gemini (Full Video) |
|----------|------------------------|---------------------|
| **David's silent screen recording** | "..." (nothing) | "David demonstrates API setup in Postman, creates collection, adds Bearer token, tests /users endpoint" |
| **Candidate interview** | "I'm passionate about clean code..." | "Candidate in dimly lit room, pixelated camera, wrinkled shirt, pizza boxes visible. Speaks confidently about clean code." |
| **Loom with screen share** | Gets explanation, misses the design | "Designer shows Figma homepage redesign with gradient hero, new CTA placement, purple color scheme" |
| **Camera off/bad quality** | No idea | "Camera is off" / "Very low resolution webcam" |

**The verdict:** If you can't SEE the video, you're missing half the story.

### What Poppy Already Knows

| Media Type | Status | How |
|------------|--------|-----|
| 🖼️ **Images** | ✅ DONE | Claude Vision (Sonnet 4.5) - sees EVERYTHING |
| 🎙️ **Audio** | ✅ DONE | AssemblyAI (93.3% accuracy) - hears EVERYTHING |
| 🎬 **Video** | ❌ TODO | **Gemini 2.5 Pro** (sees + hears EVERYTHING - SOTA) |

---

## The Grand Plan

### Phase 1: Uploaded Videos (Mux) 🎬

When someone uploads a video to the chat (via Mux), we need to:

1. **Send Full Video to Gemini** → Complete understanding (visual + audio)
2. **Generate a Smart Summary** → TLDR, action items, key moments
3. **Index to Ragie** → Searchable forever
4. **Enable Q&A** → Chat with the video like it's a teammate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER UPLOADS VIDEO                                                         │
│  (via Mux direct upload - already implemented)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MUX PROCESSING                                                             │
│                                                                             │
│  → Video encoded & ready for streaming                                      │
│  → Playback ID generated                                                    │
│  → MP4 rendition available for processing                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GEMINI VIDEO ANALYSIS                                                      │
│  /api/media/analyze-video                                                   │
│                                                                             │
│  Gemini sees EVERYTHING:                                                    │
│  → What's on screen (UI, code, presentations, Figma, demos)                │
│  → What's being said (transcription/understanding)                          │
│  → Who's on camera (faces, expressions, professionalism)                   │
│  → Quality signals (camera quality, lighting, setup)                       │
│  → Context clues (professional studio vs messy room)                       │
│  → Action items mentioned                                                   │
│  → Key timestamps for important moments                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SMART SUMMARY GENERATION                                                   │
│                                                                             │
│  Gemini generates:                                                          │
│  → TLDR (casual, punchy, team-friendly)                                     │
│  → What was shown (visual content summary)                                  │
│  → What was said (spoken content summary)                                   │
│  → Action items (with speaker names + timestamps)                           │
│  → Key moments with timestamps                                              │
│  → Quality/professionalism notes (for interviews)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RAGIE INDEXING                                                             │
│                                                                             │
│  Document created with:                                                     │
│  - Full video analysis text                                                 │
│  - Visual + audio summary                                                   │
│  - Speaker information                                                      │
│  - Timestamps                                                               │
│  - Metadata (sender, channel, video URL, duration)                          │
│                                                                             │
│  NOW SEARCHABLE: "what did rafeh show in that figma demo?"                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 2: YouTube Links 🔗

When someone pastes a YouTube link, Poppy should instantly understand what that video is about - both visually and content-wise.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER PASTES YOUTUBE LINK                                                   │
│  "Hey check this out: https://youtube.com/watch?v=abc123"                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LINK DETECTION                                                             │
│                                                                             │
│  → Regex detects YouTube URL pattern                                        │
│  → Extract video ID                                                         │
│  → Trigger background processing                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  YOUTUBE METADATA FETCH                                                     │
│                                                                             │
│  → Fetch video title, description, thumbnail                                │
│  → Get video duration                                                       │
│  → Extract channel name                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GEMINI VIDEO ANALYSIS                                                      │
│                                                                             │
│  Option A: Direct YouTube URL to Gemini                                     │
│  → Gemini can process YouTube URLs directly!                                │
│  → Full visual + audio understanding                                        │
│                                                                             │
│  Option B: Fetch transcript + key frames                                    │
│  → YouTube captions API                                                     │
│  → Sample key frames for visual context                                     │
│  → Send to Gemini for analysis                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AI ANALYSIS + RAGIE INDEXING                                               │
│                                                                             │
│  Same pipeline as uploaded videos:                                          │
│  → Summary, topics, action items                                            │
│  → Visual content description                                               │
│  → Index to Ragie with YouTube metadata                                     │
│  → Now searchable alongside team content                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 3: Loom Integration 🔗 (Future)

Loom videos are the perfect use case for Gemini - screen share + face bubble combo.

- Detect Loom URLs
- Fetch video via Loom API (or direct URL)
- Send to Gemini for full analysis
- Perfect for: demos, tutorials, async updates, interview submissions

---

## Technical Implementation

### New Files to Create

```
app/
├── api/
│   └── media/
│       └── analyze-video/
│           └── route.js          # Main video analysis endpoint (Gemini)
│       └── youtube-transcript/
│           └── route.js          # YouTube-specific handling
│
├── lib/
│   └── gemini-client.js          # Gemini SDK setup
│
└── api/
    └── ragie/
        └── sync-video/
            └── route.js          # Index video content to Ragie
```

### Modified Files

```
app/
├── components/
│   └── chat/
│       └── MessageItem.js        # Show video TLDR + action items
│       └── LinkPreview.js        # Enhanced YouTube previews
│       └── VideoThumbnail.js     # Loading states for processing
│
├── hooks/
│   └── useMuxUpload.js           # Trigger analysis after upload
│
└── api/
    └── ai-chat/
        └── route.js              # Add video context to AI responses
```

---

## API Design

### `POST /api/media/analyze-video`

**Purpose:** Analyze an uploaded video using Gemini

**Request:**
```javascript
{
  videoUrl: "https://stream.mux.com/xyz123/high.mp4",
  muxAssetId: "asset_xyz",
  muxPlaybackId: "playback_xyz",
  messageId: "msg_abc123",
  sender: "Rafeh Qazi",
  senderId: "user_123",
  chatId: "general",
  chatType: "channel",
  analysisType: "team_video" | "interview" | "demo"  // Optional, affects prompts
}
```

**Response:**
```javascript
{
  success: true,
  analysis: {
    tldr: "team standup - rafeh showing new dashboard design, launch pushed to friday 🚀",
    
    visual: {
      summary: "Video shows Rafeh at his desk, then screen share of Figma with dashboard mockups. Purple gradient theme, new navigation layout, updated CTA buttons.",
      keyFrames: [
        { timestamp: "0:15", description: "Rafeh introduces the topic" },
        { timestamp: "1:30", description: "Screen share begins - Figma dashboard" },
        { timestamp: "3:45", description: "Close-up of new navigation design" }
      ]
    },
    
    audio: {
      summary: "Discussion about launch timeline and design review process",
      speakers: ["Rafeh"],
      keyQuotes: [
        { timestamp: "2:34", speaker: "Rafeh", quote: "Launch is moved to Friday" }
      ]
    },
    
    actionItems: [
      { who: "Everyone", what: "Review landing page", when: "Thursday EOD", timestamp: "2:34" },
      { who: "David", what: "Fix API timeout issue", when: "ASAP", timestamp: "4:12" }
    ],
    
    duration: "5m 32s",
    
    // For interview analysis
    professionalism: {
      cameraQuality: "good",
      lighting: "professional",
      background: "clean home office",
      attire: "business casual",
      notes: "Candidate presents professionally with good eye contact"
    }
  },
  ragie: {
    indexed: true,
    documentId: "ragie_doc_xyz"
  },
  cost: {
    geminiTokens: 15000,
    estimatedCost: 0.08
  }
}
```

---

## Gemini Setup

### Model Selection

| Model | Best For | Limits | Why |
|-------|----------|--------|-----|
| **Gemini 2.5 Pro** | ALL video analysis | 2M tokens (~2 hours video) | State-of-the-art. Best multimodal reasoning. Outperforms everything else on video benchmarks. |

**Recommendation:** Use **Gemini 2.5 Pro** for everything. It's Google's flagship model with the best video understanding capabilities. Don't cheap out - this is the best model available for video comprehension.

### Why Gemini 2.5 Pro?

- **2 million token context window** - can analyze ~2 hours of video in one shot
- **State-of-the-art performance** - leads on all video understanding benchmarks
- **Superior multimodal reasoning** - understands visual + audio + context together
- **High-precision analysis** - catches details other models miss

### Video Limits

- **Max file size:** 2 GB
- **Max duration:** ~2 hours (with 2M token context)
- **Supported formats:** MP4, MOV, WEBM, AVI, MKV, etc.

### Environment Variables

```bash
# Required for Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Already have
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
RAGIE_API_KEY=...
```

---

## User Experience

### Video Message Display

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Rafeh Qazi                                                     2:30 PM    │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  🎬 ▶️  [Video Thumbnail]                                          │    │
│  │        ┌──────────────────────────────────────────┐                │    │
│  │        │                                          │                │    │
│  │        │                                          │   5:32         │    │
│  │        │                                          │                │    │
│  │        └──────────────────────────────────────────┘                │    │
│  │                                                                    │    │
│  │  📝 tldr: team standup - new dashboard design in figma,           │    │
│  │     launch pushed to friday, need landing page review 🚀          │    │
│  │                                                                    │    │
│  │  📋 2 Action Items                                                 │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  "quick standup recording from today's sync"                               │
└────────────────────────────────────────────────────────────────────────────┘
```

### What Users See:
1. **Video thumbnail** (clickable to play)
2. **TLDR** - Casual, punchy summary (like images)
3. **Action items count** (if any were extracted)
4. **Original caption** (if user added one)

No full transcription shown - just the TLDR. Keep it clean.

---

## Ragie Integration

### Video Document Schema

```javascript
{
  content: `
    [Video shared by Rafeh Qazi in #general]
    Duration: 5m 32s
    
    VISUAL CONTENT:
    Rafeh at his desk, then screen share of Figma dashboard mockups.
    Purple gradient theme, new navigation layout, updated CTA buttons.
    
    SPOKEN CONTENT:
    Discussion about launch timeline. Key decision: Launch moved from 
    Wednesday to Friday due to API integration delays.
    
    ACTION ITEMS:
    - Everyone: Review landing page by Thursday EOD (2:34)
    - David: Fix API timeout issue ASAP (4:12)
    
    KEY MOMENTS:
    - 0:15: Rafeh introduces the topic
    - 1:30: Screen share begins - Figma dashboard
    - 3:45: Close-up of new navigation design
  `,
  
  metadata: {
    messageId: "msg_abc123",
    sender: "Rafeh Qazi",
    timestamp: "2024-12-27T14:30:00Z",
    chatType: "channel",
    chatId: "general",
    contentType: "video",
    
    // Video-specific
    muxPlaybackId: "playback_xyz",
    videoDuration: 332,
    videoDurationFormatted: "5m 32s",
    hasActionItems: true,
    actionItemCount: 2,
    hasScreenShare: true,
    
    // For search
    topics: ["dashboard design", "launch timeline", "figma"],
    tldr: "team standup - new dashboard design, launch pushed to friday"
  }
}
```

---

## Cost Analysis

### Per Video (Gemini 2.5 Pro)

| Component | Cost | Example (5 min video) |
|-----------|------|----------------------|
| Gemini 2.5 Pro | Market rate | ~$0.15-0.30 |
| Ragie Indexing | ~$0.001 | $0.001 |
| **Total** | | **~$0.15-0.30/video** |

### For Longer Videos (10+ min)

| Component | Cost | Example (15 min video) |
|-----------|------|----------------------|
| Gemini 2.5 Pro | Market rate | ~$0.40-0.60 |
| Ragie Indexing | ~$0.001 | $0.001 |
| **Total** | | **~$0.40-0.60/video** |

**Monthly Estimate (50 team videos):** ~$15-25

Worth every penny for actual video intelligence vs audio-only bullshit.

---

## Implementation Checklist

### Phase 1: Uploaded Videos (Week 1)

- [ ] Set up Gemini
  - [ ] Get API key from Google AI Studio
  - [ ] Create `app/lib/gemini-client.js`
  - [ ] Add `GEMINI_API_KEY` to environment

- [ ] Create `/api/media/analyze-video/route.js`
  - [ ] Accept Mux playback ID or video URL
  - [ ] Get MP4 rendition URL from Mux API
  - [ ] Send video to Gemini for analysis
  - [ ] Parse response into structured format
  - [ ] Return TLDR, action items, key moments

- [ ] Create `/api/ragie/sync-video/route.js`
  - [ ] Accept video analysis + metadata
  - [ ] Format for Ragie schema
  - [ ] Index to Ragie
  - [ ] Store document ID with message

- [ ] Modify `useMuxUpload.js`
  - [ ] Trigger video analysis after upload complete
  - [ ] Store analysis results in Firestore message

- [ ] Update `MessageItem.js`
  - [ ] Show video TLDR below thumbnail
  - [ ] Show action items count badge
  - [ ] Loading states during processing

### Phase 2: YouTube Links (Week 2)

- [ ] Create `/api/media/youtube-transcript/route.js`
  - [ ] Extract video ID from URL
  - [ ] Fetch metadata (title, channel, thumbnail)
  - [ ] Send to Gemini for full analysis
  - [ ] Generate summary

- [ ] Enhance `LinkPreview.js`
  - [ ] Special handling for YouTube links
  - [ ] Show TLDR after analysis
  - [ ] Beautiful YouTube-specific card design

### Phase 3: AI Integration (Week 3)

- [ ] Update `ai-chat/route.js`
  - [ ] Check for video content in recent messages
  - [ ] Inject video context into system prompt
  - [ ] Handle video-related queries

### Phase 4: Interview Mode (Week 4)

- [ ] Add interview analysis prompt
  - [ ] Professionalism assessment
  - [ ] Camera/lighting quality
  - [ ] Background appropriateness
  - [ ] Body language notes

- [ ] UI for interview analysis view
  - [ ] Separate "Interview Analysis" card
  - [ ] Professionalism scores/notes
  - [ ] Red flags highlighted

---

## Success Metrics

- [ ] Videos are analyzed within 30-60 seconds of upload
- [ ] TLDR appears below video thumbnail
- [ ] Screen recordings are summarized accurately (not just audio)
- [ ] Silent demos are understood
- [ ] Video content is searchable via "show me that video where..."
- [ ] Poppy can answer questions about video content accurately
- [ ] Action items are extracted with 90%+ accuracy
- [ ] Interview mode catches unprofessional setups

---

## Future Enhancements 🔮

### Near-Term
- [ ] Loom integration
- [ ] Vimeo integration  
- [ ] Timestamp-linked Q&A ("what happens at 2:30?")
- [ ] Auto-generate video chapters/segments

### Long-Term (see `future-twelve-labs.md`)
- [ ] Natural language video clipping ("clip the part about the launch")
- [ ] Video search across all team content
- [ ] Meeting highlight reels
- [ ] Face recognition for "videos with X person"

---

## Environment Variables Needed

```bash
# NEW - Required for Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Already have ✅
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
KEYWORDS_AI_API_KEY=...
RAGIE_API_KEY=...
ASSEMBLYAI_API_KEY=...  # Still used for voice messages
```

---

## tldr

**We're giving Poppy the ability to WATCH and understand videos with Gemini 2.5 Pro - the best video AI model available.**

Upload a video? She'll see what's on screen, hear what's being said, extract action items, and make it all searchable. Drop a YouTube link? Same thing. Silent screen recording? No problem - she can SEE it. Interview submission? She'll assess the candidate's professionalism, setup, and content.

Audio understanding (AssemblyAI) is still used for voice messages. But for VIDEO, we need the BEST video intelligence - and that's Gemini 2.5 Pro.

**Poppy is about to become the teammate who actually watches all the meeting recordings AND notices when someone's camera is off.** 

🎬 👁️ 🍿 Let's cook.
