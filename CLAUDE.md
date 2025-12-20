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

## Tech Stack
- **Framework**: Next.js 15.1.3 (App Router)
- **Styling**: Tailwind CSS + Custom CSS (globals.css)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (Google Sign-in)
- **AI**: Anthropic Claude API via MCP (Model Context Protocol)
- **Video**: Mux (video hosting, streaming, thumbnails)
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
│       └── CapacitorProvider.js # Mobile native features (keyboard, camera, haptics)
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
    ├── ai-chat/                # AI chat endpoint
    └── mux/                    # Mux video upload and asset status endpoints
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

### 9. Video Replies (Mux)
- **Upload**: Direct upload to Mux via `/api/mux/upload` endpoint
- **Processing**: Poll `/api/mux/asset` for playback ID when ready
- **Display**: Video replies shown as compact bubbles with thumbnail
- **Playback**: Stories-style viewer with progress bars, tap navigation, 2x speed on hold
- **Storage**: Mux playback IDs stored in Firestore message docs

## Important Notes
- Messages and posts are stored in **separate Firestore subcollections**
- Posts preserve all message metadata (images, replies, timestamps)
- Unread state tracked per-user, per-chat in Firestore
- MCP server runs serverless on Vercel, spawns Notion MCP on demand
- Mux requires proper environment variables (MUX_TOKEN_ID, MUX_TOKEN_SECRET)

## Commands
```bash
yarn dev          # Start development server (http://localhost:3000)
yarn build        # Build for production
yarn start        # Start production server
yarn lint         # Run ESLint
```

## iOS Deployment

### Build Number Location
The iOS build number is stored in **two places** (keep them in sync):
1. `ios/App/App/Info.plist` → `CFBundleVersion` (the main one)
2. `ios/App/App.xcodeproj/project.pbxproj` → `CURRENT_PROJECT_VERSION`

**Before each TestFlight upload, increment the build number!**

### iOS Sync Commands
```bash
yarn ios:sync           # Sync for local development
yarn ios:sync:prod      # Sync for production (TestFlight builds)
```

Both commands automatically run `scripts/restore-firebase-spm.js` which:
- Removes SPM (Swift Package Manager) references
- Keeps the project pure CocoaPods

### TestFlight Deployment Steps
1. Increment build number in `ios/App/App/Info.plist` (CFBundleVersion)
2. Run `yarn ios:sync:prod`
3. Run `cd ios/App && pod install`
4. Open `ios/App/App.xcworkspace` in Xcode
5. Product → Archive
6. Distribute App → App Store Connect → Upload

### Why Pure CocoaPods?
We use CocoaPods exclusively (no SPM) because:
- Capacitor 8 auto-generates SPM files on sync, causing conflicts
- The cleanup script removes SPM after each sync
- All native dependencies are in `ios/App/Podfile`

## Repository Etiquette
- Branches: descriptive names (e.g., `posts`, `fix-toggle-ui`)
- Merge strategy: Fast-forward when possible
- Always wait for user approval before pushing

---
Last updated: 2025-12-20
