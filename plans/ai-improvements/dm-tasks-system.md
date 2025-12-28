# Task System (DMs, Channels & Groups)

## The Goal

**Turn conversations into actionable to-dos automatically.**

When someone says "send me the report by Friday" or "can you review this PR", the system detects it's a task and creates a trackable to-do item. No manual task creation needed — just chat naturally.

---

## 🚨 Current Status & Known Gaps

| Feature | DMs | Channels | Groups |
|---------|-----|----------|--------|
| Task detection (AI tagging) | ✅ Works | ✅ Works | ✅ Indexed, but... |
| Task creation (`handleTasksFromMessage`) | ✅ Works | ⚠️ Untested | ❌ **NOT CALLED** |
| Task completion from gratitude | ✅ Works | ⚠️ Untested | ❌ **NOT CALLED** |
| Task assignee resolution | ✅ DM recipient | ⚠️ Uses chatId | ❌ **No group handling** |

### What's Broken in Groups

**1. `handleTasksFromMessage` is never called in group message functions**

The group message functions (`sendGroupMessage`, `sendGroupMessageWithReply`, etc.) in `app/lib/firestore.js` do tag messages via `/api/tag`, but they **don't call `handleTasksFromMessage`** after receiving `aiTags`:

```javascript
// Current (broken) - around line 3742
.then(data => {
  if (data.aiTags) {
    updateDoc(doc(db, 'groups', groupId, 'messages', docRef.id), { aiTags: data.aiTags })
    saveCanonicalTag(data.aiTags)
    // ❌ MISSING: handleTasksFromMessage call!
  }
})
```

**2. `createTaskFromMessage` doesn't handle `chatType === 'group'`**

The function only handles DM and defaults to channel:

```javascript
// Current (incomplete) - around line 2807
if (chatType === 'dm') {
  chatName = recipient?.displayName || recipient?.email || 'Direct Message'
} else {
  chatName = chatId // ← Defaults to channel, but group IDs are ugly
}
// ❌ MISSING: else if (chatType === 'group') handling
```

### Fix Required (Not Yet Implemented)

1. **Add `handleTasksFromMessage` calls** to all group message functions in `firestore.js`:
   - `sendGroupMessage`
   - `sendGroupMessageWithReply`
   - `sendGroupMessageWithMedia`
   - `sendGroupMessageWithAudio`

2. **Update `createTaskFromMessage`** to handle groups:
   ```javascript
   if (chatType === 'dm') {
     chatName = recipient?.displayName || 'Direct Message'
   } else if (chatType === 'group') {
     // Fetch group name from Firestore or pass it in
     chatName = groupName || 'Group Chat'
   } else {
     chatName = chatId // Channel
   }
   ```

3. **Pass group context** to `handleTasksFromMessage`:
   - Group name (for display)
   - Group members (for assignee resolution via @mentions)

---

## Task Detection Philosophy: The TASK MASTER Approach

The AI uses **judgment, not rigid rules**. The core question:

> **"Would this actually end up on someone's to-do list?"**

### A REAL task has:
1. **Accountability** - Someone specific is expected to DO something
2. **Deliverable** - There's a tangible outcome (send a file, build a feature, bring an item)
3. **Follow-up potential** - Someone might ask "did you do that thing?"

### NOT a task (even if it sounds like one):
- Jokes, banter, rhetorical questions
- Casual expressions ("give me a high five", "lmk if I should be worried")
- Vibe checks ("can I get a HOOYAH", "thoughts?")
- Feedback requests with no real deliverable

### DM Assignee Logic
In a DM, it's simple: **the recipient IS the assignee**. Always. We don't need AI to figure this out — we have the context! The person you're talking to is the person you're assigning the task to.

### Task Actions (Flexible Intent)
Instead of hardcoding type matches like `type === 'task'`, the AI signals intent via a **`task_action`** field:

| task_action | When AI returns it |
|-------------|-------------------|
| `"create"` | A new task is being assigned or requested |
| `"complete"` | A task is being marked as done (gratitude, acknowledgment, past tense) |
| `"cancel"` | A task is being cancelled (nvm, forget it, no longer needed) |
| `null` or omitted | Not task-related at all |

