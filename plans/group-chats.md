# 👥 Group Chats: The iMessage Way

> **Status**: 📋 Ready to Build  
> **Priority**: 🔴 CRITICAL (users blocked without this)  
> **Timeline**: ~3 hours  
> **Branch**: `feature/group-chats`

---

## The Problem

Users literally cannot use Poppy properly because they can't create group conversations. Amaanath wants to talk to his sales team. Olivia wants to talk to the affiliate team. Right now? They can't.

This is table-stakes functionality. Let's build it.

---

## The Vision: iMessage Simplicity

We're not building Slack. We're building iMessage for teams.

| Feature | iMessage | Poppy |
|---------|----------|-------|
| Create group | ✅ Select 2+ people | ✅ Same |
| Add members | ✅ Anyone can add | ✅ Same |
| Remove members | ✅ Anyone can remove | ✅ Same |
| Roles/permissions | ❌ None | ❌ None |
| Group name | ✅ Auto-generated, editable | ✅ V1: Auto-generated |
| Complexity | Minimal | Minimal |

---

## UI Patterns (from iMessage)

### 1. Chat Header - Member Count Pill

When in a group chat, the header shows a clickable member count:

```
┌──────────────────────────────────────────────────────────────────┐
│  ←                    「3 People ›」                        ⋮    │
└──────────────────────────────────────────────────────────────────┘
                              ↑
                    Clickable pill/button
                    Opens Group Info Modal
```

**Behavior:**
- Shows "N People" where N = member count
- Chevron (›) indicates it's tappable
- Clicking opens the Group Info Modal

### 2. Group Info Modal

Clicking the member pill opens a modal (not sidebar, to match our existing patterns):

```
┌─────────────────────────────────────────────────────────────────┐
│                                                            ✕    │
│                                                                 │
│                         [👤👤👤]                                │
│                   (stacked avatars)                             │
│                                                                 │
│               Rafeh, Athena, and Amaanath                       │
│                  (auto-generated name)                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Members (3)                                                    │
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │
│  │    👤     │  │    👤     │  │    👤     │  │    ＋     │    │
│  │   Rafeh   │  │  Athena   │  │  Amaanath │  │    Add    │    │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │
│                                                                 │
│          (long-press/right-click member to remove)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Shows all members as avatar + name cards
- "+" button at the end to add members
- Long-press or right-click a member → "Remove from group" option
- Group name auto-generated from member names

### 3. Add Member Flow

Clicking the "+" button:

```
┌─────────────────────────────────────────────────────────────────┐
│  Add Member                                                ✕    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔍 Search team members...                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Team Members                                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 👤  David Qazi                              [Already in] │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 👤  Naz                                         [ Add ] │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 👤  Mohamed                                     [ Add ] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Shows all team members
- Already-in-group members are disabled/grayed
- Click "Add" → member added instantly
- `joinedAt` timestamp saved (for future "see from join date" feature)

### 4. Create Group Flow

From sidebar, user clicks "New Group" or compose button:

```
┌─────────────────────────────────────────────────────────────────┐
│  New Group                                                 ✕    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Select members to start a group chat                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔍 Search team members...                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Selected (2): [Athena ✕] [Amaanath ✕]                         │
│                                                                 │
│  Team Members                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☑ 👤  Athena Villard                                    │   │
│  │ ☑ 👤  Amaanath Mumtaz                                   │   │
│  │ ☐ 👤  David Qazi                                        │   │
│  │ ☐ 👤  Mohamed                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Create Group (2 members)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Multi-select team members
- Need at least 2 members to create
- Shows selected members as chips at top
- "Create Group" button → creates and opens chat

### 5. Sidebar - Groups Section

```
┌────────────────────────────┐
│  POPPY                     │
├────────────────────────────┤
│                            │
│  Channels                  │
│  ├─ # general              │
│  ├─ # design               │
│  └─ # engineering          │
│                            │
│  Groups              [＋]  │  ← NEW SECTION
│  ├─ 👥 Sales Team          │
│  ├─ 👥 Affiliate Team      │
│  └─ 👥 Rafeh, Athena...    │
│                            │
│  Direct Messages           │
│  ├─ 👤 David               │
│  ├─ 👤 Athena              │
│  └─ 👤 Amaanath            │
│                            │
└────────────────────────────┘
```

**Behavior:**
- New "Groups" section between Channels and DMs
- Shows group name (auto-generated or custom)
- [+] button to create new group
- Click to open group chat

---

## Data Model

### Firestore Schema

```javascript
// Collection: groups/{groupId}
{
  id: 'group_a1b2c3',                    // Auto-generated ID
  name: null,                             // Custom name (optional, V2)
  
  members: {                              // Map, not array (future-proof)
    'uid_rafeh': { 
      joinedAt: Timestamp                 // For future "see from join date"
    },
    'uid_athena': { 
      joinedAt: Timestamp 
    },
    'uid_amaanath': { 
      joinedAt: Timestamp 
    }
  },
  
  createdBy: 'uid_rafeh',                // Who created the group
  createdAt: Timestamp,                   // When created
  
  // Denormalized for easy display (updated when members change)
  memberCount: 3,
  memberNames: ['Rafeh', 'Athena', 'Amaanath'],
  memberAvatars: ['url1', 'url2', 'url3']
}

