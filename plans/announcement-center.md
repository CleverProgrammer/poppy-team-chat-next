# 📢 Announcement Center

> **Status**: ✅ IMPLEMENTED  
> **Priority**: 🟡 MEDIUM  
> **Completed**: December 28, 2025  
> **Branch**: `feature/announcement-center` (merged to main)

---

## The Problem

When you want to communicate something important to the entire team, there's no elegant way to do it. You have to post in a channel and hope everyone sees it. With an announcement center, you can push important updates to everyone with a beautiful modal that demands attention.

---

## The Vision: Beautiful, Non-Intrusive Announcements

Think of it like iOS app update modals or those beautiful product announcements - a gorgeous blur-background modal that appears once, delivers the message, and never bothers you again.

| Feature | Admin View | Regular User View |
|---------|------------|-------------------|
| See announcements list | ✅ Full history | ✅ Full history |
| Create announcements | ✅ Yes | ❌ No |
| Dismiss modal | ✅ Yes | ✅ Yes |
| Never see popup again | ✅ Once dismissed | ✅ Once dismissed |

---

## UI Patterns

### 1. Profile Dropdown - "Announcements" Menu Item

In the user profile dropdown (top left), add "Announcements" option:

```
┌────────────────────────────────┐
│  📋 My Tasks                   │
│  📢 Announcements              │  ← NEW
│  🔐 Set Password               │
│  🛠️ Dev Mode       [ON/OFF]   │  ← Only for admins
│  🚪 Sign Out                   │
└────────────────────────────────┘
```

### 2. Announcements List Modal

When user clicks "Announcements", show a beautiful modal with all announcements:

**For Regular Users:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                            ✕    │
│                                                                 │
│                         📢 Announcements                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🎉 Welcome to Poppy 2.0!                                  │ │
│  │ Dec 28, 2025                                              │ │
│  │                                                           │ │
│  │ We've completely redesigned the app with new features...  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🚀 Video Messages are here!                               │ │
│  │ Dec 20, 2025                                              │ │
│  │                                                           │ │
│  │ You can now record and send video messages directly...    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 📋 Task Auto-Detection                                    │ │
│  │ Dec 15, 2025                                              │ │
│  │                                                           │ │
│  │ Poppy now automatically detects tasks in your messages... │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**For Admin Users (dev mode):**
Same as above, but with a "New Announcement" button:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                            ✕    │
│                                                                 │
│              📢 Announcements       [+ New Announcement]        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  (same list as above)                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Create Announcement Modal (Admin Only)

When admin clicks "+ New Announcement":

```
┌─────────────────────────────────────────────────────────────────┐
│  New Announcement                                          ✕    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Title                                                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Welcome to Poppy 2.0!                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Emoji (optional)                                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🎉                                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Message                                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ We've completely redesigned the app with amazing new      │ │
│  │ features. Check out video messages, group chats, and      │ │
│  │ more!                                                     │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              📢  Publish Announcement                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Announcement Popup Modal (Auto-Show on App Open)

When user opens the app and there's a new unread announcement, show a beautiful fullscreen modal with blur background:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ╭─────────────────────────╮                  │
│                    │                         │                  │
│                    │         🎉              │                  │
│                    │                         │                  │
│                    │   Welcome to Poppy 2.0! │                  │
│                    │                         │                  │
│                    │   We've completely      │                  │
│                    │   redesigned the app    │                  │
│                    │   with amazing new      │                  │
│                    │   features...           │                  │
│                    │                         │                  │
│                    │   ┌─────────────────┐   │                  │
│                    │   │    Got it! 👍   │   │                  │
│                    │   └─────────────────┘   │                  │
│                    │                         │                  │
│                    ╰─────────────────────────╯                  │
│                                                                 │
│          ← Chat visible behind with Gaussian blur →             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Same blur effect as voice recorder modal (`backdrop-filter: blur(8px)`)
- Dark overlay with opacity
- Centered card with rounded corners
- Large emoji at top
- Big readable title
- Message body
- Single "Got it!" button to dismiss
- Style matches TasksModal aesthetic (purple tones, #1a1625 background)

---

## Data Model

### Firestore Schema

```javascript
// Collection: announcements/{announcementId}
{
  id: 'ann_a1b2c3',                    // Auto-generated ID
  title: 'Welcome to Poppy 2.0!',      // Announcement title
  emoji: '🎉',                         // Optional emoji
  message: 'We have completely...',    // Full message body
  
  createdBy: 'uid_rafeh',              // Admin who created it
  createdByName: 'Rafeh Qazi',         // Denormalized for display
  createdAt: Timestamp,                // When created
  
  // Track who has seen/dismissed this
  dismissedBy: ['uid_user1', 'uid_user2'],  // Array of user IDs who dismissed
}
```

### Why `dismissedBy` Array?

```javascript
// ✅ SIMPLE - Just check if user in array
const hasSeenAnnouncement = announcement.dismissedBy?.includes(userId)

