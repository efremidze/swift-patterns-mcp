# Stack Research: Intent-Aware Response Caching

## Recommendations

### 1. Hash Algorithm: SHA-256
**Confidence:** High

- Use SHA-256 from Node.js built-in `crypto` module
- Eliminates collision risks that MD5 has
- Native performance (<1ms per key)
- Current MD5 usage in FileCache should migrate

```typescript
import { createHash } from 'crypto';
function hashCacheKey(normalizedKey: string): string {
  return createHash('sha256').update(normalizedKey).digest('hex');
}
```

### 2. Query Normalization: Reuse Existing Tokenization
**Confidence:** High

- Leverage existing `tokenize()` and `processQuery()` from `search.ts`
- Consistency: Search index and cache use identical normalization
- Already handles lowercasing, stopword removal, stemming, Swift-specific preservation
- Reuse STOPWORDS (64 terms) and PRESERVE_TERMS (35 Swift keywords)

**Pipeline:**
1. Lowercase entire query
2. Remove non-alphanumeric (except hyphens for technical terms)
3. Split on whitespace
4. Check against PRESERVE_TERMS (keep as-is if match)
5. Remove stopwords
6. Apply Porter Stemmer
7. Sort tokens alphabetically (order-independent matching)
8. Join with spaces

### 3. Cache Key Structure: Composite Key with Source Fingerprint
**Confidence:** High

```typescript
interface CacheKeyComponents {
  tool: string;              // "get_swift_pattern" | "search_swift_content"
  normalizedQuery: string;   // After tokenization + sorting
  minQuality: number;        // Default 60
  sourceFingerprint: string; // Hash of sorted enabled source IDs
  requireCode?: boolean;     // Optional filter
}
```

Example keys:
- `get_swift_pattern::async await swiftui::q60::a3f7c2d9e1b4`
- `search_swift_content::combin network::q80::a3f7c2d9e1b4::code`

### 4. Cache Persistence: Extend FileCache
**Confidence:** Medium-High

- Create `IntentCache` class that wraps existing `FileCache`
- Reuse proven infrastructure (memory LRU + file persistence + TTL)
- Separate namespace: `intent` directory
- Type safety for pattern metadata

### 5. TTL Strategy: 12-Hour Default
**Confidence:** Medium

| Cache Type | TTL | Rationale |
|------------|-----|-----------|
| RSS feeds | 1 hour | Frequently updated |
| Intent results | 12 hours | Query patterns stable |
| Articles | 24 hours | Content rarely changes |

### 6. Invalidation: Source Fingerprint Validation
**Confidence:** High

- On cache hit, verify source fingerprint matches current enabled sources
- If mismatch, treat as cache miss
- TTL provides fail-safe for eventual consistency

### 7. Cache Content: Pattern Metadata Only
**Confidence:** High

```typescript
{
  patternIds: ["sundell-123", "vanderlee-456", ...],
  scores: [95, 87, ...],
  timestamp: 1737449820000,
  sourceFingerprint: "a3f7c2d9e1b4"
}
```

- Avoid duplicating content from articleCache
- Re-fetch full patterns by IDs on cache hit
- ~50KB total for 50 entries vs ~2.5MB for full patterns

---
*Research completed: 2026-01-21*
