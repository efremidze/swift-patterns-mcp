# Requirements: Intent Cache

**Defined:** 2026-01-21
**Core Value:** Return high-quality Swift patterns fast. Same query + same sources = instant response.

## v1 Requirements

### Cache Infrastructure

- [x] **CACHE-01**: IntentCache class in `src/utils/intent-cache.ts`
- [x] **CACHE-02**: SHA-256 hashing for cache keys via built-in crypto
- [x] **CACHE-03**: Two-tier storage (memory LRU + file persistence)
- [x] **CACHE-04**: TTL-based expiration (12 hours default)
- [x] **CACHE-05**: Cache stores pattern metadata only (IDs, scores, ordering)

### Query Normalization

- [x] **NORM-01**: Lowercase and trim all queries
- [x] **NORM-02**: Remove stopwords using existing STOPWORDS from search.ts
- [x] **NORM-03**: Preserve Swift technical terms (PRESERVE_TERMS)
- [x] **NORM-04**: Sort tokens alphabetically for order-independence

### Cache Key Generation

- [x] **KEY-01**: Include tool name in cache key
- [x] **KEY-02**: Include normalized query in cache key
- [x] **KEY-03**: Include minQuality threshold in cache key
- [x] **KEY-04**: Include source fingerprint (hash of enabled source IDs)
- [x] **KEY-05**: Include requireCode flag when present

### Handler Integration

- [x] **INTEG-01**: Integrate with getSwiftPattern handler
- [x] **INTEG-02**: Integrate with searchSwiftContent handler
- [x] **INTEG-03**: Cache check before source fetches
- [x] **INTEG-04**: Cache population after successful queries

### Cache Invalidation

- [x] **INVAL-01**: Source fingerprint mismatch triggers cache miss
- [x] **INVAL-02**: TTL expiration clears stale entries
- [x] **INVAL-03**: Graceful handling of corrupted cache entries

## v2 Requirements (Deferred)

### Enhanced Invalidation

- **INVAL-04**: Hook into enableSource/disableSource for selective invalidation
- **INVAL-05**: Track source-to-key mapping for precise invalidation

### Observability

- [x] **OBS-01**: Cache hit/miss metrics tracking (implemented early!)
- **OBS-02**: Periodic stats logging
- **OBS-03**: Debug endpoint for cache inspection

### Performance

- [x] **PERF-01**: In-flight request deduplication (stampede prevention) (implemented early!)
- **PERF-02**: Adaptive TTL based on query popularity

## Out of Scope

| Feature | Reason |
|---------|--------|
| Raw article caching | Already handled by articleCache |
| New npm dependencies | Constraint: built-in crypto only |
| Redis/external cache | File-based sufficient for single-instance |
| LLM text caching | No LLM text in this system |
| Distributed caching | Single-server architecture |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CACHE-01 | Phase 1 | Complete |
| CACHE-02 | Phase 1 | Complete |
| CACHE-03 | Phase 1 | Complete |
| CACHE-04 | Phase 1 | Complete |
| CACHE-05 | Phase 1 | Complete |
| NORM-01 | Phase 1 | Complete |
| NORM-02 | Phase 1 | Complete |
| NORM-03 | Phase 1 | Complete |
| NORM-04 | Phase 1 | Complete |
| KEY-01 | Phase 1 | Complete |
| KEY-02 | Phase 1 | Complete |
| KEY-03 | Phase 1 | Complete |
| KEY-04 | Phase 1 | Complete |
| KEY-05 | Phase 1 | Complete |
| INTEG-01 | Phase 2 | Complete |
| INTEG-02 | Phase 2 | Complete |
| INTEG-03 | Phase 2 | Complete |
| INTEG-04 | Phase 2 | Complete |
| INVAL-01 | Phase 2 | Complete |
| INVAL-02 | Phase 2 | Complete |
| INVAL-03 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 21 total
- Complete: 21
- Remaining: 0

---
*Requirements defined: 2026-01-21*
*Last updated: 2026-01-21 after implementation complete*
