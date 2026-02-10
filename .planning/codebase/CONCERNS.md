# Codebase Concerns

**Analysis Date:** 2026-02-09

## Tech Debt

**Patreon OAuth Token Storage Fragility:**
- Issue: OAuth tokens are stored via `keytar` (system keyring), but fall back to complete no-op if unavailable
- Files: `src/sources/premium/patreon-oauth.ts` (lines 52-60, 62-75)
- Impact: On Linux systems without libsecret, or when keytar fails, tokens won't persist across sessions despite appearing to save successfully
- Fix approach: Add explicit error handling and user warning when keytar is unavailable; consider fallback encrypted file storage with clear warnings

**Module-Level Error State in YouTube Client:**
- Issue: YouTube API errors are tracked globally in `youtubeStatus` object, creating implicit state management
- Files: `src/sources/premium/youtube.ts` (lines 14-29)
- Impact: Error state persists across calls and may mislead users about which specific operations failed; concurrent requests share mutable state
- Fix approach: Return error status with each request result instead of maintaining module-level state; use structured error tracking per-call

**Broad Error Suppression in Search Index:**
- Issue: Many search operations return empty array `[]` on any error without logging context
- Files: `src/sources/premium/youtube.ts` (lines 103, 115, 173, 191, 207, 219, 238, 253)
- Impact: Errors are silently hidden, making debugging difficult; failed requests look identical to "no results"
- Fix approach: Log all unexpected errors with context; differentiate between "no results" (intentional) and "error prevented search" (unexpected)

**Patreon Post Matching Logic Duplication:**
- Issue: Post ID matching logic repeated in 3 locations with identical patterns
- Files: `src/sources/premium/patreon-dl.ts` (lines 137-142, 169-173) and `src/sources/premium/patreon.ts` (lines 500-504)
- Impact: Bug fixes must be made in multiple places; inconsistency risk when modifying matching logic
- Fix approach: Extract into utility function `matchesDownloadedPost()` in `patreon-dl.ts` and reuse

**Large File Complexity - Patreon Source:**
- Issue: `patreon.ts` is 792 lines with multiple concerns mixed together
- Files: `src/sources/premium/patreon.ts`
- Impact: Hard to test individual features; multiple scoring strategies (query overlap, quality signals) intermingled; difficult to modify ranking logic
- Fix approach: Extract scoring logic into separate module; split search variants from result ranking; separate enrichment from base search

## Known Bugs

**Cache Key Collision Risk:**
- Issue: Cache keys are sanitized by replacing non-alphanumeric chars with `_`, potentially creating collisions
- Files: `src/utils/cache.ts` (lines 52-59)
- Example: Both `query-1` and `query_1` become `query_1`
- Trigger: Any two different cache keys that differ only in special characters
- Workaround: Use hashing for all keys to avoid collision; hash is already implemented for long keys
- Priority: Medium

**OAuth Server Port Conflict:**
- Issue: OAuth callback server hardcoded to port 9876 without conflict checking
- Files: `src/sources/premium/patreon-oauth.ts` (line 13)
- Impact: If port is already in use, OAuth flow silently fails or hangs
- Fix approach: Try multiple ports, detect in-use via EADDRINUSE error, provide clear error message with suggested alternatives

**YouTube API Error Not Propagated:**
- Issue: `fetchWithTimeout` silently fails with network errors but `recordError` not called in some paths
- Files: `src/sources/premium/youtube.ts` (lines 36-40, 132-136)
- Impact: Module state shows no error while YouTube API is actually unreachable
- Fix approach: Ensure all fetch failures call `recordError()` consistently

## Security Considerations

**Cookie Validation Insufficient:**
- Risk: Cookie validation regex `^[a-zA-Z0-9_-]+$` is overly permissive and may allow injection via later API usage
- Files: `src/sources/premium/patreon-dl.ts` (line 22)
- Current mitigation: Cookie is passed to `execFile` without shell interpolation (safe)
- Recommendations: Add length limits (currently max 256); validate against Patreon session_id format more strictly; consider additional checks before passing to child processes

**OAuth Callback HTML Not Escaped:**
- Risk: Error messages displayed in HTML without escaping (lines 157, 168)
- Files: `src/sources/premium/patreon-oauth.ts` (lines 155-158, 166-169)
- Current mitigation: Error values come from OAuth provider parameters, not user input
- Recommendations: HTML-escape error messages before rendering; use templating engine or DOMPurify for safety

