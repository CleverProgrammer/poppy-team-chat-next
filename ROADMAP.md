# 🚀 Poppy Team Chat Roadmap

> **Last Updated:** December 28, 2025  
> **Building With:** AI-assisted development (Cursor + Claude)  
> **Pace:** Fast as fuck

---

## The Vision

Poppy isn't just a chat app. It's an **AI-native team communication platform** that:
- Understands every message, image, video, and call
- Remembers everything and surfaces it when you need it
- Extracts action items and tracks completion automatically
- Makes your team's conversations searchable and intelligent

---

## Current Status ✅

| Feature | Status | Notes |
|---------|--------|-------|
| 1:1 DMs | ✅ Done | Full functionality |
| Channels | ✅ Done | Public channels working |
| Image Sharing | ✅ Done | Claude Vision analysis + Ragie indexing |
| Voice Messages | ✅ Done | AssemblyAI transcription + TLDR |
| Video Uploads | ✅ Done | Mux streaming |
| AI Chat (@poppy) | ✅ Done | Claude Sonnet + Ragie memory |
| Push Notifications | ✅ Done | Firebase Cloud Messaging |
| iOS App | ✅ Done | Capacitor native |

---

## 🎯 Roadmap

### Phase 1: Group Chats 👥
**Priority:** 🔴 CRITICAL (users blocked without this)  
**Timeline:** 3-5 hours  
**Branch:** `feature/group-chats`

People are literally not using the app because they can't create group conversations. This is table-stakes functionality.

#### What We're Building:
- [ ] Create group conversations (like iMessage groups)
- [ ] Add/remove members from groups
- [ ] Group naming and avatars
- [ ] Group message notifications
- [ ] Group appears in sidebar alongside DMs and channels
- [ ] @mentions work in groups
- [ ] Poppy AI works in groups (memory scoped to group)

#### Technical:
- New Firestore collection: `groups`
- Schema: `{ id, name, members[], avatar, createdBy, createdAt }`
- Messages stored in `groups/{groupId}/messages`
- Ragie indexing with `chatType: 'group'`

---

### Phase 2: Video Intelligence 🎬
**Priority:** 🟠 HIGH  
**Timeline:** 4-6 hours  
**Branch:** `feature/video-understanding`
**Plan:** `plans/media-intelligence/video-understanding.md`

When someone drops a video, Poppy should understand it - visually AND audibly.

#### What We're Building:
- [ ] Gemini 3 Pro integration for video analysis
- [ ] Auto-analyze uploaded videos (Mux)
- [ ] Show TLDR below video thumbnail
- [ ] Extract action items from video content
- [ ] Index video content to Ragie
- [ ] Answer questions about video content

#### Phase 2b: YouTube & Loom Links
**Timeline:** 2-3 hours (after Phase 2)

- [ ] Detect YouTube URLs in messages
- [ ] Fetch video metadata + analyze with Gemini
- [ ] Show TLDR in link preview
- [ ] Same for Loom links
- [ ] Index to Ragie for searchability

---

### Phase 3: Audio Rooms 🎙️
**Priority:** 🟡 MEDIUM-HIGH  
**Timeline:** 6-8 hours  
**Branch:** `feature/audio-rooms`
**SDK:** 100ms (audio rooms + live transcription)

Drop-in audio conversations with AI superpowers. Like Clubhouse/Twitter Spaces but for your team, with automatic transcription and AI analysis.

#### What We're Building:
- [ ] 100ms SDK integration
- [ ] "Start Audio Room" button in channels/groups
- [ ] Live audio room UI (speakers, listeners, raise hand)
- [ ] Join/leave room functionality
- [ ] Live transcription (100ms built-in)
- [ ] Room recording

#### AI Integration:
- [ ] When room ends → Get full transcript
- [ ] Gemini 3 Pro analysis: TLDR, action items, decisions
- [ ] Generate Mermaid mind map of the conversation
- [ ] Index to Ragie (searchable: "what did we discuss in that sync?")
- [ ] Auto-create tasks from action items
- [ ] Post summary to channel/group

#### Example Output:
```
🎙️ Audio Room Ended: "Design Sync"
Duration: 12 minutes | 3 participants

📝 TLDR: Discussed the new dashboard design. Decided to go with 
purple gradient theme. David will fix the API timeout before launch.

📋 Action Items:
• David: Fix API timeout issue (by Friday)
• Everyone: Review landing page (by Thursday EOD)

🗺️ Mind Map:
[Mermaid diagram rendered inline]

💾 Full transcript saved and indexed
```

---