// When user dismisses:
await updateDoc(announcementRef, {
  dismissedBy: arrayUnion(userId)
})
```

This approach:
- ✅ Simple queries
- ✅ No separate subcollection needed
- ✅ Works with Firestore security rules
- ⚠️ Could get large if 1000s of users, but for team chat (10-100 users) it's fine

---

## Firestore Security Rules

```javascript
// announcements collection
match /announcements/{announcementId} {
  // Anyone authenticated can read
  allow read: if request.auth != null;
  
  // Only admins (dev users) can create
  allow create: if request.auth != null 
                && request.auth.token.email in ['qazi@cleverprogrammer.com'];
  
  // Anyone can update their own dismissal (add to dismissedBy array)
  allow update: if request.auth != null 
                && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['dismissedBy'])
                && request.resource.data.dismissedBy.toSet().difference(resource.data.dismissedBy.toSet()).hasOnly([request.auth.uid]);
  
  // Only admins can delete
  allow delete: if request.auth != null 
                && request.auth.token.email in ['qazi@cleverprogrammer.com'];
}
```

---

## Implementation

### New Files

```
app/
├── components/
│   └── announcements/
│       ├── AnnouncementsModal.js       # List all announcements
│       ├── CreateAnnouncementModal.js  # Admin: create new announcement
│       └── AnnouncementPopup.js        # Auto-show popup for new announcements
```

### Modified Files

```
app/
├── lib/
│   └── firestore.js               # Add announcement CRUD functions
├── components/
│   └── layout/
│       └── Sidebar.js             # Add "Announcements" menu item
├── contexts/
│   └── DevModeContext.js          # Already has admin detection (reuse DEV_USERS)
└── page.js                        # Check for unread announcements on mount
```

### firestore.js Functions to Add

```javascript
// Announcement CRUD
export async function createAnnouncement(adminUser, title, emoji, message)
export async function getAnnouncements()
export function subscribeToAnnouncements(callback)
export async function dismissAnnouncement(announcementId, userId)
export async function getUnreadAnnouncements(userId)
export async function deleteAnnouncement(announcementId)
```

---

## User Flow

### Regular User Flow:
1. User opens app
2. App checks for announcements where `!dismissedBy.includes(userId)`
3. If unread announcement exists → Show beautiful popup modal
4. User clicks "Got it!" → Add userId to `dismissedBy` array
5. Modal closes, never shows again
6. User can view all past announcements via Profile → Announcements

### Admin Flow:
1. Admin clicks profile → "Announcements"
2. Sees list of all announcements + "New Announcement" button
3. Clicks "New Announcement"
4. Fills in title, emoji, message
5. Clicks "Publish"
6. Announcement created in Firestore
7. All users will see it on their next app open

---

## Implementation Checklist

### Phase 1: Foundation ✅ COMPLETE

- [x] **Firestore Schema**
  - [x] Create announcements collection structure
  - [x] `dismissedBy` array for tracking who has seen each announcement

- [x] **firestore.js Functions**
  - [x] `createAnnouncement(adminUser, title, emoji, message)`
  - [x] `subscribeToAnnouncements(callback)` - for historical list
  - [x] `subscribeToUnreadAnnouncements(userId, callback)` - **real-time** for popup
  - [x] `dismissAnnouncement(announcementId, userId)`
  - [x] `deleteAnnouncement(announcementId)` - admin only

### Phase 2: UI Components ✅ COMPLETE

- [x] **AnnouncementPopup.js**
  - [x] Beautiful blur-background modal (rgba(0,0,0,0.85) + blur(12px))
  - [x] Large emoji display (64px)
  - [x] Title and message with purple accent colors
  - [x] "Got it! 👍" dismiss button with gradient
  - [x] Smooth enter/exit animations

- [x] **AnnouncementsModal.js**
  - [x] List all announcements (newest first)
  - [x] Date and author info with avatars
  - [x] Scrollable list
  - [x] Admin delete button
  - [x] DialogTitle for accessibility (with VisuallyHidden)

- [x] **CreateAnnouncementModal.js** (Admin only)
  - [x] Title input
  - [x] Emoji input with default 📢
  - [x] Message textarea
  - [x] Publish button
  - [x] Uses Dialog component for proper focus management

### Phase 3: Integration ✅ COMPLETE

- [x] **Sidebar.js**
  - [x] Add "📢 Announcements" to user menu dropdown
  - [x] Show AnnouncementsModal on click

- [x] **ChatWindow.js**
  - [x] **Real-time subscription** to unread announcements
  - [x] Show AnnouncementPopup if unread exists
  - [x] Announcements appear instantly without refresh
  - [x] Dismissed announcements never show again

### Phase 4: Bug Fixes ✅ COMPLETE

- [x] Fix `DialogTitle` accessibility warning (wrap in VisuallyHidden)
- [x] Fix input focus issues in CreateAnnouncementModal (use Dialog component)
- [x] Fix announcements showing on every refresh (use real-time subscription)

---

## What's NOT in V1

| Feature | Why Not | When |
|---------|---------|------|
| Rich text/markdown | Keep it simple | V2 |
| Images in announcements | Complexity | V2 |
| Scheduled announcements | Nice to have | V2 |
| Announcement categories | Over-engineering | Maybe never |
| Read analytics | Nice to have | V2 |

---

## Success Metrics ✅ ALL MET

- [x] Admin can create announcements in < 30 seconds
- [x] Users see announcement popup **instantly** (real-time, no refresh needed!)
- [x] Dismissed announcements never show as popup again
- [x] All historical announcements viewable in list
- [x] Modal styling matches existing app aesthetic (purple tones, blur background)

---

## Timeline

| Task | Time |
|------|------|
| Firestore schema + rules | 15 min |
| firestore.js functions | 20 min |
| AnnouncementPopup.js | 30 min |
| AnnouncementsModal.js | 25 min |
| CreateAnnouncementModal.js | 20 min |
| Sidebar integration | 10 min |
| page.js integration | 10 min |
| Testing | 10 min |
| **Total** | **~2-2.5 hours** |

---

## Design Inspiration

### From Voice Recorder Modal:
```javascript
{
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.85)',
  backdropFilter: 'blur(8px)',
  zIndex: 10000,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
}
```

### From TasksModal:
- Background color: `#1a1625`
- Rounded corners: `28px`
- Purple accent tones
- Clean typography
- Smooth animations

---

## Let's Fucking Go

Simple but impactful feature. Admin creates announcement → Everyone sees it beautifully → One-time display → Historical access.

No over-engineering. Just a beautiful, functional announcement system.

🚀 Let's build it.