// Subcollection: groups/{groupId}/messages/{messageId}
// Same structure as DM messages
{
  text: 'Hey team!',
  sender: 'Rafeh Qazi',
  senderId: 'uid_rafeh',
  senderEmail: 'rafeh@example.com',
  photoURL: 'https://...',
  timestamp: Timestamp,
  
  // All the same fields as DM messages:
  // imageUrl, imageUrls, audioUrl, muxPlaybackIds, etc.
  // reactions, replyTo, edited, aiTags, etc.
}
```

### Why Members as a Map?

```javascript
// ❌ BAD - Would require schema migration later
members: ['uid1', 'uid2', 'uid3']

// ✅ GOOD - Future-proof
members: {
  'uid1': { joinedAt: timestamp },
  'uid2': { joinedAt: timestamp }
}
```

With the map approach:
- ✅ Add member = add key with `{ joinedAt: now }`
- ✅ Remove member = delete key
- ✅ "See from join date" = filter where `message.timestamp > member.joinedAt`
- ✅ Add roles later = `{ joinedAt, role: 'admin' }`
- ✅ No schema migration ever needed

### User Document Updates

```javascript
// users/{userId}
{
  // ... existing fields ...
  
  activeGroups: ['group_a1b2c3', 'group_x7y8z9'],  // NEW
}
```

---

## Firestore Security Rules

```javascript
// groups collection
match /groups/{groupId} {
  // Anyone can read groups they're a member of
  allow read: if request.auth != null 
              && request.auth.uid in resource.data.members;
  
  // Anyone can create a group
  allow create: if request.auth != null;
  
  // Members can update (add/remove members)
  allow update: if request.auth != null 
                && request.auth.uid in resource.data.members;
  
  // Members can delete (disband group)
  allow delete: if request.auth != null 
                && request.auth.uid in resource.data.members;
  
  // Messages subcollection
  match /messages/{messageId} {
    // Members can read messages
    allow read: if request.auth != null 
                && request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members;
    
    // Members can write messages
    allow write: if request.auth != null 
                 && request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members;
  }
}
```

---

## Implementation

### New Files

```
app/
├── components/
│   └── chat/
│       ├── GroupInfoModal.js       # Group info/members modal
│       ├── CreateGroupModal.js     # Create new group modal
│       └── AddMemberModal.js       # Add member to group modal
```

### Modified Files

```
app/
├── lib/
│   └── firestore.js               # Add group CRUD functions
├── components/
│   └── layout/
│       └── Sidebar.js             # Add Groups section
│   └── chat/
│       └── ChatHeader.js          # Show member count pill for groups
│       └── ChatWindow.js          # Support chatType: 'group'
│       └── ChatInput.js           # Support sending to groups
```

### firestore.js Functions to Add

```javascript
// Group CRUD
export async function createGroup(creatorUser, memberIds)
export async function addGroupMember(groupId, userId, userName, userAvatar)
export async function removeGroupMember(groupId, userId)
export async function getGroup(groupId)
export function subscribeToGroup(groupId, callback)
export function subscribeToUserGroups(userId, callback)

