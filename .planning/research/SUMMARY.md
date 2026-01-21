# Research Summary: Intent-Aware Response Cache

## Key Findings

### Stack Decisions (High Confidence)
- **Hashing:** SHA-256 via built-in `crypto` (replace current MD5)
- **Normalization:** Reuse existing `tokenize()` from search.ts with STOPWORDS
- **Storage:** Extend FileCache class with `intent` namespace
- **TTL:** 12 hours (between RSS 1h and articles 24h)

### Core Architecture
```
Handler Entry
    |
Build IntentKey (tool + normalized query + sources + minQuality)
    |
Check IntentCache
    | cache miss
Fetch from Sources (existing flow)
    |
Store metadata (IDs + scores) in IntentCache
    |
Return formatted response
```

### Must-Have Features
1. Query normalization (lowercase, trim, stopwords)
2. SHA-256 cache keys
3. TTL expiration (12h)
4. Two-tier storage (memory + file)
5. Pattern metadata only (not raw content)
6. Selective source invalidation

### Critical Pitfalls to Avoid
1. **Cache stampede** - Use in-flight deduplication
2. **Weak hashing** - Use SHA-256, not MD5
3. **Inconsistent normalization** - Reuse search.ts tokenization
4. **Stale after config change** - Include sources in key + invalidation hooks
5. **Missing minQuality** - MUST be part of cache key

## Implementation Scope

### Files to Create
- `src/utils/intent-cache.ts` - IntentCache class

### Files to Modify
- `src/tools/handlers/getSwiftPattern.ts` - Add cache integration
- `src/tools/handlers/searchSwiftContent.ts` - Add cache integration
- `src/tools/handlers/enableSource.ts` - Add invalidation hook (optional)

### Out of Scope
- New npm dependencies
- Redis/external infrastructure
- Caching raw article content (already in articleCache)
- LLM-generated text caching

## Estimated Complexity

| Component | Complexity | Risk |
|-----------|------------|------|
| IntentCache class | Low | Low |
| Query normalization | Low | Low |
| Cache key generation | Low | Low |
| Handler integration | Medium | Low |
| Selective invalidation | High | Medium |

## Recommendation

Proceed with implementation in two phases:
1. **Phase 1:** Core IntentCache + handler integration (1-2 days)
2. **Phase 2:** Selective invalidation on source changes (1 day)

The existing FileCache infrastructure handles 90% of caching mechanics. The new code focuses on:
- Intent key generation
- Query normalization
- Source fingerprinting
- Handler integration points

---
*Synthesized: 2026-01-21*
*Sources: STACK.md, FEATURES.md, INTEGRATION.md, PITFALLS.md*
