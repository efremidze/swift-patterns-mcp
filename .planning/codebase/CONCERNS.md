# Codebase Concerns

**Analysis Date:** 2026-02-07

## Tech Debt

**Module-level singleton state management:**
- Issue: Multiple modules maintain module-level singletons without cleanup mechanisms. `semanticIndex` in `src/tools/handlers/searchSwiftContent.ts` and `sourceInstanceCache` in `src/utils/source-registry.ts` persist across requests without clear lifecycle management.
- Files: `src/tools/handlers/searchSwiftContent.ts` (line 14-22), `src/utils/source-registry.ts` (line 35)
- Impact: Long-running processes may accumulate stale state; difficult to reset or test in isolation; potential memory growth in production with high request volume
- Fix approach: Implement explicit lifecycle management with reset/cleanup methods; consider dependency injection instead of module-level singletons; add memory monitoring tests

**Cached scan result expires silently:**
- Issue: `cachedScanResult` in `src/sources/premium/patreon-dl.ts` uses a simple timestamp-based TTL (30 seconds) but only invalidates on explicit calls. If `scanDownloadedContent()` is called after expiry but without a download in between, stale cache isn't detected.
- Files: `src/sources/premium/patreon-dl.ts` (lines 25-41)
- Impact: Users may see outdated Patreon content listings; inconsistent state between actual downloads and cached metadata
- Fix approach: Add file system mtime checks; implement explicit cache invalidation on external changes; add logging when cache expires

**Unhandled promise from background prefetch:**
- Issue: In `src/index.ts` (line 218), prefetch runs as fire-and-forget with only `.catch()` logging. If prefetch fails and processes exit during startup, state may be incomplete.
- Files: `src/index.ts` (lines 216-225)
- Impact: First request may hit stale cache or fail if sources aren't loaded; no retry mechanism for failed prefetches
- Fix approach: Add retry logic with exponential backoff; track prefetch status and warn on first request if incomplete; consider blocking startup on critical source prefetch failures

## Known Bugs

**OAuth server port collision not handled:**
- Symptoms: If port 9876 is already in use, OAuth flow silently fails without clear error message
- Files: `src/sources/premium/patreon-oauth.ts` (line 232)
- Trigger: Run Patreon setup while another process uses port 9876
- Workaround: Kill process using port 9876; no dynamic port allocation fallback

**Cookie validation regex too strict:**
- Symptoms: Valid Patreon session cookies may fail validation if they contain URL-encoded characters or certain formats
- Files: `src/sources/premium/patreon-dl.ts` (line 22)
- Trigger: Copy-paste cookie with special encoding from browser DevTools
- Workaround: Manually decode cookie before entering; validation regex at line 22 only allows `[a-zA-Z0-9_-]`

**Semantic recall timeout silently returns empty results:**
- Symptoms: When semantic recall takes >5 seconds, search appears to have no semantic results without any indication of timeout
- Files: `src/tools/handlers/searchSwiftContent.ts` (lines 32-44)
- Trigger: First run with large dataset when embedding model isn't cached; slow system
- Workaround: None; timeout is hard-coded at 5 seconds

## Security Considerations

**OAuth tokens stored in system keychain without encryption verification:**
- Risk: Tokens saved to keytar but no validation that keytar was successful; falls back to no-op on Linux/WSL
- Files: `src/sources/premium/patreon-oauth.ts` (lines 52-74)
- Current mitigation: Tokens only in memory after refresh; refresh token used to get new access token
- Recommendations: Log keytar success/failure; add explicit error on Linux if keytar unavailable; consider warning users about platform-specific storage

**HTTP server in OAuth flow doesn't validate referer or origin:**
- Risk: Any local process can POST to http://localhost:9876/callback and potentially intercept OAuth codes
- Files: `src/sources/premium/patreon-oauth.ts` (lines 144-230)
- Current mitigation: Only listens on 127.0.0.1; timeout after 60 seconds
- Recommendations: Add state parameter validation (PKCE); log all callback attempts; add rate limiting

**Cookie values read directly from filesystem without atomic guarantees:**
- Risk: If another process modifies `.patreon-session` mid-read, corrupted cookie could be passed to patreon-dl
- Files: `src/sources/premium/patreon-dl.ts` (lines 148, 199)
- Current mitigation: Cookie validated against regex after read; validation happens twice (lines 150, 201)
- Recommendations: Read-lock file before parsing; add retry with backoff on validation failure