// Group Messages
export async function sendGroupMessage(groupId, user, text, linkPreview, options)
export async function sendGroupMessageWithMedia(groupId, user, text, imageUrls, muxPlaybackIds, ...)
export async function sendGroupMessageWithAudio(groupId, user, audioUrl, audioDuration)
export function subscribeToGroupMessages(groupId, callback, limit)
export async function loadOlderGroupMessages(groupId, oldestTimestamp, limit)
```

---

## AI/Ragie Integration

### Indexing Group Messages

When a message is sent in a group, we index to Ragie with:

```javascript
{
  messageId: docRef.id,
  chatId: groupId,
  chatType: 'group',                    // NEW: 'group' type
  text: messageText,
  sender: user.displayName,
  senderEmail: user.email,
  senderId: user.uid,
  timestamp: new Date().toISOString(),
  participants: Object.keys(members),   // All member UIDs
}
```

### Privacy Scoping

| Chat Type | Ragie Filter | Who Can Search |
|-----------|--------------|----------------|
| channel | `chatType: 'channel'` | Everyone |
| dm | `chatType: 'dm'` + `participants` contains user | Only the 2 people |
| group | `chatType: 'group'` + `participants` contains user | Only group members |

The retrieval router already supports `participants` filtering - we just need to pass the member array.

---

## Auto-Generated Group Names

### Logic

```javascript
function generateGroupName(memberNames) {
  if (memberNames.length === 2) {
    return `${memberNames[0]} and ${memberNames[1]}`
    // "Athena and Amaanath"
  }
  
  if (memberNames.length === 3) {
    return `${memberNames[0]}, ${memberNames[1]}, and ${memberNames[2]}`
    // "Rafeh, Athena, and Amaanath"
  }
  
  if (memberNames.length > 3) {
    const othersCount = memberNames.length - 2
    return `${memberNames[0]}, ${memberNames[1]}, and ${othersCount} others`
    // "Rafeh, Athena, and 3 others"
  }
}
```

### In Sidebar

- Show auto-generated name
- Truncate if too long: "Rafeh, Athena, and 3 ot..."

---

## Implementation Checklist

### Phase 1: Foundation (~1.5 hours)

- [ ] **Firestore Schema**
  - [ ] Create groups collection structure
  - [ ] Add security rules for groups
  - [ ] Add `activeGroups` to user document

- [ ] **firestore.js Functions**
  - [ ] `createGroup(creatorUser, memberIds)`
  - [ ] `addGroupMember(groupId, userId, userName, userAvatar)`
  - [ ] `removeGroupMember(groupId, userId)`
  - [ ] `subscribeToGroup(groupId, callback)`
  - [ ] `subscribeToUserGroups(userId, callback)`

- [ ] **Group Messaging**
  - [ ] `sendGroupMessage()` - copy from DM pattern
  - [ ] `sendGroupMessageWithMedia()` - copy from DM pattern
  - [ ] `sendGroupMessageWithAudio()` - copy from DM pattern
  - [ ] `subscribeToGroupMessages()`
  - [ ] `loadOlderGroupMessages()`

### Phase 2: UI (~1 hour)

- [ ] **Sidebar**
  - [ ] Add "Groups" section
  - [ ] Subscribe to user's groups
  - [ ] Show group names with 👥 icon
  - [ ] [+] button to create group

- [ ] **CreateGroupModal.js**
  - [ ] Member multi-select
  - [ ] Search/filter members
  - [ ] Selected members chips
  - [ ] "Create Group" button

- [ ] **ChatHeader.js**
  - [ ] Show "N People ›" pill for group chats
  - [ ] Click to open GroupInfoModal

- [ ] **GroupInfoModal.js**
  - [ ] Show stacked avatars
  - [ ] Show auto-generated name
  - [ ] Member cards with avatars
  - [ ] [+] Add member button
  - [ ] Long-press to remove member

- [ ] **AddMemberModal.js**
  - [ ] List all team members
  - [ ] Disable already-in-group members
  - [ ] Click to add

### Phase 3: Integration (~30 min)

- [ ] **ChatWindow.js**
  - [ ] Support `chatType: 'group'`
  - [ ] Load group messages
  - [ ] Pass groupId to ChatInput

- [ ] **ChatInput.js**
  - [ ] Support sending to groups
  - [ ] Same UI as DMs

- [ ] **Ragie Indexing**
  - [ ] Pass `chatType: 'group'`
  - [ ] Pass `participants` array (member UIDs)

- [ ] **Testing**
  - [ ] Create group
  - [ ] Send messages
  - [ ] Add member
  - [ ] Remove member
  - [ ] AI memory scoped correctly

---

## What's NOT in V1

| Feature | Why Not | When |
|---------|---------|------|
| Custom group name | Nice to have | V2 |
| Group avatar | Nice to have | V2 |
| Leave group | Can be simulated by remove self | V2 |
| See from join date | Schema supports it, not implemented | V2 |
| Typing indicators | Need to think about multi-user | V2 |
| Read receipts | Complexity | V2 |

---

## Success Metrics

- [ ] Users can create a group with 2+ people
- [ ] Users can send messages in groups
- [ ] Users can add members to existing groups
- [ ] Users can remove members from groups
- [ ] Groups appear in sidebar
- [ ] AI (@poppy) works in groups with proper memory scoping
- [ ] Images, videos, voice messages all work in groups

---

## Timeline

| Task | Time |
|------|------|
| Firestore schema + rules | 15 min |
| firestore.js group functions | 45 min |
| Sidebar groups section | 20 min |
| CreateGroupModal | 30 min |
| GroupInfoModal | 20 min |
| AddMemberModal | 15 min |
| ChatWindow/ChatInput support | 15 min |
| Ragie integration | 10 min |
| Testing | 10 min |
| **Total** | **~3 hours** |

---

## Let's Fucking Go

This is the boring but essential feature that unblocks everything else. Once we have groups, the team can actually use Poppy properly.

Then we get to the fun stuff: video intelligence, audio rooms, and all the AI magic.

🚀 Let's build it.

