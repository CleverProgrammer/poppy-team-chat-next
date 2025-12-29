# 🧪 Pre-Commit Sanity Checklist

> **Purpose:** Prevent regressions and ensure feature parity across chat types.  
> **When to use:** Before merging ANY feature branch, run through this checklist.  
> **The lazy dev's testing strategy:** If AI thinks it's good, we're GUCCI. 🤙

---

## 🔥 The Golden Rule

**Every feature that works in one chat type MUST work in ALL chat types.**

| Chat Type | Collection | Example |
|-----------|------------|---------|
| Channel | `channels/{id}/messages` | #general, #design |
| DM | `dms/{id}/messages` | 1:1 conversations |
| Group | `groups/{id}/messages` | Multi-person chats |
| AI Chat | `aiChats/{userId}/messages` | Direct Poppy chat |

---

## ✅ Core Messaging Checklist

### 1. Basic Messaging

| Feature | Channels | DMs | Groups | AI Chat |
|---------|----------|-----|--------|---------|
| Send text message | ☐ | ☐ | ☐ | ☐ |
| Messages appear in real-time | ☐ | ☐ | ☐ | ☐ |
| Messages persist on refresh | ☐ | ☐ | ☐ | ☐ |
| Reply to message | ☐ | ☐ | ☐ | N/A |
| Edit message | ☐ | ☐ | ☐ | N/A |
| Delete message | ☐ | ☐ | ☐ | N/A |

### 2. Media Support

| Feature | Channels | DMs | Groups | AI Chat |
|---------|----------|-----|--------|---------|
| Send single image | ☐ | ☐ | ☐ | N/A |
| Send multiple images | ☐ | ☐ | ☐ | N/A |
| Send video (Mux) | ☐ | ☐ | ☐ | N/A |
| Send voice message | ☐ | ☐ | ☐ | N/A |
| Voice transcription works | ☐ | ☐ | ☐ | N/A |
| Link previews | ☐ | ☐ | ☐ | N/A |

---

## 🤖 AI (Poppy) Checklist

### 3. AI Responses

| Feature | Channels | DMs | Groups | AI Chat |
|---------|----------|-----|--------|---------|
| @poppy triggers AI response | ☐ | ☐ | ☐ | Auto |
| AI response appears in chat | ☐ | ☐ | ☐ | ☐ |
| AI typing indicator shows | ☐ | ☐ | ☐ | ☐ |
| AI status updates (thinking, searching) | ☐ | ☐ | ☐ | ☐ |
| Private AI mode works | ☐ | ☐ | ☐ | N/A |
| AI error messages appear | ☐ | ☐ | ☐ | ☐ |

**Quick Test:**
```
Type: @poppy what's 2+2?
Expected: AI responds with "4" (or similar) in the same chat
```

### 4. AI Memory/Search (Ragie)

| Feature | Channels | DMs | Groups | AI Chat |
|---------|----------|-----|--------|---------|
| @poppy what did [person] say about X? | ☐ | ☐ | ☐ | ☐ |
| AI finds recent messages | ☐ | ☐ | ☐ | ☐ |
| AI respects privacy (only searches accessible chats) | ☐ | ☐ | ☐ | ☐ |

**Quick Test:**
```
1. Send "I love tacos" in a group
2. Ask @poppy "what food did I mention?"
3. Expected: AI finds the taco message
```

---

## 📋 Tasks Checklist

### 5. Task Detection & Creation

| Feature | Channels | DMs | Groups |
|---------|----------|-----|--------|
| Task auto-detected from message | ☐ | ☐ | ☐ |
| Task appears in TasksSection | ☐ | ☐ | ☐ |
| Task has correct assignee | ☐ | ☐ | ☐ |
| Task has correct chat name | ☐ | ☐ | ☐ |
| Task completion via "thanks" works | ☐ | ☐ | ☐ |

**Quick Test:**
```
Type: Can you send me the report by Friday?
Expected: Task auto-created with due date
```

### 6. Task Management

| Feature | Test |
|---------|------|
| Mark task complete (checkbox) | ☐ |
| Task shows completed state | ☐ |
| Task appears in "My Tasks" modal | ☐ |

---

## 🔍 Ragie Indexing Checklist

### 7. Message Indexing

Every message sent should be indexed to Ragie with proper metadata.

| Metadata Field | Channels | DMs | Groups |
|----------------|----------|-----|--------|
| `chatType` correct | ☐ `channel` | ☐ `dm` | ☐ `group` |
| `chatId` correct | ☐ | ☐ | ☐ |
| `chatName` human-readable | ☐ | ☐ | ☐ |
| `sender` correct | ☐ | ☐ | ☐ |
| `participants` array (for permissions) | N/A | ☐ | ☐ |
| `timestamp` correct | ☐ | ☐ | ☐ |

**Where to check:** `/api/tag` endpoint receives correct data.

### 8. Ragie Permissions

| Scenario | Expected Result |
|----------|-----------------|
| User asks about channel message | ✅ Should find it (channels are public) |
| User asks about their own DM | ✅ Should find it |
| User asks about someone else's DM | ❌ Should NOT find it |
| User asks about group they're in | ✅ Should find it |
| User asks about group they're NOT in | ❌ Should NOT find it |

**Quick Test:**
```
1. User A sends "secret code 12345" in a DM to User B
2. User C asks Poppy "what's the secret code?"
3. Expected: Poppy should NOT find the message (User C not in that DM)
```

---

## 🔔 Notifications Checklist

### 9. Unread Indicators