### Phase 4: Smart Task Tracking 📋
**Priority:** 🟡 MEDIUM  
**Timeline:** 3-4 hours  
**Branch:** `feature/smart-tasks`

AI automatically detects when tasks are completed and updates them.

#### What We're Building:
- [ ] Task creation from action items (videos, calls, messages)
- [ ] Tasks linked to source (message/video/call)
- [ ] AI monitors chat for task completion signals
- [ ] Auto-update task status when completed
- [ ] Task dashboard view
- [ ] Notifications for task assignments

#### How It Works:
```
Audio Room: "David will fix the API timeout"
→ Task created: "Fix API timeout" assigned to David

Later in chat: "Just pushed the API fix, tested and working"
→ AI detects completion signal
→ Task auto-marked as complete ✅
→ Notification: "Poppy marked your task as complete"
```

---

### Phase 5: Video Calls 📹
**Priority:** 🟢 LOWER  
**Timeline:** 4-6 hours  
**Branch:** `feature/video-calls`
**SDK:** 100ms (upgrade from audio rooms)

Full video calling with the same AI analysis pipeline.

#### What We're Building:
- [ ] Video rooms (upgrade from audio rooms)
- [ ] Screen sharing
- [ ] Video recording
- [ ] Gemini 3 Pro analysis (sees the video, not just audio)
- [ ] Participant video quality detection
- [ ] Interview mode (professionalism analysis)

---

### Phase 6: Interview Analysis Mode 🎯
**Priority:** 🟢 LOWER  
**Timeline:** 2-3 hours  
**Branch:** `feature/interview-analysis`

Special analysis mode for candidate video submissions.

#### What We're Building:
- [ ] Mark video as "interview submission"
- [ ] Enhanced Gemini analysis:
  - Camera quality assessment
  - Lighting/background check
  - Professionalism notes
  - Content alignment with job requirements
- [ ] Comparison against company values (from Ragie)
- [ ] Red flag detection
- [ ] Interview summary card UI

---

## 📅 Timeline Overview

| Phase | Feature | Time | Target |
|-------|---------|------|--------|
| **1** | Group Chats | 3-5 hrs | Week 1 |
| **2** | Video Intelligence | 4-6 hrs | Week 1 |
| **2b** | YouTube/Loom Links | 2-3 hrs | Week 1 |
| **3** | Audio Rooms (100ms) | 6-8 hrs | Week 2 |
| **4** | Smart Task Tracking | 3-4 hrs | Week 2 |
| **5** | Video Calls | 4-6 hrs | Week 3 |
| **6** | Interview Analysis | 2-3 hrs | Week 3 |

**Total estimated time:** ~25-35 hours  
**With AI-assisted dev:** ~2-3 weeks of focused work

---

## 🛠️ Tech Stack Additions

| Feature | New Tech |
|---------|----------|
| Video Intelligence | Gemini 3 Pro API |
| Audio/Video Rooms | 100ms SDK |
| Mind Maps | Mermaid.js |
| Task Tracking | Firestore (existing) |

### Environment Variables Needed:
```bash
# Video Intelligence
GEMINI_API_KEY=...

# Audio/Video Rooms
HUNDREDMS_ACCESS_KEY=...
HUNDREDMS_SECRET=...

# Already have ✅
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
ASSEMBLYAI_API_KEY=...
RAGIE_API_KEY=...
KEYWORDS_AI_API_KEY=...
```

---

## 🔮 Future Ideas (Not Scheduled)

- [ ] Threaded replies in groups/channels
- [ ] Message reactions with AI-generated summaries
- [ ] Voice notes with waveform visualization
- [ ] Scheduled messages
- [ ] Message pinning
- [ ] Channel/group analytics
- [ ] AI-generated weekly team digests
- [ ] Integration with external tools (Notion, Linear, etc.)
- [ ] Custom AI personas per channel
- [ ] Video clipping ("clip the part where...") via Twelve Labs

---

## 📊 Success Metrics

| Metric | Target |
|--------|--------|
| Group chats adopted | 80% of active users create/join groups |
| Video TLDR accuracy | Users find summaries helpful 90%+ of time |
| Audio room usage | At least 1 room/week per active team |
| Task completion tracking | 85%+ accuracy on auto-detection |
| Time to insight | < 60 seconds from video upload to TLDR |

---

## 🎬 Let's Fucking Go

**Next up:** Phase 1 - Group Chats

The boring but necessary feature that unblocks everything else. Let's knock it out in a few hours and move on to the fun stuff.

---

*Built with love, caffeine, and an unreasonable amount of AI assistance* 🤖💜

