# Roadmap: Intent Cache v1

## Milestone Overview

**Goal:** Intent-aware response caching for MCP tool handlers
**Phases:** 2
**Status:** COMPLETE

## Phase 1: Core IntentCache Implementation

**Focus:** Build the IntentCache class with all core functionality

### Deliverables
1. `src/utils/intent-cache.ts` - IntentCache class
2. Query normalization using existing tokenization
3. SHA-256 cache key generation
4. Source fingerprinting
5. Two-tier storage via FileCache wrapper
6. Unit tests for IntentCache

### Requirements Covered
- CACHE-01 through CACHE-05
- NORM-01 through NORM-04
- KEY-01 through KEY-05

### Key Files
- **Create:** `src/utils/intent-cache.ts`
- **Create:** `src/utils/intent-cache.test.ts`
- **Reference:** `src/utils/cache.ts` (FileCache base)
- **Reference:** `src/utils/search.ts` (STOPWORDS, tokenization)

### Acceptance Criteria
- [x] IntentCache class extends/wraps FileCache
- [x] normalizeQuery() produces deterministic output
- [x] getCacheKey() includes all required components
- [x] getSourceFingerprint() hashes sorted source IDs
- [x] get/set operations work with typed metadata
- [x] Unit tests pass (32 tests)

---

## Phase 2: Handler Integration

**Focus:** Integrate IntentCache into tool handlers

### Deliverables
1. getSwiftPattern handler integration
2. searchSwiftContent handler integration
3. Cache invalidation on source fingerprint mismatch
4. Integration tests

### Requirements Covered
- INTEG-01 through INTEG-04
- INVAL-01 through INVAL-03

### Key Files
- **Modify:** `src/tools/handlers/getSwiftPattern.ts`
- **Modify:** `src/tools/handlers/searchSwiftContent.ts`
- **Create:** `src/integration/intent-cache.test.ts`

### Acceptance Criteria
- [x] getSwiftPattern checks cache before fetching
- [x] searchSwiftContent checks cache before searching
- [x] Cache hits return correct results
- [x] Cache misses populate cache for future hits
- [x] Source config changes cause cache misses (via fingerprint)
- [x] Handler tests pass (24 tests)

---

## Phase Summary

| Phase | Focus | Requirements | Status |
|-------|-------|--------------|--------|
| 1 | Core IntentCache | CACHE-*, NORM-*, KEY-* | COMPLETE |
| 2 | Handler Integration | INTEG-*, INVAL-* | COMPLETE |

---

## Dependencies

```
Phase 1 (IntentCache class)
    |
    v
Phase 2 (Handler integration)
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Query normalization edge cases | Reuse battle-tested search.ts tokenization |
| Cache key collisions | SHA-256 makes this mathematically improbable |
| Source fingerprint invalidation | TTL provides safety net |
| Memory growth | Pattern metadata only (~1KB per entry) |

---
*Roadmap created: 2026-01-21*
*Last updated: 2026-01-21 after requirements definition*
