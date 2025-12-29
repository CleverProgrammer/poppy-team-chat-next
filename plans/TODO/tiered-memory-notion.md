# 🧠 Tiered Memory System: HOT / WARM / COLD

## Overview

Implement a three-tier memory architecture for Poppy AI that ensures important knowledge is never lost while keeping recent context easily accessible.

## The Problem

Currently, Poppy has two memory layers:
1. **Immediate context** (last ~50 messages) - Always in prompt
2. **Ragie semantic search** - Vector store with topK=50 and recency bias

**Issues:**
- Important permanent knowledge (SOPs, frameworks, team info) can get buried in Ragie over time
- If Ragie fails or misses, there's no fallback
- No structured, human-editable permanent storage
- Critical information written months ago may not surface

## The Solution: Three-Tier Memory

```
┌─────────────────────────────────────────────────────────────┐
│                      MEMORY TIERS                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔥 HOT (Immediate)                                         │
│  ├── Last 50 messages in conversation                       │
│  ├── Always in context window                               │
│  └── Perfect for: current conversation flow                 │
│                                                             │
│  🌡️ WARM (Semantic)                                         │
│  ├── Ragie vector store                                     │
│  ├── TopK=50, recency-biased                                │
│  ├── Semantic search across all messages                    │
│  └── Perfect for: finding relevant recent discussions       │
│                                                             │
│  ❄️ COLD (Permanent)                                         │
│  ├── Notion database                                        │
│  ├── Structured, categorized, human-editable                │
│  ├── Fallback when Ragie fails or misses                    │
│  └── Perfect for: SOPs, frameworks, guides, team info       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## What Goes in COLD Storage (Notion)

| Category | Examples | Why Permanent? |
|----------|----------|----------------|
| **SOPs** | How to handle customer complaints, onboarding process | Rarely changes, always needed |
| **Frameworks** | Decision-making frameworks, mental models | Reference material |
| **Guides** | How-tos, walkthroughs, tutorials | Step-by-step instructions |
| **Templates** | Email templates, response formats | Reusable patterns |
| **Team** | Who's on the team, roles, preferences, strengths | Stable information |
| **Preferences** | Communication styles, meeting preferences | Personal settings |

## Architecture

### Save Flow

```
User says something important
         │
         ▼
┌─────────────────────────┐
│  Poppy Team Memory Tool │
│  (existing flow)        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Classification Layer   │
│  ├── Is this permanent? │
│  ├── What category?     │
│  └── Who said it?       │
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     │             │
     ▼             ▼
┌─────────┐  ┌─────────────┐
│  Ragie  │  │   Notion    │
│ (WARM)  │  │   (COLD)    │
└─────────┘  └─────────────┘
```

### Retrieval Flow

```
User asks Poppy something
         │
         ▼
┌─────────────────────────┐
│   1. Check HOT memory   │
│   (last 50 messages)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  2. Query Ragie (WARM)  │
│  Semantic search        │
└───────────┬─────────────┘
            │
     ┌──────┴──────────────┐
     │                     │
     ▼                     ▼
┌─────────────┐     ┌─────────────────┐
│ Results?    │ NO  │ 3. Query Notion │
│ Ragie OK?   │────▶│    (COLD)       │
└─────────────┘     └─────────────────┘
     │ YES
     ▼
┌─────────────────────────┐
│  Combine & respond      │
└─────────────────────────┘
```

## Notion Database Schema

### Main Database: `Poppy Permanent Memory`

| Field | Type | Description |
|-------|------|-------------|
| `Title` | Title | Brief summary of the memory |
| `Content` | Rich Text | Full content in original voice |
| `Category` | Select | SOP, Framework, Guide, Template, Team, Preference |
| `Author` | Text | Who originally said/wrote this |
| `Source` | Text | Channel/DM where this came from |
| `Created` | Date | When it was saved |
| `Last Referenced` | Date | When Poppy last used this |
| `Tags` | Multi-select | Additional categorization |

## Triggers for Permanent Storage

### Explicit Triggers
- User says: "save this to permanent memory"
- User says: "remember this forever"
- User says: "this is an SOP"
- User uses the save command/button

### Automatic Detection (AI Classification)
Keywords/patterns that suggest permanent storage:
- "always", "never", "standard", "process", "SOP"
- "framework", "template", "guide", "how to"
- "team member", "role", "preference"
- Structured lists with steps
- Content that defines processes or rules

## Implementation Plan

### Phase 1: Foundation (Day 1)
- [ ] Set up Notion API integration
- [ ] Create Notion database with schema
- [ ] Build `saveToNotion()` utility function
- [ ] Add environment variables for Notion API

### Phase 2: Save Flow (Day 1-2)
- [ ] Add classification logic to detect permanent-worthy content
- [ ] Integrate with existing `poppy team memory` tool
- [ ] Store author, source, and original voice
- [ ] Add explicit "save to permanent memory" trigger

### Phase 3: Retrieval Flow (Day 2)
- [ ] Build `queryNotion()` function with category filtering
- [ ] Add fallback logic: Ragie fails → try Notion
- [ ] Combine Notion results with Ragie in AI context
- [ ] Add "Last Referenced" tracking

### Phase 4: Polish (Day 2-3)
- [ ] Handle Notion API rate limits (queue/batch)
- [ ] Add error handling and logging
- [ ] Test with real team memories
- [ ] Documentation

## API Requirements

### Notion
- API Key (integration token)
- Database ID for permanent memory
- Permissions: Read, Insert, Update

### Environment Variables
```
NOTION_API_KEY=secret_xxx
NOTION_MEMORY_DATABASE_ID=xxx
```

## Considerations

### Sync/Conflict Resolution
- **Notion = Source of truth** for structured knowledge
- **Ragie = Source of truth** for conversational context
- If both return results, AI synthesizes and prioritizes Notion for stable info

### Rate Limits
- Notion: 3 requests/second
- Solution: Queue writes, batch when possible

### Voice Preservation
When saving to Notion, preserve:
- Original author's name
- Exact wording they used
- Context of where it was said

## Success Metrics

1. **Retrieval success rate** - Does Poppy find old SOPs/frameworks?
2. **Fallback usage** - How often does Notion save the day when Ragie misses?
3. **User satisfaction** - Is permanent knowledge always accessible?
4. **Classification accuracy** - Is the right content going to Notion?

## Future Enhancements

- **Notion → Ragie sync** - Index Notion in Ragie for semantic search of permanent memory
- **Version history** - Track changes to SOPs over time
- **Access control** - Some memories only visible to certain team members
- **Search UI** - Browse permanent memory in Poppy interface

---

*Status: TODO*
*Created: December 2024*
*Priority: High*

