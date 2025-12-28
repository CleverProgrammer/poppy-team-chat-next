# 🚀 Poppy Team Chat Roadmap

> **Last Updated:** December 28, 2025  
> **Pace:** Fast as fuck (AI-assisted)

---

## 🔥🔥🔥 CRITICAL: PERFORMANCE CRISIS 🔥🔥🔥

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ⚠️  40 MILLION FIRESTORE READS IN 2 WEEKS WITH 10 USERS  ⚠️                   │
│                                                                                  │
│  This is BROKEN. Something is horribly wrong. Fix this FIRST.                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 🚨 The Problems:
- [ ] **Every keystroke creates a Firestore request** - typing "hello" = 5 reads minimum
- [ ] **Listeners are opening and never closing** - memory leak central  
- [ ] **No virtualization** - rendering ALL messages instead of visible ones
- [ ] **Scroll performance is garbage** - users complaining constantly
- [ ] **Subscription hell** - multiple listeners for the same data

### 💡 Possible Solutions:
1. **Implement Virtuoso message list** (already purchased, never implemented)
   - Only render visible messages + buffer
   - Massive memory and performance win
2. **Audit ALL Firestore subscriptions**
   - Find where listeners open but never unsubscribe
   - Check for duplicate subscriptions
   - Add proper cleanup in useEffect returns
3. **Debounce/throttle input handling**
   - Don't hit Firestore on every keystroke
   - Batch updates where possible
4. **Firebase profiling**
   - Use Firebase console to identify hot paths
   - Check which queries are running most often
5. **Review subscription architecture**
   - Are we subscribing to entire collections when we need 1 doc?
   - Are subscriptions surviving component unmounts?

### 📊 Evidence of the Problem:
| Metric | Expected | Actual | WTF Factor |
|--------|----------|--------|------------|
| Reads/week (10 users) | ~100K | 20M+ | 200x over |
| Writes/week | ~10K | ~2M | 200x over |
| Listeners active | 5-10 | 40+ (?) | Memory bomb |

**Priority:** 🔴🔴🔴 **HIGHEST** - This is bankrupting us and ruining UX  
**Timeline:** ASAP - Before any new features  
**Assigned:** Outsourced developer (give them Virtuoso access)

---

## 🗺️ THE MAP

