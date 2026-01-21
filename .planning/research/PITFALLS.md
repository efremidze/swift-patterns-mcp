# Pitfalls Research: Caching Mistakes to Avoid

## CRITICAL (Must Address)

### 1. Cache Stampede (Thundering Herd)
Multiple identical requests hitting before cache populated.

**Prevention:**
- In-flight request deduplication using `Map<string, Promise<T>>`
- Return same promise for concurrent identical requests

```typescript
private pendingFetches = new Map<string, Promise<unknown>>();

async getOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = await this.get<T>(key);
  if (cached) return cached;

  if (this.pendingFetches.has(key)) {
    return this.pendingFetches.get(key) as Promise<T>;
  }

  const promise = fetcher().finally(() => {
    this.pendingFetches.delete(key);
  });
  this.pendingFetches.set(key, promise);

  const data = await promise;
  await this.set(key, data);
  return data;
}
```

### 2. Weak Cache Key Hashing
Current FileCache uses MD5 (collision vulnerable).

**Prevention:** Use SHA-256 for all cache keys.

### 3. Inconsistent Query Normalization
"SwiftUI navigation" and "swiftui  navigation" cache separately.

**Prevention:**
- Always: `query.toLowerCase().trim()`
- Collapse spaces: `query.replace(/\s+/g, ' ')`
- Remove stopwords, preserve Swift terms

### 4. Stale Cache After Source Config Changes
Cached results incorrect when sources enabled/disabled.

**Prevention:**
- Include enabled sources in cache key
- Invalidate on source changes (selective or full clear)

### 5. Unbounded Memory Growth
Caching entire result arrays without limits.

**Prevention:**
- Cache metadata only (IDs, scores) not full objects
- Set max entry size (~10MB)
- Use existing articleCache for full patterns

## HIGH PRIORITY

### 6. Silent Cache Failures
Current FileCache catches all errors silently.

**Prevention:** Log errors, distinguish misses from errors.

### 7. TTL Misalignment
Intent cache TTL should be >= RSS cache TTL.

**Prevention:** 12h intent cache vs 1h RSS cache.

### 8. minQuality Not in Cache Key
Different quality thresholds return same cached results.

**Prevention:** MUST include minQuality in cache key generation.

### 9. JSON Serialization Hazards
Circular references, non-serializable data.

**Prevention:** Cache simple structures (IDs, scores) only.

## MEDIUM PRIORITY

### 10. LRU Eviction Churn
Memory cache evicting too frequently.

**Prevention:** Profile query patterns, start with 100-500 entries.

### 11. Query Special Characters
Unescaped characters causing filesystem issues.

**Prevention:** Always hash queries (SHA-256 is filesystem-safe).

### 12. No Cache Metrics
Can't measure effectiveness.

**Prevention:** Track hits/misses/errors, log periodically.

## Priority Matrix

| Pitfall | Severity | Must Fix? |
|---------|----------|-----------|
| Cache Stampede | CRITICAL | YES |
| Weak Hashing | CRITICAL | YES |
| Inconsistent Normalization | CRITICAL | YES |
| Stale After Config | CRITICAL | YES |
| Unbounded Memory | CRITICAL | YES |
| Missing minQuality | HIGH | YES |
| Silent Failures | HIGH | Recommended |
| TTL Misalignment | HIGH | Recommended |
| No Metrics | MEDIUM | Recommended |

---
*Research completed: 2026-01-21*
