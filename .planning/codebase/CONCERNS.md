# Codebase Concerns

**Analysis Date:** 2026-01-16

## Tech Debt

**Large Monolithic Server File:**
- Issue: `src/index.ts` (515 lines) handles all tool definitions and implementations
- Files: `src/index.ts`
- Why: Rapid development, all MCP tools in one place
- Impact: Hard to test individual tools, difficult to add new tools cleanly
- Fix approach: Extract tool handlers to `src/tools/handlers/` or use a factory pattern

**Type Safety in Dynamic Imports:**
- Issue: Uses `any` type for conditionally loaded PatreonSource module
- Files: `src/index.ts` (lines 20-26)
- Why: Dynamic import for graceful degradation when premium modules unavailable
- Impact: Loses TypeScript safety, runtime checks required
- Fix approach: Define shared interface, use proper type guards after import

**Inconsistent Error Handling:**
- Issue: Some modules log errors, others silently return empty arrays
- Files: `src/sources/free/rssPatternSource.ts`, `src/utils/cache.ts`, `src/sources/premium/youtube.ts`
- Why: Evolved over time with different patterns
- Impact: Debugging difficult, errors may go unnoticed
- Fix approach: Establish consistent error handling strategy (log + graceful degradation)

## Known Bugs

**No Critical Bugs Identified**

The codebase is relatively clean. Minor issues noted in tech debt section.

## Security Considerations

**Shell Command Injection Risk:**
- Risk: User-controlled data passed to `exec()` in OAuth flow
- Files: `src/sources/premium/patreon-oauth.ts` (line ~214)
- Code: `exec(\`${cmd} "${authUrl.toString()}"\`)`
- Current mitigation: URL is programmatically constructed, not directly user-supplied
- Recommendations: Use array-based arguments or `execFile()` instead of string interpolation

**Missing Input Validation:**
- Risk: YouTube channel IDs used without format validation
- Files: `src/sources/premium/youtube.ts` (lines 40, 65, 122)
- Current mitigation: `encodeURIComponent()` used for query params
- Recommendations: Validate channel ID format before API call

**Sensitive Data in Environment:**
- Risk: API keys stored in `.env` file
- Files: `.env` (if present), `.env.example` (template)
- Current mitigation: `.env` should be in `.gitignore`
- Recommendations: Verify `.env` is not committed, consider using secret management

## Performance Bottlenecks

**N+1 Pattern in Creator Scanning:**
- Problem: `getByPatreonId()` called multiple times per post in loop
- Files: `src/sources/premium/patreon.ts` (lines 225-240)
- Cause: Creator lookup performed inside iteration over posts
- Improvement path: Pre-map creator IDs outside the loop

**String Concatenation in Search:**
- Problem: Full text concatenation happens for every search result
- Files: `src/utils/search.ts` (lines 170, 216)
- Code: `const searchText = \`${doc.title} ${doc.content} ${doc.topics.join(' ')}\`.toLowerCase()`
- Improvement path: Cache normalized content during indexing

## Fragile Areas

**MCP Tool Handler Switch:**
- Files: `src/index.ts` (lines ~180-500)
- Why fragile: Single large switch statement handles all 10+ tools
- Common failures: Adding new tool requires modifying multiple places
- Safe modification: Follow existing pattern, add tests before changes
- Test coverage: No tests for MCP handlers

**OAuth Token Flow:**
- Files: `src/sources/premium/patreon-oauth.ts`
- Why fragile: Complex state machine (local server, redirect, token exchange)
- Common failures: Token refresh edge cases, redirect URI mismatch
- Safe modification: Test OAuth flow manually after changes
- Test coverage: No automated tests

## Scaling Limits

**In-Memory Cache:**
- Current capacity: Limited by Node.js heap
- Limit: Large RSS feeds or many cached articles could exhaust memory
- Symptoms at limit: Slow performance, potential OOM errors
- Scaling path: Use LRU cache with size limits, or move to external cache

**Single-Threaded Processing:**
- Current capacity: Sequential processing of sources
- Limit: Many sources would slow down response times
- Scaling path: Use Promise.all for parallel source fetching (already partially done)

## Dependencies at Risk

**keytar Package:**
- Risk: Native Node module, requires rebuild on Node version changes
- Impact: Auth tokens inaccessible if module fails to load
- Migration plan: Consider alternative like encrypted file storage

**Playwright:**
- Risk: Large dependency (browsers), breaks with Chrome updates
- Impact: Cookie extraction fails, Patreon auth affected
- Migration plan: Only used for initial setup, acceptable trade-off

## Missing Critical Features

**No Structured Logging:**
- Problem: Console.log/error only, no log levels or structured output
- Current workaround: Manual grep through console output
- Blocks: Production monitoring, debugging in deployed environments
- Implementation complexity: Low (add pino or winston)

**No Test Coverage Reporting:**
- Problem: No visibility into which code is tested
- Current workaround: Manual review of test files
- Blocks: Confidence in changes, identifying test gaps
- Implementation complexity: Low (add vitest coverage config)

## Test Coverage Gaps

**CLI Commands:**
- What's not tested: `src/cli/setup.ts`, `src/cli/auth.ts`, `src/cli/source-manager.ts`
- Risk: CLI bugs go unnoticed until user reports
- Priority: Medium
- Difficulty to test: Medium (need to mock readline/stdin)

**Utility Functions:**
- What's not tested: `src/utils/cache.ts`, `src/utils/search.ts`, `src/utils/swift-analysis.ts`
- Risk: Core analysis logic could break silently
- Priority: High
- Difficulty to test: Low (pure functions, easy to unit test)

**Premium Sources:**
- What's not tested: Entire `src/sources/premium/` directory
- Risk: Patreon/YouTube integration could break
- Priority: Medium
- Difficulty to test: High (requires mocking OAuth, external APIs)

**MCP Server:**
- What's not tested: Tool handlers in `src/index.ts`
- Risk: Breaking changes to MCP responses
- Priority: High
- Difficulty to test: Medium (need MCP client mock)

## Positive Notes

The codebase is well-organized with clear separation of concerns:
- Clean abstraction with `RssPatternSource` base class
- Sensible directory structure
- TypeScript strict mode enabled
- Recent commits show active code quality improvements

---

*Concerns audit: 2026-01-16*
*Update as issues are fixed or new ones discovered*
