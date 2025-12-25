# Poppy Team Chat - Claude Instructions

NEVER WORK IN THE MAIN BRANCH. that branch is just for merging and / or pushing/pulling code!!

## What This App Is

**Poppy Team Chat** is a Slack-inspired team communication app with AI integration. Think Slack meets ChatGPT - users can chat in channels, send DMs, and interact with an AI assistant named Poppy directly in the conversation flow.

NEVER push or commit until you confirm with me.

### Core Concept
- **Team collaboration tool** with real-time messaging
- **Posts feature** inspired by ClickUp - important messages that don't get lost in chat scroll
- **Built-in AI assistant** that participates in conversations via @mentions
- **Persistent, organized communication** with channels, DMs, and promoted posts

### How It Works

#### 1. **Authentication Flow**
- Users sign in with Google via Firebase Auth
- On login, user data is saved to Firestore (`users` collection)
- Auth state managed globally via `AuthContext`
- User stays logged in until they explicitly sign out

#### 2. **Chat System Architecture**
Three types of chats:
- **Channels**: Shared team spaces (e.g., #general, #random)
- **DMs**: Direct messages between two users
- **AI Chat**: Conversation with Poppy AI assistant

Each chat type has its own Firestore collection structure:
```
channels/{channelId}/messages/{messageId}
channels/{channelId}/posts/{postId}
dms/{dmId}/messages/{messageId}
dms/{dmId}/posts/{postId}
```

#### 3. **Real-time Message Flow**
1. User types message in `ChatInput` component
2. Message sent via `useMessageSending` hook
3. Saved to Firestore with `serverTimestamp()`
4. All clients subscribed via `onSnapshot` receive update instantly
5. Messages rendered in `ChatWindow` > `MessageItem` components
6. Scroll auto-updates to show latest message

#### 4. **Posts System**
- Messages can be **promoted to posts** via right-click → "📌 Make it a post"
- Posts can be **demoted back to messages** via right-click → "💬 Make it a message"
- Posts appear inline with messages (darker background, subtle label)
- Posts view shows all posts in a feed-style layout
- Toggle between Messages/Posts view in chat header

#### 5. **AI Integration (Poppy)**
- Uses **Model Context Protocol (MCP)** to connect to Claude API
- MCP client in `lib/mcp-client.js` manages connection
- Users @mention Poppy in chat: `@poppy what's the weather?`
- AI responses stream back and render in real-time
- Poppy has access to Notion via MCP server for knowledge retrieval

#### 6. **Unread Tracking**
- Firestore stores unread state per user in `users/{uid}/readStatus/{chatId}`
- When user opens a chat, marked as read via `markChatAsRead()`
- Unread chats show blue dot indicator in sidebar
- Real-time subscription to unread chats updates UI instantly

#### 7. **Browser Push Notifications (OneSignal)**
- Users receive browser notifications when they're away from the app
- Notifications sent for:
  - Channel mentions (@username, @everyone, @channel)
  - New direct messages
- OneSignal SDK initializes on app load and sets user ID
- Notifications triggered via `/api/notifications/send` endpoint
- Works when tab is hidden or browser is in background

## Tech Stack
- **Framework**: Next.js 15.1.3 (App Router)
- **Styling**: Tailwind CSS + Custom CSS (globals.css)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (Google Sign-in)
- **AI**: Anthropic Claude API via MCP (Model Context Protocol)
- **Notifications**: OneSignal (Browser Push Notifications)
- **Language**: JavaScript (React)
- **Package Manager**: Yarn

## Project Structure & Component Breakdown

```
app/
├── components/
│   ├── chat/
│   │   ├── ChatWindow.js       # Main chat container, orchestrates all chat features
│   │   ├── ChatHeader.js       # Header with Messages/Posts toggle
│   │   ├── ChatInput.js        # Message input with @mentions, image upload, reply
│   │   ├── MessageItem.js      # Individual message renderer with reactions, replies
│   │   ├── PostsView.js        # Feed view showing all posts
│   │   ├── PostItem.js         # Individual post card with edit/delete
│   │   ├── PostPreview.js      # Inline post preview in messages view
│   │   ├── PostComposer.js     # Modal for creating new posts
│   │   ├── ContextMenu.js      # Right-click menu for messages/posts
│   │   ├── CommandPalette.js   # Quick switcher (Cmd+K)
│   │   └── AIModal.js          # Poppy AI chat modal
│   ├── layout/
│   │   └── Sidebar.js          # Navigation with channels, DMs, unread indicators
│   └── providers/
│       └── OneSignalProvider.js # OneSignal initialization and user ID management
├── contexts/
│   └── AuthContext.js          # Global auth state (user, login, logout)
├── hooks/
│   ├── useSubscriptions.js     # Firestore real-time subscriptions (messages, typing, users, notifications)
│   ├── useMessageSending.js    # Send messages, handle uploads, @mentions
│   ├── useAI.js                # Poppy AI integration via MCP
│   ├── useReactions.js         # Emoji reactions on messages
│   ├── useMentionMenu.js       # @mention autocomplete
│   └── useImageUpload.js       # Drag-n-drop image handling
├── lib/
│   ├── firebase.js             # Firebase app initialization
│   ├── firestore.js            # All Firestore CRUD operations
│   └── mcp-client.js           # Model Context Protocol client for AI
└── api/
    ├── mcp/                    # MCP server endpoints
    └── notifications/
        └── send/               # OneSignal notification dispatch endpoint
```

### Key Component Responsibilities

#### ChatWindow (The Orchestrator)
- Manages all state: messages, posts, currentChat, viewMode
- Coordinates between all child components
- Handles subscriptions via custom hooks
- Manages context menu, modals, and UI state

#### Custom Hooks Pattern
All complex logic extracted into hooks for reusability:
- **useSubscriptions**: Real-time data (messages, typing indicators, users list)
- **useMessageSending**: Message composition, sending, editing
- **useAI**: Poppy AI conversations via MCP
- **useReactions**: Emoji reaction system
- **useMentionMenu**: @mention autocomplete logic

#### Firestore Data Layer
All database operations centralized in `lib/firestore.js`:
- CRUD for messages, posts, users
- Real-time subscriptions via `onSnapshot`
- Unread tracking and DM management
- Promote/demote message ↔ post conversions

## Git & Deployment Rules
- **CRITICAL**: ALWAYS confirm with user before pushing to ANY branch
- Never commit or push without explicit user approval
- Always show a summary of changes before asking for permission to push
- Use conventional commit messages with emoji header:
  ```
  Brief description

  - Detailed changes
  - More details

  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
  ```

## Development Workflow
- **Go slow and methodical** - one step at a time
- Always read files before editing them
- Test changes before committing
- Use specialized tools instead of bash for file operations (Read, Edit, Write, Grep, Glob)
- When exploring codebase, use Task tool with Explore agent for complex searches

## Code Style & Conventions
- Use `'use client'` directive for client components
- Keep components focused and single-purpose
- Use destructured props in function signatures
- File naming: PascalCase for components, camelCase for utilities
- No emojis in code or commits (unless user explicitly requests)

## Key Features & Patterns
- **Posts System**: Messages can be promoted to posts via right-click context menu
- **Real-time Updates**: All data synced via Firestore onSnapshot subscriptions
- **AI Integration**: Poppy AI assistant via MCP server, supports @mention in chat
- **Unread Tracking**: Firestore-based unread chat tracking (no external notification service)

## Key Technical Concepts

### 1. Optimistic Updates
- Messages show instantly with `optimistic: true` flag
- Real Firestore doc replaces optimistic version when saved
- Prevents UI lag while waiting for server confirmation

### 2. Typing Indicators
- Uses Firestore "typing" subdocument per DM
- Updates on every keystroke (debounced)
- Clears on send or 3-second timeout
- Only shows for 1:1 DMs (not channels)

### 3. Message Reactions
- Stored as map in message doc: `reactions: { userId: emoji }`
- Quick reactions menu shows top 10 most-used emojis
- Full emoji picker available via "+" button
- Real-time updates via Firestore subscription

### 4. Reply Threading
- Messages can reply to other messages
- Stores reference: `replyTo: { msgId, sender, text }`
- Clicking reply preview scrolls to original message
- Visual highlight animation on scroll-to

### 5. Image Upload
- Drag-n-drop or paste images
- Uploads to Firebase Storage
- Shows preview before sending
- Stored URL in message doc: `imageUrl: "https://..."`

### 6. @Mention System
- Type `@` to trigger mention menu
- Shows: all users + `@poppy` for AI
- Autocompletes name on selection
- Mentions parsed in `useMessageSending` hook

### 7. DM ID Generation
- Format: `dm_${uid1}_${uid2}` where uid1 < uid2 (alphabetically)
- Ensures same DM ID regardless of who initiates
- Stored in `dms` collection at root level

### 8. Active DMs vs All Users
- **Active DMs**: DMs you've actually started (stored in Firestore)
- **All Users**: Everyone in the system (for starting new DMs)
- Sidebar shows active DMs first, then "+ New DM" to browse all users

### 9. Browser Push Notifications (OneSignal)
- **Setup**: OneSignal SDK initialized in `OneSignalProvider` component
- **User Identification**: External user ID set to Firebase UID for targeted notifications
- **Notification Flow**:
  1. New message detected in `useSubscriptions` hook (when tab is hidden)
  2. `sendBrowserNotification()` calls `/api/notifications/send` endpoint
  3. Server sends notification via OneSignal REST API to specific user
  4. Browser displays notification even when tab is closed/minimized
- **Triggers**:
  - Channel mentions (@username, @everyone, @channel)
  - New DM messages
- **Worker**: OneSignalSDKWorker.js in `/public` directory handles background notifications
- **Permissions**: OneSignal notify button prompts users to allow notifications on first use

## Important Notes
- **Browser Notifications**: OneSignal handles push notifications when users are away
- **Don't use Knock** (legacy - OneSignal replaced it for browser notifications)
- Messages and posts are stored in **separate Firestore subcollections**
- Posts preserve all message metadata (images, replies, timestamps)
- Unread state tracked per-user, per-chat in Firestore
- MCP server runs serverless on Vercel, spawns Notion MCP on demand
- OneSignal requires proper environment variables (see `.env.local.example`)

## Commands
```bash
yarn dev          # Start development server (http://localhost:3007)
yarn build        # Build for production
yarn start        # Start production server
yarn lint         # Run ESLint

# iOS Commands
yarn ios:sync     # Sync web build to iOS + restore Firebase SDK
yarn ios:open     # Open Xcode
```

## iOS App (Capacitor)

### Build Number (IMPORTANT!)
**The iOS build number is hardcoded in `ios/App/App/Info.plist`** - look for `CFBundleVersion`:
```xml
<key>CFBundleVersion</key>
<string>3</string>  <!-- INCREMENT THIS before each TestFlight upload -->
```

Before uploading to TestFlight, you MUST increment this number. The Build Settings in Xcode may show a different value - **Info.plist is the source of truth**.

### Firebase SDK Restoration
When running `npx cap sync ios`, Capacitor overwrites `Package.swift` and removes the manually-added Firebase SDK. The `yarn ios:sync` command automatically restores it via `scripts/restore-firebase-spm.js`.

**Never run `npx cap sync ios` directly** - always use `yarn ios:sync`.

### Push Notifications
- Uses `@capacitor/push-notifications` + Firebase Cloud Messaging
- `presentationOptions: []` in capacitor.config.ts suppresses automatic foreground notifications
- We manually show notifications via `@capacitor/local-notifications` to control when sound/visual appears
- Notifications are suppressed when user is viewing the active chat

### Key iOS Files
- `ios/App/App/Info.plist` - Build number, app config
- `ios/App/App/AppDelegate.swift` - Firebase + push notification setup
- `ios/App/CapApp-SPM/Package.swift` - Swift Package Manager dependencies (Firebase SDK here)
- `capacitor.config.ts` - Capacitor plugin settings
- `scripts/restore-firebase-spm.js` - Restores Firebase SDK after cap sync

## Repository Etiquette
- Branches: descriptive names (e.g., `posts`, `fix-toggle-ui`)
- Merge strategy: Fast-forward when possible
- Always wait for user approval before pushing

## resourceful
Always prefer libraries that are modern over custom code. If you're unsure, do proper research and find the best library to do the job that I give you with.

Your red flag should always be whenever we're writing code that looks too custom. That should be your trigger to check if there is a better way to do it, a resource that exists online, a tool that exists online, or a library that exists online that can handle this with fewer lines of code, cleaner, and it's going to be easier to maintain.

## for mobile dev
yarn ios:sync - syncs web build to iOS + restores Firebase SDK
yarn ios:open - opens Xcode

---
Last updated: 2025-12-15