**The code just checks:** `if (aiTags.task_action) { processTask() }`

This is more flexible because:
- The AI can add new task_actions in the future without code changes
- No rigid type matching — the AI signals intent directly
- Works for any `type` the AI assigns (task, feature_request, etc.)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER SENDS MESSAGE                          │
│              "Hey, please send me the report by Friday"             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STORED IN FIRESTORE (instant)                    │
│                     dms/{dmId}/messages/{msgId}                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ (async, non-blocking)
┌─────────────────────────────────────────────────────────────────────┐
│                      POST /api/tag (background)                     │
│                                                                     │
│  AI returns: { "task_action": "create", "assignee": "olivia", ... } │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ (if task_action exists)
┌─────────────────────────────────────────────────────────────────────┐
│                  CREATE TASK IN FIRESTORE                           │
│                                                                     │
│  tasks/{taskId}                                                     │
│  {                                                                  │
│    title: "Send the quarterly report",                              │
│    assignee: "Olivia",                                              │
│    assigneeId: "oFiFQeHxl8R3wiE6uwkPfrf2atm2",                      │
│    assigner: "Rafeh Qazi",                                          │
│    assignerId: "e6AqpILFQwVBw6f7gLgtmBWXIo52",                      │
│    chatId: "e6AqpILFQwVBw6f7gLgtmBWXIo52_oFiFQeHxl8R3wiE6uwkPfrf...",│
│    chatType: "dm",                                                  │
│    priority: "medium",                                              │
│    dueDate: "2025-01-03",                                           │
│    completed: false,                                                │
│    createdAt: timestamp                                             │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│               TASKS APPEAR IN CHAT HEADER                           │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ 📋 1 open task                                    [▼]      │     │
│  ├────────────────────────────────────────────────────────────┤     │
│  │ ☐ Send the quarterly report         Due Friday    MEDIUM  │     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `app/lib/firestore.js` | `createTaskFromMessage()`, `subscribeToTasksByChat()`, `toggleTaskComplete()`, `deleteTask()` |
| `app/components/chat/TasksSection.js` | Collapsible tasks panel at top of chat |
| `app/components/chat/TaskPreview.js` | Individual task card with checkbox |
| `app/components/chat/ChatWindow.js` | Renders TasksSection as Virtuoso Header |
| `app/api/tag/route.js` | AI detects `type: "task"` and extracts task fields |
| `firestore.indexes.json` | Composite index for task queries |
| `firebase.json` | Firestore configuration for index deployment |

---

## Firestore Schema

### Tasks Collection (Top-Level)

```
Collection: tasks
Document ID: auto-generated

{
  // Core task data
  title: "Send the quarterly report",
  originalMessageId: "abc123",
  originalMessageText: "Hey, please send me the report by Friday",
  
  // Assigned To (the person who should do the task)
  assignedTo: "Olivia Lee",            // Display name
  assignedToUserId: "oFiFQe...",       // User UID (for queries)
  assignedToEmail: "olivia@example.com",
  
  // Assigned By (who created/requested the task)
  assignedBy: "Rafeh Qazi",
  assignedByUserId: "e6AqpI...",
  assignedByEmail: "rafeh@example.com",
  
  // Context
  chatId: "e6AqpI..._oFiFQe...",    // DM ID or channel ID
  chatType: "dm",                    // "dm" | "channel"
  chatName: "Olivia Lee",            // For display in "My Tasks" view
  
  // Status
  priority: "medium",                // "low" | "medium" | "high" | "critical"
  status: "pending",                 // "pending" | "in_progress" | "complete"
  dueDate: "2025-01-03",             // ISO date or null
  
  // Completion
  completed: false,
  completedAt: null,                 // timestamp when completed
  completedBy: null,                 // who marked it complete
  
  // Metadata
  createdAt: serverTimestamp(),
  updatedAt: null,                   // Set when task is updated (deduplication)
  canonicalTag: "quarterly_report"   // Links to tagging system (for deduplication)
}
```

### Smart Assignee Detection

In DMs, the system automatically knows who the task is for:

```
You → Olivia DM: "Please bring cookies tomorrow"
                 ↓
Task created: assignedTo = "Olivia Lee" (auto-detected from DM context)
              assignedToUserId = "oFiFQe..."
              assignedToEmail = "olivia@example.com"
```

The logic:
1. If AI detects a specific name, use that
2. If in a DM and no name mentioned, default to the **recipient** (the other person)
3. In channels, assignee must be explicitly mentioned

### Task Deduplication

Uses `canonicalTag` to prevent duplicate tasks:

```
Message 1: "Send me the report"     → creates task with canonicalTag: "quarterly_report"
Message 2: "Report by Friday pls"   → finds existing task, UPDATES it instead of creating new
```

### Required Indexes

Defined in `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "chatId", "order": "ASCENDING" },
        { "fieldPath": "chatType", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "assigneeId", "order": "ASCENDING" },
        { "fieldPath": "completed", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Deploy with: `firebase deploy --only firestore:indexes`

---

## Task Detection

The AI tagging system (in `/api/tag/route.js`) already detects tasks. When it returns `type: "task"`, the message sending function auto-creates a task:

```javascript
// In firestore.js - sendMessageDM()
.then(data => {
  if (data.aiTags?.type === 'task') {
    createTaskFromMessage(dmId, 'dm', docRef.id, text, user, data.aiTags)
  }
})
```

### What AI Extracts for Tasks

| Field | Example |
|-------|---------|
| `type` | `"task"` |
| `assignee` | `"Olivia"` |
| `assigner` | `"Rafeh"` (from context) |
| `priority` | `"high"` |
| `due_date` | `"2025-01-03"` |
| `status` | `"pending"` |
| `summary` | `"Send quarterly report by Friday"` |

---

## UI Components

### TasksSection

Collapsible panel that appears at the top of DM/channel chats when tasks exist.

```jsx
<div className="mx-3 mb-3 rounded-2xl bg-black/20 border border-white/10">
  {/* Header - clickable to expand/collapse */}
  <button className="w-full flex items-center justify-between px-4 py-3">
    <span>📋 2 open tasks</span>
    <span>▼</span>
  </button>
  
  {/* Tasks list */}
  {isExpanded && (
    <div className="px-3 pb-3 space-y-2">
      {tasks.map(task => <TaskPreview key={task.id} task={task} />)}
    </div>
  )}
</div>
```

### TaskPreview

Individual task card with checkbox, title, priority badge, and due date.

```jsx
<div className={`flex items-center gap-3 p-3 rounded-xl ${
  task.completed ? 'bg-white/5 opacity-60' : 'bg-purple-500/20'
}`}>
  <input 
    type="checkbox" 
    checked={task.completed}
    onChange={() => onToggleComplete(task.id)}
  />
  <div className="flex-1">
    <span className={task.completed ? 'line-through' : ''}>
      {task.title}
    </span>
    {task.dueDate && <span className="text-xs">Due {task.dueDate}</span>}
  </div>
  {task.priority && (
    <span className={`px-2 py-0.5 text-xs rounded-full ${priorityColors[task.priority]}`}>
      {task.priority}
    </span>
  )}
</div>
```

---

## Key Functions

### createTaskFromMessage()

```javascript
export async function createTaskFromMessage(chatId, chatType, messageId, text, user, aiTags) {
  const tasksRef = collection(db, 'tasks')
  await addDoc(tasksRef, {
    title: aiTags.summary || text.substring(0, 100),
    originalMessageId: messageId,
    originalMessageText: text,
    assignee: aiTags.assignee || null,
    assigneeId: aiTags.assigneeId || null,
    assigner: user.displayName || user.email,
    assignerId: user.uid,
    priority: aiTags.priority || 'medium',
    status: aiTags.status || 'pending',
    dueDate: aiTags.due_date || null,
    completed: false,
    completedAt: null,
    completedBy: null,
    createdAt: serverTimestamp(),
    canonicalTag: aiTags.canonical_tag || null,
    chatId: chatId,
    chatType: chatType,
  })
  console.log('✅ Task auto-created from message')
}
```

### subscribeToTasksByChat()

Real-time listener for tasks in a specific chat:

```javascript
export function subscribeToTasksByChat(chatId, chatType, callback) {
  const tasksRef = collection(db, 'tasks')
  const q = query(
    tasksRef,
    where('chatId', '==', chatId),
    where('chatType', '==', chatType),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, snapshot => {
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    callback(tasks)
  })
}
```

### toggleTaskComplete()

```javascript
export async function toggleTaskComplete(taskId, userId, userName) {
  const taskRef = doc(db, 'tasks', taskId)
  const taskSnap = await getDoc(taskRef)
  
  if (taskSnap.exists()) {
    const task = taskSnap.data()
    await updateDoc(taskRef, {
      completed: !task.completed,
      completedAt: task.completed ? null : serverTimestamp(),
      completedBy: task.completed ? null : userName,
      status: task.completed ? 'pending' : 'complete',
    })
  }
}
```

---

## Phases

### Phase 1: MVP (v1) ✅ COMPLETE

- [x] Auto-detect tasks from AI tagging (`type: "task"`)
- [x] Store tasks in top-level `tasks` collection
- [x] TasksSection component at top of DM chats
- [x] TaskPreview with checkbox to mark complete
- [x] Priority indicators (color-coded badges)
- [x] Collapsible panel with open/completed counts
- [x] Firestore composite indexes
- [x] Tailwind styling (dark theme)

### Phase 2: Enhanced Task Management

- [ ] "My Tasks" view - see all tasks assigned to you across all chats
- [ ] Due date picker when creating tasks manually
- [ ] Task editing (title, priority, due date)
- [ ] Task deletion with confirmation
- [ ] Filter by status (open, completed, all)
- [ ] Sort by due date, priority, or creation date

### Phase 3: Team Features

- [ ] Channel tasks (not just DMs)
- [ ] Re-assign tasks to different people
- [ ] Task comments/updates
- [ ] @mention to create tasks explicitly
- [ ] Weekly task digest notification

### Phase 4: Poppy AI Integration

- [ ] "What are my tasks?" tool for Poppy AI
- [ ] "Create a task for [person]" explicit command
- [ ] Task reminders via AI
- [ ] "What's overdue?" queries

---

## Task Detection Examples

The AI should detect these as tasks:

| Message | Detected Fields |
|---------|-----------------|
| "Can you send me the report by Friday?" | assignee: recipient, due_date: Friday |
| "I'll review the PR tomorrow" | assignee: sender, due_date: tomorrow |
| "Olivia please update the docs" | assignee: Olivia |
| "TODO: fix the login bug" | assignee: sender |
| "Remind me to call the client" | assignee: sender |
| "@rafeh handle the deployment" | assignee: rafeh |

Not tasks (type: "noise" or other):

| Message | Why Not a Task |
|---------|---------------|
| "Thanks!" | Just gratitude |
| "lol nice" | Reaction |
| "Good morning" | Greeting |
| "I think we should..." | Idea, not actionable task |

---

## Success Criteria

The system works if:

✅ Task-like messages automatically create tasks (no manual work)
✅ Tasks appear at the top of the relevant DM/channel
✅ Users can check off tasks and see completion state
✅ Priority is visible at a glance
✅ Due dates are extracted when mentioned

---

## Future Improvements

### Priority 1: Group Tasks (Blocking)
- [ ] **Call `handleTasksFromMessage` in group message functions**
- [ ] **Add `chatType === 'group'` handling in `createTaskFromMessage`**
- [ ] Pass group name and members to task creation
- [ ] Test assignee resolution with @mentions in groups

### Priority 2: Channel Tasks (Verify)
- [ ] Confirm `handleTasksFromMessage` is called in channel functions
- [ ] Test assignee detection in channels
- [ ] Add channel name display in task UI

### Priority 3: Enhancements
- [ ] Assignee ID mapping (currently just display name)
- [ ] Push notifications for new tasks assigned to you
- [ ] Calendar integration for due dates
- [ ] Recurring tasks detection
- [ ] Task templates for common workflows
- [ ] Analytics: task completion rates per person

