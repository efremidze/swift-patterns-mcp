Architecture Review: Patreon/YouTube Flow

How It Works Today

The Patreon flow is actually a YouTube-first discovery pattern:

1. get_patreon_patterns handler creates a PatreonSource
2. searchPatterns() iterates 3 hardcoded creators (Kavsoft, sucodee, SwiftUICodes)
3. For each creator, calls YouTube API (2 requests: search + video details)
4. Extracts Patreon links from video descriptions
5. Downloads Patreon post content via patreon-dl CLI
6. Scans filesystem for downloaded Swift files
7. Returns enriched patterns

Critical Flaws Found

1. O(n) Directory Scan on Every Request (patreon-dl.ts:70-87)

isPostDownloaded() does a full recursive directory traversal of ~/.swift-patterns-mcp/patreon-content/ for every single post check.
Then scanDownloadedContent() (line 181-206) does another full scan. Both are called inside downloadPost(), meaning 2-3 full filesystem walks per pattern with Patreon links.

With 25 videos returning 10 Patreon links = 20-30 full directory scans per search.

2. Sequential Creator Searches (patreon.ts:217-226)

The 3 creators are searched sequentially with for...of instead of Promise.all(). Each YouTube search takes ~200-300ms (2 API calls), so a single query costs ~900ms just for YouTube.

3. No Caching of YouTube Results

YouTube API calls are never cached individually. The intent cache covers the final output, but if it misses, all 6 API calls (2 per creator) fire fresh. No intermediate FileCache layer for video metadata.

4. Default Enrichment Concurrency = 1 (patreon.ts:237)

PATREON_ENRICH_CONCURRENCY defaults to 1, meaning patreon-dl downloads happen one at a time. Each download can take 2-5s, so 10 posts = 20-50 seconds of sequential downloading.

5. No Timeouts on API Calls (youtube.ts)

All fetch() calls to YouTube have no timeout or abort signal. A slow YouTube API response hangs the entire handler indefinitely.

6. Silent Failures Everywhere

- Missing YOUTUBE_API_KEY returns [] silently
- Failed API calls return [] with only a stderr log
- Expired Patreon session cookies fail without user feedback
- User sees "no results" with no indication of whether it searched or failed

7. YouTube Quota Blindness

No tracking of the 10,000 unit/day YouTube quota. Each search uses ~200 units (2 calls x 100 each). A user could exhaust their daily quota in ~50 searches with zero warning.

Broader Architecture Issues

8. Semantic Recall Cold Start: 30-120s (semantic-recall.ts:60-76)

First call to searchSwiftContent with semantic recall enabled downloads a ~100MB transformer model, then computes embeddings for every pattern. Subsequent calls reuse the singleton but the first call is catastrophic.

9. Synchronous File Cache I/O (cache.ts:79, 112)

FileCache.get() uses fs.readFileSync() and FileCache.set() uses fs.writeFileSync(). These block the event loop on every cache access.

10. Search Index Rebuilt Unnecessarily (search.ts:195-223)

CachedSearchIndex computes a hash of all pattern IDs sorted (O(n log n)) on every search call to check if rebuild is needed. For 1000+ patterns, this adds 10-50ms per query even when nothing changed.

11. Double-Fetch for Semantic Recall (searchSwiftContent.ts:52)

When semantic recall activates, it calls fetchAllPatterns() to get all patterns from all sources — even though searchMultipleSources() just fetched them. The same data is fetched twice.

Latency Profile (Worst Case)
┌───────────────────────────────────────┬────────────┬────────┐
│                 Step                  │    Cold    │  Warm  │
├───────────────────────────────────────┼────────────┼────────┤
│ YouTube API (3 creators, sequential)  │ ~900ms     │ ~900ms │
├───────────────────────────────────────┼────────────┼────────┤
│ Patreon enrichment (10 posts, serial) │ ~20-50s    │ ~2-5s  │
├───────────────────────────────────────┼────────────┼────────┤
│ Filesystem scans (30 traversals)      │ ~1-3s      │ ~1-3s  │
├───────────────────────────────────────┼────────────┼────────┤
│ Semantic recall (model + embeddings)  │ ~30-120s   │ ~500ms │
├───────────────────────────────────────┼────────────┼────────┤
│ Search index rebuild                  │ ~200-500ms │ ~50ms  │
├───────────────────────────────────────┼────────────┼────────┤
│ Total                                 │ ~52-174s   │ ~4-10s │
└───────────────────────────────────────┴────────────┴────────┘
Quick Wins (High Impact)

1. Parallelize creator searches — Promise.all() in searchPatterns() → 3x faster YouTube
2. Cache scanDownloadedContent() results — one scan per request, not per post
3. Add fetch timeouts — 5-10s AbortController on all external calls
4. Raise default enrichment concurrency to 3-5
5. Make file cache I/O async — fs.promises instead of sync
6. Add YouTube result caching — FileCache layer for search results (1h TTL)