**No URL validation on feed sources:**
- Risk: RSS feed URLs are passed directly to parser without scheme/domain validation; parser could be exploited with `file://` or SSRF URLs
- Files: `src/sources/free/rssPatternSource.ts` (line 48)
- Current mitigation: Only hardcoded feed URLs in source files; no user input
- Recommendations: Still add URL validation (scheme, domain whitelist) as defensive measure; add sanitization for content extraction

## Performance Bottlenecks

**Semantic recall indexes all patterns on every search:**
- Problem: `index()` in `src/utils/semantic-recall.ts` (lines 94-149) processes all high-quality patterns, even if unchanged. With 1000+ patterns, embedding generation is expensive.
- Files: `src/utils/semantic-recall.ts` (lines 94-149), `src/tools/handlers/searchSwiftContent.ts` (lines 65-69)
- Cause: No content-hash cache persistence; every search re-indexes all patterns
- Improvement path: Persist indexed pattern hashes to disk; skip re-indexing patterns with matching hashes; batch embedding generation

**Patreon content scanning traverses entire directory tree on each call:**
- Problem: `scanDownloadedContent()` does recursive directory walk even with cache. With hundreds of posts, this is O(n) on each download attempt.
- Files: `src/sources/premium/patreon-dl.ts` (lines 221-250, 255-279)
- Cause: TTL-based cache only (30 seconds); no persistent index of downloaded posts
- Improvement path: Write manifest file on download; lazy-load post metadata; add db-like index of postIds to file paths

**Promise.allSettled on all sources even for single-source queries:**
- Problem: `searchMultipleSources()` in `src/utils/source-registry.ts` (lines 108-121) uses `Promise.allSettled` even when only 1 source requested, causing unnecessary parallel waits.
- Files: `src/utils/source-registry.ts` (lines 113-115)
- Cause: Always uses Promise.allSettled for consistency; no shortcut for single source
- Improvement path: Single-source queries should bypass allSettled; benchmark if meaningful

**Large file cache reads into memory without streaming:**
- Problem: Cache uses JSON.parse on entire file; large pattern arrays (5000+ items) loaded fully into memory
- Files: `src/utils/cache.ts` (lines 79-80, 181-182)
- Cause: Simple JSON serialization; no pagination or streaming
- Improvement path: Implement streaming JSON parser for large caches; add pagination to intentCache

## Fragile Areas

**Inflight dedup depends on Promise identity:**
- Files: `src/utils/inflight-dedup.ts`
- Why fragile: If same key is requested before promise settles, shared promise is returned. Any mutation on result affects all waiters. Error from one caller affects all.
- Safe modification: Treat results as immutable; clone deeply before returning; consider separate Promise chains for each caller
- Test coverage: No tests for concurrent access or error propagation; `src/utils/__tests__/inflight-dedup.ts` doesn't exist

**Patreon OAuth state not validated:**
- Files: `src/sources/premium/patreon-oauth.ts` (lines 129-258)
- Why fragile: No CSRF protection; state parameter not used; same port always 9876; no nonce validation
- Safe modification: Add state parameter generation in `startOAuthFlow`; validate on callback; use random port with dynamic fallback
- Test coverage: No integration tests for OAuth flow; `src/sources/premium/__tests__/patreon-integration.test.ts` mocks downloads but not OAuth

**SourceManager config synchronization across instances:**
- Files: `src/config/sources.ts` (lines 147-261)
- Why fragile: Multiple SourceManager instances can be created; each maintains separate in-memory config; writes from one instance don't reflect in others without reload
- Safe modification: Use singleton pattern; add file watch for external changes; implement config version tracking
- Test coverage: `src/config/__tests__/sources.test.ts` tests individual methods but not concurrent instance behavior

**Memvid memory file locked during entire search operation:**
- Files: `src/utils/memvid-memory.ts`, `src/tools/handlers/searchSwiftContent.ts` (lines 154-195)
- Why fragile: If memvid locks the file for read, multiple searches can queue; if store fails, partial data may be written
- Safe modification: Add lock timeout; implement read-write lock; add transaction semantics
- Test coverage: Memvid integration tested in `src/utils/__tests__/semantic-recall.test.ts` but not for concurrent access

## Scaling Limits

**In-flight promise map grows unbounded:**
- Current capacity: Only limited by available memory
- Limit: With thousands of concurrent requests, `inflight` Map in `InflightDeduper` can consume significant memory
- Scaling path: Add max size limit with LRU eviction; add metrics for in-flight count; implement timeout cleanup for abandoned promises

**Semantic recall embeddings cached in memory only:**
- Current capacity: Limited by semantic index's `indexedMap` size; default ~100 patterns in memory
- Limit: With 10,000+ patterns, memory can exhaust (embeddings are Float32Array ~768 floats each ≈ 3KB per pattern = 30MB)
- Scaling path: Implement disk-based embedding cache; add eviction policy; lazy-load embeddings