```
                                                    🏁 DESTINATION
                                                    ┌─────────────────┐
                                                    │ AI-Native Team  │
                                                    │ Communication   │
                                                    │ Platform        │
                                                    └────────┬────────┘
                                                             │
    ┌────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  🔥 CRITICAL: Virtualization & Firebase Performance (BLOCKING)                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              🚧 WHAT'S AHEAD                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ☐ Group Chats ←──── YOU ARE HERE (3-5 hrs)                                    │
│   │                                                                              │
│   ├──→ ☐ Video Intelligence (4-6 hrs)                                           │
│   │    └──→ ☐ YouTube/Loom Links (2-3 hrs)                                      │
│   │                                                                              │
│   ├──→ ☐ Audio Rooms + AI (6-8 hrs)                                             │
│   │    └──→ ☐ Video Calls (4-6 hrs)                                             │
│   │                                                                              │
│   ├──→ ☐ Smart Task Tracking (3-4 hrs)                                          │
│   │                                                                              │
│   ├──→ ☐ Announcement Center (2-3 hrs)                                          │
│   │                                                                              │
│   ├──→ ☐ Interview Analysis Mode (2-3 hrs)                                      │
│   │                                                                              │
│   └──→ 💡 Leaderboards (exploring)                                              │
│        💡 Goals Progress Bar (exploring)                                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
    │
    │ ~30 hours total
    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ✅ DONE: DMs • Channels • Images • Voice • Video • AI Chat • Push • iOS        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### ⚡ Quick Checklist

| # | Feature | Time | Status |
|---|---------|------|--------|
| 🔥 | **Virtualization & Firebase Perf** 🚨 | ASAP | 🔴🔴🔴 **CRITICAL** |
| 1 | [**Group Chats**](plans/group-chats.md) 👥 | 3-5 hrs | 🟡 In Progress |
| 2 | [Video Intelligence](plans/media-intelligence/video-understanding.md) 🎬 | 4-6 hrs | ⬜ Next |
| 2b | YouTube/Loom Links | 2-3 hrs | ⬜ |
| 3 | Audio Rooms 🎙️ | 6-8 hrs | ⬜ |
| 4 | [Smart Tasks](plans/ai-improvements/dm-tasks-system.md) 📋 | 3-4 hrs | ⬜ |
| 5 | [Announcement Center](plans/announcement-center.md) 📢 | 2-3 hrs | ⬜ |
| 6 | Video Calls 📹 | 4-6 hrs | ⬜ |
| 7 | Interview Analysis 🎯 | 2-3 hrs | ⬜ |
| 8 | Leaderboards 🏆 | 3-4 hrs | 💡 idea |
| 9 | Goals Widget 🎯 | 2-3 hrs | 💡 idea |

---

<details>
<summary>📦 What's Already Done (click to expand)</summary>

| Feature | Status | Docs |
|---------|--------|------|
| 1:1 DMs | ✅ Done | |
| Channels | ✅ Done | |
| Image Sharing + AI | ✅ Done | |
| Voice Messages + TLDR | ✅ Done | |
| Video Uploads (Mux) | ✅ Done | |
| AI Chat (@poppy) | ✅ Done | [AI Memory System](plans/ai-memory-system.md) |
| Push Notifications | ✅ Done | |
| iOS App | ✅ Done | |
| Group Chats | ✅ Done | [Plan](plans/group-chats.md) |

</details>

---

## 🎯 Roadmap Details

### Phase 1: [Group Chats](plans/group-chats.md) 👥
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

### Phase 2: [Video Intelligence](plans/media-intelligence/video-understanding.md) 🎬
**Priority:** 🟠 HIGH  
**Timeline:** 4-6 hours  
**Branch:** `feature/video-understanding`

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

### Phase 5: [Announcement Center](plans/announcement-center.md) 📢
**Priority:** 🟡 MEDIUM  
**Timeline:** 2-3 hours  
**Branch:** `feature/announcement-center`

Admin-only announcement system that pushes important updates to all team members with a beautiful modal experience.

#### What We're Building:
- [ ] Admin announcement creation (dev mode users only)
- [ ] Beautiful blur-background modal for announcements
- [ ] One-time display per announcement per user
- [ ] "Announcements" section in user profile dropdown
- [ ] Historical announcements list for all users
- [ ] Read/dismiss tracking per user

#### How It Works:
```
Admin creates announcement via profile dropdown → 
All users see beautiful modal on next app open →
User dismisses modal → Never see that announcement popup again →
Can view all past announcements from "Announcements" in profile menu
```

---

### Phase 6: Video Calls 📹
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

### Phase 7: Interview Analysis Mode 🎯
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

| Phase | Feature | Time | Target | Status |
|-------|---------|------|--------|--------|
| **🔥** | **Virtualization & Firebase** | ASAP | **BLOCKING** | 🔴 CRITICAL |
| **1** | Group Chats | 3-5 hrs | Week 1 | 🟡 In Progress |
| **2** | Video Intelligence | 4-6 hrs | Week 1 | ✅ Confirmed |
| **2b** | YouTube/Loom Links | 2-3 hrs | Week 1 | ✅ Confirmed |
| **3** | Audio Rooms (100ms) | 6-8 hrs | Week 2 | ✅ Confirmed |
| **4** | Smart Task Tracking | 3-4 hrs | Week 2 | ✅ Confirmed |
| **5** | Announcement Center | 2-3 hrs | Week 2 | ✅ Confirmed |
| **6** | Video Calls | 4-6 hrs | Week 3 | 🟡 Likely |
| **7** | Interview Analysis | 2-3 hrs | Week 3 | 🟡 Likely |
| **8** | Leaderboards | 3-4 hrs | TBD | 💡 Exploring |
| **9** | Goals Progress Bar | 2-3 hrs | TBD | 💡 Exploring |

**Total estimated time (confirmed):** ~25-35 hours  
**Total with exploring features:** ~30-40 hours  
**With AI-assisted dev:** ~3-4 weeks of focused work

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

### Phase 8: Team Leaderboards 🏆
**Priority:** 🟡 MEDIUM  
**Timeline:** 3-4 hours  
**Branch:** `feature/leaderboards`  
**Status:** 💡 IDEA (exploring)

Gamification that drives engagement and healthy competition.

#### What We're Building:
- [ ] **Activity Leaderboard**
  - Most messages sent (daily/weekly/monthly)
  - Most active users
  - Streak tracking (consecutive days active)
- [ ] **Sales Leaderboard** 
  - Track sales numbers per team member
  - Visual ranking with avatars
  - Competition mode: who's #1, who's lagging
- [ ] **Affiliate Partners Leaderboard**
  - Separate leaderboard for affiliate team
  - Track referrals, conversions, revenue
- [ ] **Team-Specific Leaderboards**
  - Each channel/group can have its own leaderboard
  - Customizable metrics per team

#### UI Ideas:
```
🏆 Weekly Leaderboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 🥇 David      → 247 messages
2. 🥈 Olivia     → 189 messages  
3. 🥉 Amaanath   → 156 messages
4.    Sarah      → 98 messages
5.    Mike       → 72 messages
```

---

### Phase 9: Team Goals Progress Bar 🎯
**Priority:** 🟡 MEDIUM  
**Timeline:** 2-3 hours  
**Branch:** `feature/goals-widget`  
**Status:** 💡 IDEA (exploring)

Show the team's north star metric at all times.

#### What We're Building:
- [ ] **Header Goal Widget**
  - Persistent progress bar in header (maybe in General channel)
  - Shows current value vs target
  - Animates when goal updates
- [ ] **Goal Configuration**
  - Admin can set goal type (revenue, sales, signups, etc.)
  - Set target value and deadline
  - Optional: multiple goals per channel
- [ ] **Real-time Updates**
  - Syncs with external data source (API integration later)
  - Or manually updated via command

#### UI Mockup:
```
╭──────────────────────────────────────────────╮
│ 💰 Monthly Revenue: $427,500 / $500,000      │
│ ████████████████████░░░░░░ 85.5%             │
╰──────────────────────────────────────────────╯
```

#### Advanced Ideas (Later):
- Celebration animations when goal hit
- Milestone notifications (50%, 75%, 90%)
- Historical goal tracking
- Poppy congratulates the team

---

## ✅ Certainty Levels

| Phase | Feature | Certainty | Notes |
|-------|---------|-----------|-------|
| **🔥** | Virtualization & Firebase | 🔴 **CRITICAL** | 40M reads/2 weeks is insane. BLOCKING. |
| **1** | Group Chats | ✅ **CONFIRMED** | Users literally waiting for this |
| **2** | Video Intelligence | ✅ **CONFIRMED** | Gemini 3 Pro for visual understanding |
| **2b** | YouTube/Loom Links | ✅ **CONFIRMED** | Natural extension of video |
| **3** | Audio Rooms | ✅ **CONFIRMED** | 100ms SDK - includes live transcription |
| **4** | Smart Task Tracking | ✅ **CONFIRMED** | AI auto-detection of completion |
| **5** | Announcement Center | ✅ **CONFIRMED** | Admin broadcasts to all users |
| **6** | Video Calls | 🟡 **LIKELY** | Builds on audio rooms |
| **7** | Interview Analysis | 🟡 **LIKELY** | Specialized video analysis |
| **8** | Leaderboards | 💡 **EXPLORING** | Gamification idea |
| **9** | Goals Progress Bar | 💡 **EXPLORING** | Team motivation widget |

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
- [ ] Polls in channels/groups
- [ ] Team standup bot (daily prompts)
- [ ] OKR tracking integration
- [ ] Mood/sentiment tracking over time

---

## 🚨 Known Gaps & Missing Features

These are known issues that need to be addressed. Use this as a litmus test when verifying features work.

### AI Retrieval Pollution (Critical!)

**Symptom:** User asks "what food did I get today?" and Poppy says "nothing found" even though the acai bowl message exists in Ragie.

**Root Cause:** AI chat messages (user questions + Poppy responses) are indexed to Ragie with `chatType: 'ai'`. When searching, these messages score HIGHER than actual content because:
- User's own questions are semantically identical to new queries (score 1.0)
- Poppy's "no food found" responses contain food keywords (score 0.65)
- Actual answer (acai bowl in group chat) is buried at position 11 (score 0.559)

**Evidence from Ragie:**
| Rank | Content | Score | Issue |
|------|---------|-------|-------|
| 1 | "what food did i get today?" (user question to AI) | 1.0 | Same query! |
| 6 | "No food mentions today!" (Poppy response) | 0.66 | AI response pollution |
| 11 | "thanks i just got the acai bowl!!" (actual answer) | 0.559 | ✅ Buried too low |

**Fix Options (Not Yet Implemented):**
1. **Filter out AI chat from retrieval** - Add `{ chatType: { $ne: 'ai' } }` to retrieval filter
2. **Don't index AI chat at all** - Skip `/api/tag` for AI chat messages
3. **Lower AI chat relevance** - Add negative boost for `chatType: 'ai'` in Ragie

**Files to fix:**
- `app/lib/retrieval-router.js`: Add exclusion filter for `chatType: 'ai'`
- OR `app/lib/firestore.js`: Don't call `/api/tag` for AI chat messages

---

### Tasks System

| Feature | DMs | Channels | Groups |
|---------|-----|----------|--------|
| Task detection (AI tagging) | ✅ Works | ✅ Works | ❌ **BROKEN** |
| Task creation (`handleTasksFromMessage`) | ✅ Works | ❓ Untested | ❌ **NOT CALLED** |
| Task completion from gratitude | ✅ Works | ❓ Untested | ❌ **NOT CALLED** |
| Task assignee resolution | ✅ DM recipient | ❓ Untested | ❌ **No logic** |

**Root Cause:** 
- Group message functions (`sendGroupMessage`, etc.) don't call `handleTasksFromMessage` after tagging
- `createTaskFromMessage` only handles `chatType === 'dm'` and defaults to channel - no `group` handling

**Files to fix:**
- `app/lib/firestore.js`: Add `handleTasksFromMessage` calls in all `sendGroup*` functions
- `app/lib/firestore.js`: Update `createTaskFromMessage` to handle `chatType === 'group'`

**Detailed plan:** [DM Tasks System](plans/ai-improvements/dm-tasks-system.md) (needs update for groups)

---

## 📚 System Documentation

These docs explain how core systems work. Use them as reference when building new features.

| Document | Purpose |
|----------|---------|
| [AI Memory System](plans/ai-memory-system.md) | How Ragie indexing, permissions, and retrieval work |
| [Task System](plans/ai-improvements/dm-tasks-system.md) | Auto-task detection & creation (DMs ✅, Groups ❌) |
| [Announcement Center](plans/announcement-center.md) | Admin broadcast system architecture |
| [Group Chats](plans/group-chats.md) | Group chat implementation details |
| [Image System](plans/media-intelligence/image-system.md) | How image analysis & indexing works |
| [Video Understanding](plans/media-intelligence/video-understanding.md) | Video processing pipeline |

### Testing New Features

Before shipping any feature that involves messages or AI, ensure it passes the **AI Memory Litmus Test**:

1. ✅ **Indexed**: Messages are sent to `/api/tag` for Ragie indexing
2. ✅ **Metadata**: All required fields included (`chatId`, `chatType`, `chatName`, `participants`)
3. ✅ **Permissions**: Retrieval respects the permission matrix (see AI Memory docs)
4. ✅ **Queryable**: Can ask Poppy "what did [person] say in [chat name]?" and get results

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

**Next up:** Phase 1 - [Group Chats](plans/group-chats.md)  
**Branch:** `feature/group-chats`

The boring but necessary feature that unblocks everything else. Users are literally waiting. Let's knock it out in a few hours and move on to the fun stuff.

---

*Built with love, caffeine, and an unreasonable amount of AI assistance* 🤖💜

