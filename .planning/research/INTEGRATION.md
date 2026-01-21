# Architecture Research: Integration Patterns

## Current Handler Architecture

**Handler Flow:**
1. Handler receives `(args, context) => Promise<ToolResponse>`
2. Extracts parameters (topic, query, source, minQuality, requireCode)
3. Calls `getSources()` or `searchMultipleSources()` from source-registry.ts
4. Sources fetch patterns (with existing RSS/article caching)
5. Results filtered, scored, sorted
6. Formatted via pattern-formatter.ts
7. Returned as ToolResponse

## Integration Points

### getSwiftPattern.ts
- Topic-based queries with quality filtering
- Parameters: topic, minQuality, requireCode, source
- Insert cache check before source calls

### searchSwiftContent.ts
- Full-text search with code filtering
- Parameters: query, minQuality, requireCode
- Insert cache check before search calls

## Proposed Data Flow

```
Handler Entry
    |
Check Intent Cache (NEW)
    | cache miss
Fetch from Sources (existing FileCache)
    |
Process & Score (existing)
    |
Store in Intent Cache (pattern IDs + metadata)
    |
Format & Return
```

## Key Files to Modify

1. **src/utils/intent-cache.ts** (NEW) - IntentCache class
2. **src/tools/handlers/getSwiftPattern.ts** - Add cache integration
3. **src/tools/handlers/searchSwiftContent.ts** - Add cache integration
4. **src/tools/handlers/enableSource.ts** - Add invalidation hook

## Error Handling Strategy

- Cache miss: proceed normally (no error)
- Cache error: log and proceed without cache
- Source changes: selective invalidation
- Corrupted cache: clear and rebuild

## Invalidation Triggers

1. Source enable/disable via SourceManager
2. TTL expiration (12-24 hours)
3. Manual cache clear (future CLI command)

---
*Research completed: 2026-01-21*