**MiniSearch index grows with pattern count:**
- Current capacity: All patterns indexed in memory; `CachedSearchIndex` in `src/utils/search.ts` maintains full inverted index
- Limit: With 50,000+ patterns from Memvid + all sources, index construction time and memory explode
- Scaling path: Implement incremental indexing; add index persistence; consider external search engine (Elasticsearch) for very large datasets

**Cache directory disk usage unbounded:**
- Current capacity: Each namespace gets separate directory; no quota or cleanup
- Limit: Weekly runs with 10+ searches = hundreds of MB in cache files
- Scaling path: Implement disk quota per namespace; add automatic oldest-first cleanup; compress old caches

## Dependencies at Risk

**@xenova/transformers (transformers.js) lazy-loaded without version pinning strategy:**
- Risk: Heavy ML library (ONNX model ~40MB) downloaded on first semantic recall use; model URLs could change; version mismatches cause silent failures
- Impact: First semantic search very slow; network dependency at runtime; model download can fail silently
- Migration plan: Pre-bundle ONNX model; implement download with progress; fallback to lexical search on model load failure

**patreon-dl as external npx dependency:**
- Risk: Requires npm in production; version 3.6.0 pinned but no lock on transitive dependencies; npm registry unavailability blocks Patreon downloads
- Impact: Deployment requires npm/node-gyp; slow download of npm package on each use; package maintainer could stop supporting
- Migration plan: Vendor patreon-dl; implement native download client; add fallback to alternative scraper

**linkedom for HTML parsing:**
- Risk: Uses WASM; encoding detection could fail on non-UTF8 content; no timeout for parsing huge files
- Impact: Hang on malformed HTML; memory exhaustion on huge pages; content extraction may fail silently
- Migration plan: Add HTML parse timeout; implement size limit before parsing; add fallback to regex extraction

## Missing Critical Features

**No rate limiting on external API calls:**
- Problem: Searches can trigger multiple RSS fetches, YouTube API calls, and Patreon API calls without backoff; could be rate-limited or blocked
- Blocks: Large bulk operations; API cost control; sharing infrastructure resources fairly
- Fix approach: Implement token bucket rate limiter per source; add retry-after header handling; batch requests

**No observability into request/response patterns:**
- Problem: Only console.log in CLI and logger in some paths; no structured request tracing; hard to diagnose slow searches
- Blocks: Performance debugging; understanding user behavior; alerting on errors
- Fix approach: Add request ID tracing; implement metrics export (Prometheus format); add timing breakdown to responses

**No cache invalidation strategy:**
- Problem: Caches persist for configured TTL regardless of content changes; no manual purge mechanism; no dependency tracking
- Blocks: Hot-fixing wrong data; responding to source updates; testing
- Fix approach: Add cache purge CLI command; implement etag/last-modified tracking; add dependency graph for cache invalidation

## Test Coverage Gaps

**OAuth flow not tested:**
- What's not tested: Happy path through callback; error handling; timeout; browser opening (platform-specific)
- Files: `src/sources/premium/patreon-oauth.ts` (entire file)
- Risk: OAuth breaks silently; users can't set up Patreon without manual testing
- Priority: **High** - Core feature

**Concurrent source access not tested:**
- What's not tested: Multiple simultaneous searches; race conditions in singleton state; cache coherency
- Files: `src/utils/source-registry.ts`, `src/config/sources.ts`
- Risk: Intermittent failures under load; data corruption
- Priority: **Medium** - Production risk

**Patreon download with corrupted metadata:**
- What's not tested: Truncated post_info/post-api.json; malformed directory names; missing postId extraction
- Files: `src/sources/premium/patreon-dl.ts` (lines 284-334)
- Risk: Crashes when scanning corrupted downloads
- Priority: **Medium** - Operational risk

**Semantic recall timeout behavior:**
- What's not tested: Timeout actually returns empty array; timing of 5 second cutoff
- Files: `src/tools/handlers/searchSwiftContent.ts` (lines 32-44)
- Risk: Timeout silently degrades; users don't know search was incomplete
- Priority: **Low** - UX issue

**Network failure resilience:**
- What's not tested: Feed fetch timeout; Patreon OAuth network errors; YouTube API unavailable
- Files: `src/sources/free/rssPatternSource.ts` (line 48), `src/sources/premium/youtube.ts`
- Risk: User sees generic errors instead of helpful messaging
- Priority: **Medium** - Reliability

---

*Concerns audit: 2026-02-07*