**HTTP Server Port Binding:**
- Risk: OAuth flow creates HTTP server on localhost without CSRF protection; token exchange payload not validated against timing attacks
- Files: `src/sources/premium/patreon-oauth.ts` (lines 144-220)
- Current mitigation: Redirect URI must match registered OAuth app; state parameter not currently used (spec compliance gap)
- Recommendations: Add `state` parameter to auth URL and validate in callback; implement PKCE flow instead of simple code exchange

**Keytar Dependency Missing on Linux:**
- Risk: Required system library (libsecret) often missing on Linux, causing silent fallback to no-op
- Files: `src/sources/premium/patreon-oauth.ts` (lines 17-25)
- Current mitigation: None; users unaware tokens aren't persisting
- Recommendations: Fail loudly with setup instructions; document libsecret requirement; provide alternative storage option

## Performance Bottlenecks

**Directory Traversal on Every Scan:**
- Problem: `scanDownloadedContent()` walks entire Patreon download directory recursively every call
- Files: `src/sources/premium/patreon-dl.ts` (lines 221-249)
- Cause: No persistent index; scan called during every search operation
- Current: 30-second in-memory cache mitigates but still re-scans after expiry
- Improvement path: Maintain persistent metadata file (manifest.json) instead of re-scanning; use file watcher to invalidate

**YouTube Search Variants Serial:**
- Problem: When searching with query variants, videos are searched one variant at a time then merged
- Files: `src/sources/premium/patreon.ts` (lines 604-615)
- Cause: Variants loop is sequential; early exit on reaching `MAX_VIDEOS_PER_CREATOR`
- Improvement path: Run variant searches in parallel with `Promise.all`; merge results and dedupe once

**Patreon Post Enrichment Concurrency:**
- Problem: `enrichPatternsWithContent()` uses configurable concurrency but default is 3
- Files: `src/sources/premium/patreon.ts` (lines 693-750)
- Cause: Manual worker pool implementation instead of using concurrency library
- Improvement path: Use `p-limit` (already in dependencies) for cleaner, tested concurrency management

**Cache Hit Rate Unknown:**
- Problem: No observability into how often caches are hit vs. missed
- Files: `src/utils/cache.ts`, `src/utils/memvid-memory.ts`
- Impact: Can't tell if caching is effective; can't identify stale patterns
- Improvement path: Add metrics tracking (cache hits/misses); periodic logging of cache stats

## Fragile Areas

**YouTube API Dependency Chain:**
- Files: `src/sources/premium/youtube.ts` (entire file), `src/sources/premium/patreon.ts` (lines 562-579)
- Why fragile: YouTube API requires valid `YOUTUBE_API_KEY` env var; any API outage breaks Patreon video search entirely
- Safe modification: Test all code paths with mocked YouTube API; add circuit breaker for repeated failures
- Test coverage: `src/sources/premium/__tests__/patreon-integration.test.ts` does some mocking but limited

**Query Profile Builder:**
- Files: `src/sources/premium/patreon.ts` (lines 132-191)
- Why fragile: Complex token stemming and weighting logic with multiple heuristics (position boost, specificity boost, min score thresholds)
- Safe modification: Add comprehensive tests for edge cases (empty query, very long query, special characters); test scoring against known queries
- Test coverage: `src/tools/handlers/__tests__/getPatreonPatterns.test.ts` has some coverage but not exhaustive

