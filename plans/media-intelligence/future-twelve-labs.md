# Future: Twelve Labs Video Clipping Integration

> **Status**: 📋 Planned (not started)  
> **Prerequisite**: Complete Gemini integration first

## When to Add This

Add Twelve Labs when you want to enable:
- "Clip the part where X happens"
- "Find all moments when Y is mentioned"
- "Create a highlight reel of Z"
- Natural language video editing

## What Twelve Labs Does

```
You: "Find the moment where he gives the speech about motivation"
     
Twelve Labs: {
  "clips": [
    {
      "start": 142.5,
      "end": 198.3,
      "confidence": 0.94,
      "description": "Speaker delivers motivational speech about persistence"
    }
  ]
}
```

Returns **timestamps** you can use with Mux/FFmpeg to actually cut the video.

## Why Not Now?

1. **Gemini handles immediate needs** - understanding what's IN media
2. **Twelve Labs is specialized for search/clipping** - different use case
3. **Adds complexity** - another API, another billing relationship
4. **Can be added later** - independent of Gemini integration

## Integration Architecture (When Ready)

```
┌─────────────────────────────────────────────────────────────┐
│  User: "Clip the hook at start + the speech moment"         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Twelve Labs: Semantic Search                               │
│  → Query 1: "wild hook opening"     → 00:03 - 00:15         │
│  → Query 2: "speech moment"          → 02:22 - 03:31        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Mux / FFmpeg: Clip & Stitch                                │
│  → Extract clip 1 (00:03 - 00:15)                           │
│  → Extract clip 2 (02:22 - 03:31)                           │
│  → Combine into new video                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     🎬 Final Clipped Video
```

## Twelve Labs Models

| Model | Purpose |
|-------|---------|
| **Marengo** | Semantic search, find moments |
| **Pegasus** | Summarization, highlights |

## Pricing

- Credits-based system
- More expensive than general AI
- Best for video-heavy apps

## Links

- Docs: https://docs.twelvelabs.io/
- API Reference: https://docs.twelvelabs.io/reference
- Pricing: https://twelvelabs.io/pricing

---

## Implementation Steps (Future)

1. Index videos to Twelve Labs when uploaded
2. Create search API route
3. Integrate with Mux for clipping
4. Build clip preview UI
5. Enable "Create clip" from natural language

