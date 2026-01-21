---
phase: quick-001
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/integration/cache-behavior.test.ts
autonomous: true

must_haves:
  truths:
    - "Repeated identical queries return cached results"
    - "Cache metrics accurately track hits/misses"
    - "Different query parameters produce cache misses"
    - "Cache behavior works correctly across handler types"
  artifacts:
    - path: "src/integration/cache-behavior.test.ts"
      provides: "Integration tests for caching behavior and performance"
      min_lines: 100
  key_links:
    - from: "src/integration/cache-behavior.test.ts"
      to: "src/utils/intent-cache.ts"
      via: "intentCache import"
      pattern: "import.*intentCache"
---

<objective>
Add integration tests for IntentCache behavior and performance metrics

Purpose: Verify cache works correctly in realistic handler scenarios (not just unit tests with mocks)
Output: New test file `src/integration/cache-behavior.test.ts` with cache behavior tests
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/utils/intent-cache.ts
@src/tools/handlers/getSwiftPattern.ts
@src/tools/handlers/searchSwiftContent.ts
@src/integration/mcp-client.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create cache behavior integration tests</name>
  <files>src/integration/cache-behavior.test.ts</files>
  <action>
Create new test file `src/integration/cache-behavior.test.ts` with integration tests for caching:

1. **Test setup:**
   - Import `intentCache` from `../../utils/intent-cache.js`
   - Import handlers: `getSwiftPatternHandler`, `searchSwiftContentHandler`
   - Create mock context similar to handlers.test.ts
   - Clear cache in `beforeEach` to isolate tests
   - Use same MOCK_PATTERNS fixtures as handlers.test.ts

2. **Cache hit/miss tests:**
   - Test: First call is cache miss, second identical call is cache hit
   - Test: Different topics produce cache misses
   - Test: Different minQuality produces cache misses
   - Test: Different requireCode produces cache misses
   - Test: Cache persists across handler calls with same intent

3. **Cache metrics tests:**
   - Test: `getStats()` returns 0/0 initially
   - Test: Cache miss increments miss count
   - Test: Cache hit increments hit count
   - Test: Hit rate calculated correctly (e.g., 2 hits / 4 total = 0.5)
   - Test: `clear()` resets metrics

4. **Cross-handler cache isolation:**
   - Test: `get_swift_pattern` and `search_swift_content` use separate cache keys
   - Test: Same query on different handlers = separate cache entries

5. **Performance validation:**
   - Test: Cached call faster than uncached (use `performance.now()`)
   - Skip in CI environment (like mcp-client.test.ts does)

Use `describe.skip` or conditional skip for tests requiring real server.
Follow existing test patterns in `handlers.test.ts` for mocking.
  </action>
  <verify>
Run `npm test src/integration/cache-behavior.test.ts` - all tests pass
Run `npm test` - full suite passes including new tests
  </verify>
  <done>
New test file exists with 10+ tests covering:
- Cache hit/miss behavior (4+ tests)
- Cache metrics accuracy (4+ tests)
- Cross-handler isolation (2+ tests)
All tests pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Add cache stampede integration test</name>
  <files>src/integration/cache-behavior.test.ts</files>
  <action>
Add to the existing test file a test block for cache stampede prevention:

1. **Stampede prevention test:**
   - Call `intentCache.getOrFetch()` with same intent 5 times concurrently
   - Use a slow fetcher (50ms delay) to ensure overlap
   - Track fetch count - should only be 1
   - All 5 promises should resolve to same result

2. **Stampede with different intents:**
   - Call `getOrFetch()` with 3 different intents concurrently
   - Each intent should trigger its own fetch (3 total)
   - No cross-contamination of results

This validates the in-flight deduplication works at the integration level,
not just in unit tests.
  </action>
  <verify>
Run `npm test src/integration/cache-behavior.test.ts` - stampede tests pass
  </verify>
  <done>
Stampede prevention tests added (2+ tests)
Tests verify single fetch for concurrent identical requests
Tests verify separate fetches for different intents
  </done>
</task>

</tasks>

<verification>
```bash
# Run the new integration tests
npm test src/integration/cache-behavior.test.ts

# Run full test suite to ensure no regressions
npm test

# Verify test count increased
npm test 2>&1 | grep -E "Tests.*passed"
```
</verification>

<success_criteria>
- New file `src/integration/cache-behavior.test.ts` exists
- At least 12 new tests covering cache behavior
- All new tests pass
- Full test suite still passes (56+ tests total)
- Cache metrics tests validate hit/miss/hitRate accuracy
- Stampede prevention validated at integration level
</success_criteria>

<output>
After completion, create `.planning/quick/001-improve-integration-tests-i-want-to-cove/001-SUMMARY.md`
</output>