**Pattern Deduplication Logic:**
- Files: `src/sources/premium/patreon.ts` (lines 279-357)
- Why fragile: Multiple canonicalization strategies (URL parsing, patreon-page vs youtube detection, file:// handling)
- Safe modification: Add tests for all URL formats; test dedup with conflicting quality scores; ensure "prefer-best" strategy is deterministic
- Test coverage: No dedicated test for `buildPatternDedupKey()` or `dedupePatterns()`

**Oauth Flow Race Condition:**
- Files: `src/sources/premium/patreon-oauth.ts` (lines 144-220)
- Why fragile: `serverClosed` flag checked in async handler; if user hits callback twice or closes server manually, state becomes inconsistent
- Safe modification: Use Promise-based cleanup; test server closes reliably; handle duplicate callbacks gracefully
- Test coverage: No automated tests for OAuth flow

## Scaling Limits

**Memory Cache Limited by Max Size:**
- Current capacity: 200 entries for Patreon search cache (line 372 in patreon.ts), 100 for other caches
- Limit: After max entries, oldest entries evicted; no control over what's kept
- Scaling path: Make max sizes configurable; add metrics to understand eviction patterns; implement ttl-based cleanup instead of LRU for predictable behavior

**Downloaded Patreon Content Scan:**
- Current capacity: Handles single-creator downloads but O(n) with total posts downloaded
- Limit: Once >1000 posts downloaded, scan becomes slow; no lazy loading or pagination
- Scaling path: Use manifest file with post metadata; implement lazy loading by creator; paginate results

**Embedding Model Memory Usage:**
- Current: `@xenova/transformers` loads full embedding model into memory
- Limit: ~2GB+ memory per process when using semantic search
- Scaling path: Use shared worker process for embeddings; implement quantization; consider external embedding service

## Dependencies at Risk

**`keytar` - Critical but Optional:**
- Risk: Breaks on Linux without libsecret; users don't know token persistence failed; fallback is silent
- Impact: OAuth tokens won't survive restarts on affected systems; users can't use Patreon integration
- Migration plan: Implement encrypted file-based fallback; document system dependencies clearly; test on CI on multiple Linux distros

**`@xenova/transformers` - Large Binary:**
- Risk: Adds significant download and memory overhead; npm package includes all language models
- Impact: Installation slow for offline environments; memory usage high even when semantic search disabled
- Migration plan: Lazy-load only on first use; consider external service; implement feature flag to disable semantic search

**`playwright` - Heavy Dependency:**
- Risk: Large package with native bindings; may cause installation failures on some systems
- Impact: Used for web scraping but only in Patreon download flow; adds overhead for users who don't use it
- Migration plan: Make optional peer dependency; lazy-load only when needed; provide npm script to skip installation

**`rss-parser` - Unmaintained Risk:**
- Risk: Version 3.13.0 is stable but library updates infrequently; RSS spec has edge cases
- Impact: Could be vulnerable to malformed RSS feeds; may not handle newer RSS formats
- Migration plan: Monitor for security advisories; consider switching to more actively maintained parser; add input validation

## Missing Critical Features

**No Circuit Breaker for External APIs:**
- Problem: YouTube API, Patreon API failures cause immediate propagation; no retry or fallback
- Blocks: Users get error when APIs are temporarily unavailable instead of stale cached results
- Recommendation: Implement circuit breaker pattern; return stale data when APIs fail; add exponential backoff with jitter

**No Rate Limiting on Patreon Downloads:**
- Problem: `downloadCreatorContent()` has 5-minute timeout but no rate limiting per creator
- Blocks: Multiple rapid download requests could overwhelm Patreon or trigger IP blocks
- Recommendation: Add per-creator rate limiter; implement download queue; respect Patreon API rate limits

**No Webhook Support for Updated Content:**
- Problem: Patterns are only refreshed on user search; no way to detect and pull new creator content
- Blocks: Users see stale patterns until cache expires or manual refresh; cannot follow creator updates
- Recommendation: Implement optional webhook endpoint for Patreon to notify of new posts; add polling option

## Test Coverage Gaps

**Premium Source Integration Untested:**
- What's not tested: Full OAuth flow with actual Patreon API; token refresh and expiry handling; concurrent enrichment with multiple creator downloads
- Files: `src/sources/premium/patreon.ts`, `src/sources/premium/patreon-oauth.ts`, `src/sources/premium/patreon-dl.ts`
- Risk: OAuth failures, download interruptions, and token management bugs only discovered in production
- Priority: High - These are user-facing critical paths

**CLI Setup Wizard Logic:**
- What's not tested: Interactive menu navigation, config file writing, format validation for all client types
- Files: `src/cli/setup.ts`
- Risk: Setup can break silently; users may configure wrong paths or servers
- Priority: Medium

**Error Recovery Paths:**
- What's not tested: Network timeouts, partial downloads, corrupted cache files, missing cookies
- Files: Throughout `src/sources/premium/` and `src/utils/cache.ts`
- Risk: Edge cases cause confusing errors or silent failures
- Priority: Medium

**Cache Behavior Under Load:**
- What's not tested: Multiple concurrent cache operations, disk space exhaustion, file permission errors
- Files: `src/utils/cache.ts`
- Risk: Cache can corrupt or leak connections under stress
- Priority: Low-Medium

---

*Concerns audit: 2026-02-09*
