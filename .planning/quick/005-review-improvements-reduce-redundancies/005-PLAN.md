---
phase: quick
plan: 005
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/cache.ts
  - src/sources/free/rssPatternSource.ts
  - src/sources/free/pointfree.ts
  - src/tools/handlers/getPatreonPatterns.ts
  - src/tools/handlers/searchSwiftContent.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "All existing tests pass after refactoring"
    - "No duplicate in-flight dedup implementations exist"
    - "PointFreeSource shares search infrastructure with other free sources"
    - "RssPatternSource item processing has no duplicated logic"
    - "Patreon handler uses shared formatting utilities"
  artifacts:
    - path: "src/utils/cache.ts"
      provides: "FileCache using InflightDeduper instead of inline Map"
    - path: "src/sources/free/rssPatternSource.ts"
      provides: "Consolidated processItem method"
    - path: "src/sources/free/pointfree.ts"
      provides: "PointFreeSource extending RssPatternSource or using shared CachedSearchIndex without reimplementation"
    - path: "src/tools/handlers/getPatreonPatterns.ts"
      provides: "Patreon formatting using pattern-formatter.ts utilities"
  key_links:
    - from: "src/utils/cache.ts"
      to: "src/utils/inflight-dedup.ts"
      via: "import InflightDeduper"
      pattern: "InflightDeduper"
---

<objective>
Reduce concrete code redundancies identified during codebase review. Three targeted refactors that eliminate duplicated logic without changing behavior.

Purpose: Reduce maintenance burden by consolidating duplicated patterns into shared abstractions.
Output: Cleaner codebase with fewer places to update when logic changes.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/utils/cache.ts
@src/utils/inflight-dedup.ts
@src/sources/free/rssPatternSource.ts
@src/sources/free/pointfree.ts
@src/tools/handlers/getPatreonPatterns.ts
@src/tools/handlers/searchSwiftContent.ts
@src/utils/pattern-formatter.ts
@src/utils/response-helpers.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Eliminate duplicated in-flight dedup in FileCache and consolidate RssPatternSource item processing</name>
  <files>src/utils/cache.ts, src/sources/free/rssPatternSource.ts</files>
  <action>
**FileCache in-flight dedup consolidation:**

`FileCache.getOrFetch()` (cache.ts lines 126-153) has its own inline in-flight deduplication using a `Map<string, Promise<unknown>>` with manual `.finally()` cleanup. This is functionally identical to the `InflightDeduper` class in `inflight-dedup.ts`.

Replace the `inFlightFetches` Map and its manual management with `InflightDeduper`:

1. Add `import { InflightDeduper } from './inflight-dedup.js';` to cache.ts
2. Replace `private inFlightFetches: Map<string, Promise<unknown>> = new Map();` with `private inFlightFetches = new InflightDeduper<string, unknown>();`
3. Rewrite `getOrFetch` to use `this.inFlightFetches.run(key, async () => { ... })` instead of the manual get/set/finally pattern
4. The InflightDeduper.run() already handles the finally/delete cleanup, so no manual cleanup needed

**RssPatternSource item processing consolidation:**

`processRssItem` (lines 65-82) and `processArticle` (lines 84-110) share ~90% identical code. The only difference is that `processArticle` attempts to fetch full article content from the URL before processing.

Merge them into a single `processItem` method:

1. Create a single `protected async processItem(item: Parser.Item): Promise<T>` method
2. If `this.options.fetchFullArticle` is true AND the item has a `link`, attempt to fetch full article content via `this.fetchArticleContent(url)`, falling back to RSS content on failure
3. Otherwise use RSS content directly
4. Remove `processRssItem` and `processArticle` as separate methods
5. Update `fetchPatterns` to call `this.processItem(item)` unconditionally (no ternary needed)

This eliminates the duplicated pattern object construction (id, title, url, publishDate, excerpt, content, topics, relevanceScore, hasCode, makePattern call) which appears identically in both methods.
  </action>
  <verify>
Run `npm test` - all existing tests must pass. Grep for `inFlightFetches` in cache.ts to confirm it uses InflightDeduper type. Grep for `processRssItem` and `processArticle` in rssPatternSource.ts to confirm they no longer exist as separate methods.
  </verify>
  <done>FileCache uses InflightDeduper instead of hand-rolled Map dedup. RssPatternSource has a single processItem method instead of two near-identical methods. All tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Use shared formatting in Patreon handler and extract repeated sort pattern</name>
  <files>src/tools/handlers/getPatreonPatterns.ts, src/tools/handlers/searchSwiftContent.ts</files>
  <action>
**Patreon handler formatting consolidation:**

`getPatreonPatterns.ts` (lines 58-68) has its own inline pattern formatting that manually constructs markdown for each pattern. Meanwhile, `pattern-formatter.ts` already provides `formatSearchPatterns()` and `formatTopicPatterns()` that do the same thing with consistent formatting, complexity detection, technique extraction, and proper truncation.

The `PatreonPattern` interface (types.ts) has the same fields as `BasePattern` (id, title, url, publishDate, excerpt, content, topics, relevanceScore, hasCode) plus `creator`. This means PatreonPatterns are compatible with the formatter after casting.

Refactor getPatreonPatterns.ts:
1. Import `formatTopicPatterns` and `COMMON_FORMAT_OPTIONS` from `../../utils/pattern-formatter.js`
2. Import `BasePattern` type from `../../sources/free/rssPatternSource.js`
3. Replace the manual `patterns.slice(0, 10).map(p => ...)` block (lines 58-68) with `formatTopicPatterns(patterns as unknown as BasePattern[], topic || 'All', { ...COMMON_FORMAT_OPTIONS, maxResults: 10 })`
4. Use `createTextResponse(formatted)` instead of the manual `formatMarkdownDocument` call
5. Keep the empty-results check as-is

