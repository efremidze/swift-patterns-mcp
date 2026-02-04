Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
Plan: HTTP Conditional Caching for RSS Sources

Problem

When app-level cache TTLs expire, every fetch is a full download even if content hasn't changed. RSS feeds and articles rarely change
between refreshes, so most re-fetches are wasted bandwidth. This is the primary reason integration tests take 60+ seconds.

VanderLee Investigation Result

VanderLee's RSS feed (avanderlee.com/feed/) only includes <description> with short excerpts -- no <content:encoded>. The fetchFullArticle: true setting is necessary. However, HTTP conditional caching will still help by avoiding re-downloading unchanged article pages.

Approach

Add ETag/Last-Modified support so servers can respond with 304 Not Modified instead of full content. Three layers of changes:

---
Step 1: Extend FileCache with HTTP metadata

File: src/utils/cache.ts

- Add HttpCacheMetadata interface (etag?: string, lastModified?: string)
- Add optional httpMeta field to CacheEntry (backward-compatible with existing cache files)
- Add getExpiredEntry<T>(key) method -- returns expired entries instead of null so callers can access the httpMeta for conditional
requests
- Add refreshTtl(key, ttl) method -- refreshes timestamp on 304 without rewriting data
- Extend set() with optional httpMeta parameter

Step 2: Add conditional fetch to HTTP layer

File: src/utils/http.ts

- Add fetchWithTimeoutRaw() -- variant that returns Response without throwing on 304
- Add ConditionalFetchResult<T> type ({ data, httpMeta, notModified })
- Add fetchTextConditional(url, options, cachedMeta?) -- sends If-None-Match/If-Modified-Since headers when metadata is available,
returns cached data indicator on 304, new data + headers on 200

Step 3: Switch RSS base class from parseURL to fetch + parseString

File: src/sources/free/rssPatternSource.ts

Refactor fetchPatterns():
1. Check rssCache.get() -- if valid hit, return (unchanged)
2. Check rssCache.getExpiredEntry() -- get expired data + httpMeta
3. fetchTextConditional(feedUrl, headers, expiredEntry?.httpMeta)
4. On 304: rssCache.refreshTtl(), return expired data
5. On 200: parser.parseString(xml), process patterns, rssCache.set() with new httpMeta

Same pattern for fetchArticleContent() (benefits VanderLee's per-article fetches).

This requires switching from parser.parseURL() (which does its own HTTP, no header control) to fetching XML ourselves +
parser.parseString(). Confirmed parseString() returns the same type.

Step 4: Update tests

- src/utils/__tests__/cache.test.ts -- tests for getExpiredEntry(), refreshTtl(), set() with httpMeta
- src/utils/__tests__/http.test.ts (new) -- tests for conditional fetch: 304 handling, header sending, fallback without metadata
- src/sources/free/__tests__/rssPatternSource.test.ts -- update mocks from parseURL → parseString, add conditional request test
- src/sources/free/__tests__/{sundell,vanderlee,nilcoalescing}.test.ts -- update rss-parser mocks to provide parseString

---
Impact

- All RSS sources get conditional caching automatically (inherited from base class)
- VanderLee article fetches get conditional caching (per-article 304s instead of full re-downloads)
- Existing cache files continue to work (httpMeta is optional)
- No changes to source subclasses (Sundell, NilCoalescing, VanderLee constructors unchanged)

Verification

1. npm run build -- compiles cleanly
2. npm test -- all existing + new tests pass
3. Manual: Clear cache (~/.cache/swift-mcp/), run integration tests twice. Second run should be significantly faster due to 304
responses.