| Feature | Channels | DMs | Groups |
|---------|----------|-----|--------|
| Unread badge appears | ☐ | ☐ | ☐ |
| Unread clears when chat opened | ☐ | ☐ | ☐ |
| Sidebar shows unread count | ☐ | ☐ | ☐ |

### 10. Push Notifications (iOS/Web)

| Feature | Test |
|---------|------|
| New DM triggers push | ☐ |
| New group message triggers push | ☐ |
| @mention triggers push | ☐ |
| Clicking notification opens correct chat | ☐ |

---

## 🏗️ UI/UX Checklist

### 11. Sidebar

| Feature | Test |
|---------|------|
| Channels section shows all channels | ☐ |
| Groups section shows user's groups | ☐ |
| DMs section shows active DMs | ☐ |
| Poppy AI appears in sidebar | ☐ |
| Click navigates to correct chat | ☐ |
| Unread indicators visible | ☐ |

### 12. Chat Header

| Chat Type | Expected Header |
|-----------|-----------------|
| Channel | # channel-name |
| DM | User name + avatar |
| Group | "N People ›" (clickable) |
| AI Chat | Poppy branding |

### 13. Chat Input

| Feature | Channels | DMs | Groups | AI Chat |
|---------|----------|-----|--------|---------|
| Text input works | ☐ | ☐ | ☐ | ☐ |
| Image upload button | ☐ | ☐ | ☐ | N/A |
| Voice record button | ☐ | ☐ | ☐ | N/A |
| @mention autocomplete | ☐ | ☐ | ☐ | ☐ |
| Emoji picker | ☐ | ☐ | ☐ | ☐ |

---

## 📱 Mobile (Capacitor/iOS) Checklist

### 14. iOS Specific

| Feature | Test |
|---------|------|
| App launches without crash | ☐ |
| Navigation works | ☐ |
| Keyboard handling | ☐ |
| Push notifications | ☐ |
| Safe area insets | ☐ |
| Haptic feedback | ☐ |

---

## 🔒 Permissions Matrix Reference

Use this to verify Ragie search results respect privacy:

| Chat Type | Who Can Search | Ragie Filter |
|-----------|---------------|--------------|
| Channel | Everyone | `chatType: 'channel'` |
| DM | Only the 2 participants | `chatType: 'dm'` AND `participants` contains user |
| Group | Only group members | `chatType: 'group'` AND `participants` contains user |
| AI Chat | Only that user | `chatType: 'ai'` AND `userId` matches |

---

## 🚨 Common Regressions to Watch For

### The "AI in Groups" Bug (Fixed Dec 29, 2025)
**Symptom:** AI never responds in group chats  
**Cause:** `useAI.js` only handled `channel` and `dm`, not `group`  
**File:** `app/hooks/useAI.js`

### The "Tasks in Groups" Bug (Fixed Dec 29, 2025)
**Symptom:** Tasks never created from group messages  
**Cause:** `handleTasksFromMessage` not called in `sendGroup*` functions  
**File:** `app/lib/firestore.js`

### The "Ugly Group Names" Bug (Fixed Dec 29, 2025)
**Symptom:** Tasks show group ID instead of group name  
**Cause:** `createTaskFromMessage` didn't handle `chatType === 'group'`  
**File:** `app/lib/firestore.js`

### The "AI Retrieval Pollution" Bug (OPEN)
**Symptom:** User's own AI questions show up in search results  
**Cause:** AI chat messages indexed to Ragie and score higher than actual content  
**Fix needed:** Filter out `chatType: 'ai'` from retrieval  
**File:** `app/lib/retrieval-router.js`

---

## 📝 Pre-Commit Sign-Off Template

Before merging, copy this and fill it out:

```markdown
## Pre-Commit Checklist - [Feature Name]
**Branch:** `feature/xyz`
**Date:** YYYY-MM-DD
**Tested by:** [Your name]

### Core Features
- [ ] Messaging works in: Channels / DMs / Groups
- [ ] AI (@poppy) works in: Channels / DMs / Groups
- [ ] Tasks work in: Channels / DMs / Groups
- [ ] Ragie indexing correct for all chat types
- [ ] Ragie permissions respected

### Specific to This Feature
- [ ] [Feature-specific test 1]
- [ ] [Feature-specific test 2]

### No Regressions
- [ ] Existing features still work
- [ ] Console has no new errors
- [ ] No breaking changes to other chat types

**Ready to merge:** ✅ / ❌
```

---

## 🔧 Quick Reference: Key Files

| Purpose | File |
|---------|------|
| AI responses | `app/hooks/useAI.js` |
| Message sending (all types) | `app/lib/firestore.js` |
| Task creation | `app/lib/firestore.js` → `handleTasksFromMessage`, `createTaskFromMessage` |
| Ragie indexing | `/api/tag/route.js` |
| Ragie retrieval | `app/lib/retrieval-router.js` |
| AI chat endpoint | `/api/ai-chat/route.js` |

---

## 💡 Tips for AI Assistants (Claude, Cursor, etc.)

When implementing new features:

1. **Check all chat types** - If adding a feature to channels, add it to DMs and groups too
2. **Follow existing patterns** - Look at how DMs do it, then replicate for groups
3. **Update the checklist** - Add new feature to this checklist
4. **Update the roadmap** - Mark features as done in `ROADMAP.md`
5. **Run through this checklist** - Before saying "done", verify everything

The goal: **Never ship a feature that only works in one chat type.**

---

*Last updated: December 29, 2025*