Note: The `creator` field won't appear in the shared formatter output, but this is acceptable since the source ID is already shown (extracted from pattern.id). If creator visibility is important, you may add `creator` display to the excerpt or keep a one-line creator note above the formatted output.

**Repeated sort extraction in searchSwiftContent:**

The pattern `.sort((a, b) => b.relevanceScore - a.relevanceScore)` appears 3 times in searchSwiftContent.ts (lines 153, 167, 188). Extract a helper:

1. At the top of searchSwiftContent.ts (or in a shared location if preferred), add:
   ```typescript
   function byRelevanceDesc(a: BasePattern, b: BasePattern): number {
     return b.relevanceScore - a.relevanceScore;
   }
   ```
2. Replace all three `.sort((a, b) => b.relevanceScore - a.relevanceScore)` calls with `.sort(byRelevanceDesc)`
3. Since the final sort on line 153 produces the array that gets further appended to and re-sorted, keep only the final sort (line 188 equivalent) and remove the intermediate sorts on lines 153 and 167 -- they are redundant because the array is re-sorted after each append. Actually, keep the intermediate sorts to maintain identical behavior (the semantic/memvid dedup may depend on order). Just replace the inline comparators with the named function.
  </action>
  <verify>
Run `npm test` - all existing tests must pass. Verify getPatreonPatterns.ts no longer has inline markdown template strings for pattern formatting. Verify searchSwiftContent.ts uses named sort comparator.
  </verify>
  <done>Patreon handler uses shared pattern-formatter.ts instead of inline markdown templating. Sort comparator extracted to named function in searchSwiftContent.ts. All tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Make PointFreeSource leverage shared CachedSearchIndex from base class</name>
  <files>src/sources/free/pointfree.ts</files>
  <action>
`PointFreeSource` (pointfree.ts) reimplements patterns that already exist in `RssPatternSource`:
- Its own `private cachedSearch = new CachedSearchIndex<PointFreePattern>(...)` (line 120)
- Its own `searchPatterns` method (lines 218-221) that is identical to `RssPatternSource.searchPatterns`
- Its own cache check + invalidation pattern in `fetchPatterns` (lines 167-168, 213-214) that mirrors `RssPatternSource.fetchPatterns`

PointFreeSource can't easily extend RssPatternSource because it fetches from GitHub API rather than RSS feeds. However, the search layer duplication can be eliminated.

**Option A (preferred - minimal change):** Since PointFreeSource already uses `CachedSearchIndex` and has a `searchPatterns` identical to the base class, this duplication is small and acceptable. Instead, focus on removing the `path` import which is used only for `path.extname` and `path.basename` - these are trivial string operations. Also consolidate the duplicated `rssCache` and `articleCache` imports which appear in both rssPatternSource.ts and pointfree.ts (this is fine, they're shared instances).

Actually, on reflection, the duplication in PointFreeSource is structural (same pattern) but not copy-paste of significant logic. The `CachedSearchIndex` class is already the shared abstraction. The duplication is:
- 3 lines for `cachedSearch` field + `searchPatterns` method + `invalidate` call

This is minimal and acceptable. Do NOT force PointFreeSource to extend RssPatternSource -- the fetch mechanisms are fundamentally different (GitHub tree API vs RSS parser).

**Instead, focus on a real improvement in pointfree.ts:**

The `extractTitle` function (lines 91-108) duplicates heading extraction logic from `swift-analysis.ts::extractDescriptiveTitle` (lines 330-368). Both:
- Look for markdown H1 (`/^#\s+(.+)$/m`)
- Look for HTML H1
- Have fallback logic

Refactor:
1. Import `extractDescriptiveTitle` from `../../utils/swift-analysis.js`
2. Replace the body of `extractTitle` to:
   - First check for frontmatter title (PointFree-specific, keep this)
   - Then check for Swift title pattern `content.match(/title:\s*"([^"]+)"/)` (PointFree-specific, keep this)
   - Then delegate to `extractDescriptiveTitle(content, fallbackTitle)` for the H1/H2 extraction
   - Where `fallbackTitle` is the filename-based fallback: `path.basename(filePath, path.extname(filePath)).replace(/[-_]/g, ' ')`

This eliminates the duplicated markdown heading regex extraction while preserving PointFree-specific title sources (frontmatter and Swift string literals).
  </action>
  <verify>
Run `npm test` - all existing tests must pass. Verify pointfree.ts imports `extractDescriptiveTitle` from swift-analysis.ts. Verify the `extractTitle` function no longer has its own markdown H1 regex.
  </verify>
  <done>PointFreeSource title extraction uses shared extractDescriptiveTitle utility instead of duplicated regex. All tests pass.</done>
</task>

</tasks>

<verification>
After all tasks complete:
1. `npm test` passes with no failures
2. `npm run build` succeeds with no type errors
3. No behavioral changes - all tools produce identical output for identical inputs
</verification>

<success_criteria>
- FileCache uses InflightDeduper (eliminates ~15 lines of hand-rolled dedup)
- RssPatternSource has one processItem method instead of two (eliminates ~20 lines of duplication)
- Patreon handler uses shared formatter (eliminates ~15 lines of inline markdown)
- Sort comparator extracted to named function (eliminates 3 inline lambdas)
- PointFree title extraction uses shared utility (eliminates ~10 lines of duplicated regex)
- All tests pass, no behavioral changes
</success_criteria>

<output>
After completion, create `.planning/quick/005-review-improvements-reduce-redundancies/005-SUMMARY.md`
</output>
