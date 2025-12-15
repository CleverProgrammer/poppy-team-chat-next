// Help content for the in-app documentation

export const KEYBOARD_SHORTCUTS = [
  {
    category: 'Navigation',
    shortcuts: [
      { keys: ['Cmd/Ctrl', 'K'], description: 'Quick search - jump to channels & DMs' },
      { keys: ['Cmd/Ctrl', '?'], description: 'Open this help modal' },
      { keys: ['Escape'], description: 'Close modals, cancel reply' },
    ]
  },
  {
    category: 'Messages',
    shortcuts: [
      { keys: ['Cmd/Ctrl', 'R'], description: 'Reply to last message from others' },
      { keys: ['Cmd/Ctrl', 'E'], description: 'Edit your last message' },
      { keys: ['Enter'], description: 'Send message' },
      { keys: ['Shift', 'Enter'], description: 'New line in message' },
    ]
  }
];

export const FEATURES_GUIDE = [
  {
    id: 'channels',
    title: 'Channels & DMs',
    icon: '#',
    content: `**Channels** are shared team spaces where everyone can participate. Use them for team-wide discussions, announcements, or topic-specific conversations.

**Direct Messages (DMs)** are private conversations between you and another team member. Start a new DM by using the quick search (Cmd+K) and selecting a person.`
  },
  {
    id: 'poppy-ai',
    title: 'Poppy AI Assistant',
    icon: '🤖',
    content: `Poppy is your AI assistant built right into the chat. To talk to Poppy:

1. **In any chat**: Type @poppy followed by your question
2. **Dedicated chat**: Click "Poppy AI" in the sidebar for a focused conversation

Poppy can help with questions, brainstorming, writing, and more!`
  },
  {
    id: 'posts',
    title: 'Posts',
    icon: '📌',
    content: `Posts are important messages that deserve more visibility. Unlike regular messages that scroll away, posts are easy to find later.

**To create a post**: Right-click any message and select "Make it a post"
**To view posts**: Click the "Posts" toggle in the chat header
**To demote**: Right-click a post and select "Make it a message"`
  },
  {
    id: 'reactions',
    title: 'Reactions',
    icon: '😊',
    content: `React to messages with emoji to show your response without cluttering the chat.

**To react**: Hover over a message and click an emoji from the quick reactions, or click "+" for more options.

Your reactions appear below the message. Click your own reaction again to remove it.`
  },
  {
    id: 'mentions',
    title: 'Mentions',
    icon: '@',
    content: `Get someone's attention by mentioning them:

- **@username** - Mention a specific person
- **@poppy** - Ask the AI assistant
- **@everyone** - Notify everyone in the channel
- **@channel** - Notify all channel members

Type @ and start typing to see suggestions.`
  },
  {
    id: 'images',
    title: 'Image Sharing',
    icon: '🖼️',
    content: `Share images easily in your conversations:

- **Drag & drop** an image directly into the chat
- **Paste** an image from your clipboard (Cmd+V)

Click any image in chat to view it full-size.`
  },
  {
    id: 'replies',
    title: 'Reply Threads',
    icon: '↩️',
    content: `Keep conversations organized by replying to specific messages:

- **Right-click** a message and select "Reply"
- Or use **Cmd+R** to reply to the last message

Replies show a preview of the original message, making context clear.`
  }
];

export const GETTING_STARTED = {
  welcome: "Welcome to Poppy Team Chat!",
  subtitle: "A modern team communication app with built-in AI assistance.",
  steps: [
    {
      number: 1,
      title: "Join the conversation",
      description: "Click on a channel like #general to start chatting with your team."
    },
    {
      number: 2,
      title: "Use quick search",
      description: "Press Cmd+K (or Ctrl+K) to quickly jump between channels and DMs."
    },
    {
      number: 3,
      title: "Ask Poppy",
      description: "Type @poppy in any chat to get help from your AI assistant."
    }
  ],
  tip: "Pro tip: Right-click any message for more options like reply, edit, or promote to post!"
};
