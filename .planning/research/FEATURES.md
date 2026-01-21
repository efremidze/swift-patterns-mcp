# Features Research: Intent Cache Capabilities

## Table Stakes Features (Must Have)

### 1. Query Normalization Pipeline
**Complexity:** Low

- Lowercase conversion, whitespace trimming
- Stopword removal using existing STOPWORDS
- Preserves Swift technical terms
- Reuse existing tokenize() from search.ts

### 2. Deterministic Cache Key Generation
**Complexity:** Low

- SHA-256 hash of normalized inputs
- Components: toolName + normalizedQuery + sortedSources + minQuality
- Consistent ordering for source lists

### 3. Time-Based Expiration (TTL)
**Complexity:** Low (reuse FileCache)

- 6-24 hours per requirements (recommend 12h)
- Automatic expiration cleanup
- Per-entry TTL storage

### 4. Two-Tier Storage (Memory + File)
**Complexity:** Low (reuse FileCache)

- L1: In-memory LRU (fast, limited)
- L2: File-based (persistent)
- Write-through to both tiers

### 5. Cache Value Structure
**Complexity:** Low

```typescript
interface IntentCacheValue {
  patternIds: string[];
  relevanceScores: number[];
  metadata: {
    totalResults: number;
    toolName: string;
    query: string;
    sources: string[];
    minQuality: number;
    timestamp: number;
  };
}
```

### 6. Selective Invalidation by Source Config
**Complexity:** High

- Source enable/disable triggers selective clear
- Only invalidate entries that depend on changed source
- Track source-to-key mapping or use namespace per source combo

## Differentiating Features (Nice to Have)

### 7. Cache Hit/Miss Metrics
**Complexity:** Low

- Count hits vs misses
- Track hit rate per tool
- Useful for validation

### 8. Source Combination Fingerprinting
**Complexity:** Low

- Hash source combination separately
- Shorter cache keys, easier invalidation

## Anti-Features (Avoid)

- Caching raw content (already in articleCache)
- Shared cache across instances (file-based sufficient)
- Very long TTL (staleness risk)
- Synchronous operations (use async)

## Implementation Phases

**Phase 1 (80% value):** Table stakes 1-5
**Phase 2 (Required):** Selective invalidation
**Phase 3 (15% improvement):** Metrics, fingerprinting

---
*Research completed: 2026-01-21*
