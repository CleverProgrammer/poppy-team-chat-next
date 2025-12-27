# Image System in Poppy

## Overview

Poppy has a powerful image system that goes beyond simple file sharing. Every image is:
1. **Analyzed by Claude Vision** - Gets a fun, contextual caption
2. **Indexed to Ragie** - Becomes searchable via natural language
3. **Stored with dimensions** - For layout stability (no jumping content)
4. **Viewable in a lightbox** - Full-screen, swipeable gallery

This means you can later ask Poppy "show me Qazi's dog" or "show me proof of Sawwa's milestone" and it will find and display the actual images!

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER SHARES IMAGE(S)                                                   │
│  - Drag & drop, paste, or file picker                                   │
│  - Supports single or multiple images                                   │
│  - Optional accompanying text message                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  OPTIMISTIC UI (Instant)                                                │
│                                                                         │
│  1. Preview thumbnail shown immediately                                 │
│  2. Message appears in chat with local preview                          │
│  3. Dimensions extracted client-side for skeleton placeholders          │
│  4. User can keep chatting - upload happens in background               │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  FIREBASE UPLOAD                                                        │
│                                                                         │
│  - Images → Firebase Storage                                            │
│  - Videos → Mux (for streaming)                                         │
│  - Returns public URLs                                                  │
│  - Dimensions stored in message for future layout stability             │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MESSAGE SAVED TO FIRESTORE                                             │
│                                                                         │
│  {                                                                      │
│    text: "look at this cute dog!",                                      │
│    imageUrl: "https://firebasestorage...",  // First image (legacy)     │
│    imageUrls: ["url1", "url2", ...],        // All images               │
│    mediaDimensions: [{ width: 640, height: 480 }, ...],                 │
│    sender: "Rafeh Qazi",                                                │
│    timestamp: ...                                                       │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                          (fire and forget)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CLAUDE VISION ANALYSIS (Background)                                    │
│  /api/ragie/sync-image                                                  │
│                                                                         │
│  1. Fetches image(s) as base64                                          │
│  2. Sends to Claude Sonnet 4.5 with context:                            │
│     - Accompanying text (if any)                                        │
│     - Last 15 messages for conversation context                         │
│  3. Gets back: description, OCR text, key elements, TLDR                │
│  4. Saves analysis back to Firestore message                            │
│  5. Tracks AI usage for cost monitoring                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  RAGIE INDEXING                                                         │
│                                                                         │
│  Document created with:                                                 │
│  - content: "[Sender] shared N image(s): [analysis text]"               │
│  - metadata:                                                            │
│      chatType: 'channel' | 'dm'                                         │
│      imageUrls: [array of URLs]                                         │
│      imageCount: N                                                      │
│      sender, timestamp, chatId, etc.                                    │
│                                                                         │
│  Now searchable by semantic meaning!                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Image Upload Hook (`useImageUpload.js`)

Handles all the ways users can add images:

```javascript
// Multiple ways to add images
- Drag & drop (supports multi-file)
- Paste from clipboard (Cmd+V)
- File picker button
- Camera (mobile)

// Supports both images AND videos
accept: {
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  'video/*': ['.mp4', '.mov', '.webm', '.m4v']
}

// State management
imagePreviews: []   // DataURLs for instant preview
imageFiles: []      // Actual File objects for upload
```

### 2. Image Preview in ChatInput

```
┌───────────────────────────────────────────────────────────────┐
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                          │
│  │ 🖼️      │ │ 🖼️      │ │ 🎬      │  ← Thumbnails           │
│  │   ✕     │ │   ✕     │ │   ✕     │  ← Remove buttons       │
│  └─────────┘ └─────────┘ └─────────┘                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Add a caption... (optional)                          ⬆️ │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

- Shows thumbnails of selected images
- Each has an ✕ button to remove
- Videos show a 🎬 badge
- Optional text input for caption/context

### 3. Image Display in Messages (`MessageItem.js`)

**Single Image:**
```
┌────────────────────────────────────────┐
│  ┌────────────────────┐                │
│  │                    │  ← Max 240x280 │
│  │     [Image]        │                │
│  │                    │                │
│  └────────────────────┘                │
│  "look at this cute dog!"              │
│                           - Rafeh 2:30p│
└────────────────────────────────────────┘
```

**Multiple Images (Grid):**
```
┌────────────────────────────────────────┐
│  ┌─────────┐ ┌─────────┐               │
│  │  img 1  │ │  img 2  │  ← Max 120x120│
│  └─────────┘ └─────────┘               │
│  ┌─────────┐ ┌─────────┐               │
│  │  img 3  │ │  img 4  │               │
│  └─────────┘ └─────────┘               │
│  "before and after shots"              │
│                           - David 3:15p│
└────────────────────────────────────────┘
```

### 4. Skeleton Loading (Layout Stability)

**Problem:** Images cause content to "jump" when they load
**Solution:** Store dimensions and show skeleton placeholders

```javascript
// Dimensions stored with message
mediaDimensions: [
  { width: 1920, height: 1080 },
  { width: 640, height: 480 }
]

// SkeletonView shows pulsing placeholder with correct aspect ratio
<SkeletonView width={1920} height={1080} loaded={false}>
  <img src="..." />
</SkeletonView>
```

**Migration:** Old messages without dimensions get migrated on-demand when images load.

### 5. Lightbox Gallery (`ImageLightbox.js`)

Click any image to view full-screen:

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                 [✕]  │
│                                                                       │
│     ◀                    ┌────────────────────┐                  ▶    │
│                          │                    │                       │
│                          │   FULL SIZE IMAGE  │                       │
│                          │                    │                       │
│                          └────────────────────┘                       │
│                                                                       │
│                              ● ○ ○ ○                                  │
└───────────────────────────────────────────────────────────────────────┘
```

- Swipe left/right for multiple images
- Dark backdrop (90% opacity)
- Close on backdrop click or swipe down
- No nav buttons on single images
- Uses `yet-another-react-lightbox` library

---

## AI Image Analysis

### Claude Vision Analysis (`/api/ragie/sync-image`)

Every image gets analyzed by Claude Sonnet 4.5 to create searchable, contextual descriptions.

**The Prompt:**
```
You are an image analyzer for an internal team chat app. Your job is to give 
context about what this image is about so it can help the team understand and 
reference it later.

Key elements to focus on:
1. What is this image showing? Describe in plain language.
2. Any text visible - quote it exactly (OCR).
3. People, objects, locations, brands, logos, or notable items.
4. If it's a screenshot, what app/website and what's happening?
5. If it's a chart/graph, what are the key takeaways?
6. Any context that would help a teammate understand this.

Speak in plain, natural language. Keep it short and punchy - 3-5 sentences max.

At the end, always include a fun, casual one-line TLDR. Talk like a fucking 
HOMIE - like you're ON THE TEAM. Use people's actual names when you can!

Examples:
- "tldr: Mohamed just hit his 1-year mark with Poppy, absolute legend 🔥"
- "tldr: Rafeh cooking up a new landing page design, looks clean af"
- "tldr: David and Naz going back and forth about the rebrand lol"
- "tldr: Just a cute dog pic, nothing work-related here 🐕"
```

**Context-Aware Analysis:**
- If user sends text with image, it's included: "The person sharing this image said: 'check out this bug'"
- Last 15 messages are included for conversation context
- Claude can see who was talking and understand why the image was shared

**Example Output:**
```
This is a screenshot of the Poppy Team Chat app showing the new dark mode 
interface. The sidebar shows channels #general and #design. The main chat 
shows a conversation between David and Rafeh about implementing the theme 
switcher. There's a toggle button in the header that says "Dark Mode".

tldr: Dark mode is looking fire, David and Rafeh cooked on this one 🔥
```

### Multiple Image Analysis

When multiple images are shared together:
- Claude sees them as a "cohesive set"
- Understands they might be: before/after, sequence, comparison, etc.
- Creates a unified analysis

```
Looking at 3 images: seems like a before/during/after of the homepage redesign. 
First shows the old blue header, second is a WIP with the new layout, third is 
the final polished version with the gradient background. 

tldr: Before/after of the homepage - night and day difference 🔥
```

---

## Image Retrieval

### How Poppy Finds Images

When you ask Poppy "show me Qazi's dog" or "show me proof of Sawwa's milestone":

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User: "show me rafeh's dog pudgy"                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  POPPY AI PROCESSING                                                    │
│                                                                         │
│  1. Recognizes this is an image search request                          │
│  2. Calls search_chat_history tool with query: "rafeh dog pudgy"        │
│  3. Ragie returns matches with imageUrls in metadata                    │
│  4. AI response INCLUDES the Firebase Storage URL                       │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Poppy: "Here's Pudgy, Rafeh's baby bulldog! 🐕                         │
│                                                                         │
│  https://firebasestorage.googleapis.com/v0/b/poppy-chat/..."            │
│                                                                         │
│  ┌────────────────────┐                                                 │
│  │     [Pudgy pic]    │  ← Auto-rendered by chat UI                     │
│  └────────────────────┘                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### System Prompt for Image Retrieval

From `ai-chat/route.js`:
```
=== SHOWING IMAGES IN RESPONSES (CRITICAL!) ===

When you see [Image URLs: https://firebasestorage...] in the chat history, 
INCLUDE THAT URL IN YOUR RESPONSE!

The app will automatically render Firebase Storage URLs as actual inline images.

Example - if someone asks "who is Pudgy?" and you see an image of Pudgy in the chat:
✅ GOOD: "Pudgy is your baby bulldog! 🐕 Here he is:

https://firebasestorage.googleapis.com/v0/b/..."

❌ BAD: "Pudgy is your baby bulldog!" (missing the image URL!)

ALWAYS include the image URL on its own line when referencing images. 
Users LOVE seeing the actual photos!
```

### Ragie Search Metadata

When images are indexed, they include:
```javascript
{
  messageId: "abc123",
  sender: "Rafeh Qazi",
  timestamp: "2024-12-27T14:30:00Z",
  chatType: "channel",
  chatId: "general",
  contentType: "image",
  imageUrls: ["https://firebasestorage.../pudgy.jpg"],
  imageCount: 1,
  accompanyingText: "look at this cute dog!",
  hasAnalysis: true
}
```

The retrieval router extracts imageUrls from both `document_metadata` and `chunk.metadata`:
```javascript
const imageUrls = docMeta.imageUrls || chunkMeta.imageUrls || null;
```

---

## Team AI Memory

### Adding Images to Team Memory

Users can add images to global team memory (accessible to everyone):

**Right-Click Method:**
- Right-click any image message
- Select "Add to Team AI Memory"
- Image(s) + text get indexed with `chatType: 'team_memory'`

**Via Chat:**
- Share image with "@poppy remember this"
- Poppy summarizes and saves to team memory

### Team Memory Endpoint (`/api/ragie/team-memory`)

```javascript
// Metadata for global access
metadata: {
  chatType: 'team_memory',  // Special type - bypasses permission filters
  chatId: 'team_memory',    // Global
  isTeamMemory: true,
  contentType: 'image',
  imageUrls: [...],
  imageCount: N
}
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `app/hooks/useImageUpload.js` | Image selection, drag/drop, paste handling |
| `app/hooks/useMessageSending.js` | Upload flow, dimension extraction, Firestore save |
| `app/components/chat/ChatInput.js` | Image preview thumbnails in input area |
| `app/components/chat/MessageItem.js` | Image display, multi-image grid, skeleton loading |
| `app/components/chat/ImageLightbox.js` | Full-screen gallery viewer |
| `app/components/chat/SkeletonView.js` | Loading placeholder with aspect ratio |
| `app/api/ragie/sync-image/route.js` | Claude Vision analysis + Ragie indexing |
| `app/api/media/analyze-image/route.js` | Standalone image analysis endpoint |
| `app/api/ragie/team-memory/route.js` | Global team memory storage |
| `app/lib/retrieval-router.js` | Image-aware search results handling |
| `app/api/ai-chat/route.js` | System prompt for image retrieval |
| `app/lib/firestore.js` | `sendMessageWithMedia`, dimension storage |

---

## Usage Examples

### "Show me Qazi's dog"

User: "show me qazi's dog"

Poppy searches Ragie for "qazi dog", finds image with analysis mentioning "Rafeh's dog Pudgy", returns:

> "Here's Pudgy! Rafeh's little bulldog 🐕
> 
> https://firebasestorage.googleapis.com/..."

The URL renders as an inline image in the chat.

### "Show me proof of Sawwa's milestone"

User: "show me proof of sawwa's milestone"

Poppy searches Ragie for "sawwa milestone proof", finds image with analysis containing OCR'd text from a certificate or screenshot:

> "Found it! Here's the screenshot from when Sawwa hit her milestone:
>
> https://firebasestorage.googleapis.com/..."

### "What images did David share this week?"

User: "what images did david share this week?"

Poppy searches with date filter, finds all image messages from David:

> "David shared 3 images this week:
>
> 1. The new logo mockup (Monday)
> https://firebasestorage.googleapis.com/...
>
> 2. Screenshot of the bug fix (Wednesday)  
> https://firebasestorage.googleapis.com/...
>
> 3. Team dinner photo (Friday)
> https://firebasestorage.googleapis.com/..."

---

## Cost Tracking

Every image analysis is tracked:

```javascript
await adminDb.collection('ai_usage').doc(docId).set({
  type: 'image_analysis' | 'multi_image_analysis',
  model: 'claude-sonnet-4-5-20250929',
  inputTokens: ...,   // Images are ~1000-1500 tokens each
  outputTokens: ...,
  totalCost: ...,     // Sonnet 4.5: $3/1M in, $15/1M out
  userId: ...,
  userName: ...,
  messageId: ...
})
```

---

## Future Improvements

- [ ] Video analysis with Gemini or Twelve Labs (not just images)
- [ ] Smarter multi-image grouping (detect before/after, sequences)
- [ ] Image search filters in UI (by person, date, channel)
- [ ] Face recognition for "photos of X person"
- [ ] Image editing inline (crop, annotate)
- [ ] GIF search integration
- [ ] Image-to-text extraction for documents

