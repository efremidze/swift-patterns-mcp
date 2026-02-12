---
phase: quick
plan: 004
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/004-review-test-adequacy-and-mcp-refactoring/004-REVIEW-REPORT.md
autonomous: true

must_haves:
  truths:
    - "Every source file is cataloged with its test coverage status (tested/untested/partial)"
    - "Test quality issues are identified with specific file/line references"
    - "MCP server refactoring opportunities are identified with severity and effort"
    - "Recommendations are prioritized by impact and grouped into actionable categories"
  artifacts:
    - path: ".planning/quick/004-review-test-adequacy-and-mcp-refactoring/004-REVIEW-REPORT.md"
      provides: "Comprehensive review report with findings and recommendations"
      min_lines: 200
  key_links: []
---

<objective>
Review all test files and MCP server source code to produce a comprehensive review report assessing test adequacy, coverage gaps, test quality, and MCP server refactoring opportunities.

Purpose: Provide a clear, prioritized assessment of what needs improvement in tests and server code, so future work can be planned with confidence.
Output: A single detailed REVIEW-REPORT.md with findings and actionable recommendations.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/codebase/TESTING.md
@.planning/codebase/ARCHITECTURE.md
@.planning/codebase/STRUCTURE.md
@.planning/codebase/CONVENTIONS.md
@.planning/codebase/CONCERNS.md
@.planning/codebase/STACK.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit Test Coverage and Quality</name>
  <files>.planning/quick/004-review-test-adequacy-and-mcp-refactoring/004-REVIEW-REPORT.md (partial — test sections)</files>
  <action>
Read every test file in the codebase and assess coverage, quality, and gaps. Produce findings for the report.

**Step 1 — Catalog coverage gaps.** Build a table mapping every source file to its test file(s). Mark each as: "tested", "untested", or "partial". Known untested files include:
- `src/index.ts` (server entry point — no tests)
- `src/cli/setup.ts`, `src/cli/patreon.ts`, `src/cli/sources.ts` (all CLI modules — no tests)
- `src/tools/extract-cookie.ts` (cookie extraction — no tests)
- `src/utils/fetch.ts`, `src/utils/http.ts` (HTTP utilities — no tests)
- `src/utils/errors.ts`, `src/utils/inflight-dedup.ts`, `src/utils/patreon-env.ts` (utilities — no tests)
- `src/utils/logger.ts`, `src/utils/paths.ts` (infrastructure — no tests, possibly acceptable)
- `src/sources/premium/patreon-oauth.ts`, `src/sources/premium/patreon-dl.ts`, `src/sources/premium/youtube.ts` (premium — no dedicated tests)
- `src/sources/premium/patreon.ts` (792 lines, only partially covered via patreon-integration.test.ts)

**Step 2 — Assess test quality.** Read each test file and evaluate:
- Are edge cases covered? (empty input, null, large input, error paths)
- Are mocks appropriate? (not over-mocking, not under-mocking)
- Is test isolation correct? (no shared mutable state between tests)
- Are assertions specific enough? (not just "toBeDefined" or "toBeTruthy")
- Are error paths tested? (not just happy paths)
- Is there test duplication or dead test code?

**Step 3 — Assess integration/e2e test quality.** Read:
- `src/integration/__tests__/mcp-client.test.ts` — Does it test real MCP protocol flows?
- `src/integration/__tests__/response-quality.test.ts` — What does it validate?
- `src/integration/__tests__/cache-behavior.test.ts` — Is cache behavior verified end-to-end?
- Are integration tests skipped in CI? If so, are they ever run?

**Step 4 — Run the test suite.** Execute `npm test` to check current pass/fail status and identify any broken tests.

Files to read (all test files):
- src/utils/__tests__/cache.test.ts
- src/utils/__tests__/search.test.ts
- src/utils/__tests__/search-terms.test.ts
- src/utils/__tests__/semantic-recall.test.ts
- src/utils/__tests__/swift-analysis.test.ts
- src/utils/__tests__/intent-cache.test.ts
- src/utils/__tests__/memvid-memory.test.ts
- src/utils/__tests__/pattern-formatter.test.ts
- src/utils/__tests__/response-helpers.test.ts
- src/utils/__tests__/source-registry.test.ts
- src/config/__tests__/sources.test.ts
- src/tools/__tests__/registry.test.ts
- src/tools/handlers/__tests__/handlers.test.ts
- src/tools/handlers/__tests__/getPatreonPatterns.test.ts
- src/sources/free/__tests__/sundell.test.ts
- src/sources/free/__tests__/vanderlee.test.ts
- src/sources/free/__tests__/nilcoalescing.test.ts
- src/sources/free/__tests__/pointfree.test.ts
- src/sources/free/__tests__/rssPatternSource.test.ts
- src/sources/premium/__tests__/patreon-integration.test.ts
- src/integration/__tests__/mcp-client.test.ts
- src/integration/__tests__/response-quality.test.ts
- src/integration/__tests__/cache-behavior.test.ts
  </action>
  <verify>All 23 test files have been read and analyzed. Coverage gap table is complete. Test quality findings documented.</verify>
  <done>Test coverage audit section complete with: (a) source-to-test mapping table, (b) per-file quality assessment, (c) missing edge case list, (d) integration test assessment, (e) test suite pass/fail status.</done>
</task>

<task type="auto">
  <name>Task 2: Audit MCP Server Code for Refactoring Opportunities</name>
  <files>.planning/quick/004-review-test-adequacy-and-mcp-refactoring/004-REVIEW-REPORT.md (partial — refactoring sections)</files>
  <action>
Read key MCP server source files and identify refactoring opportunities. Leverage findings from CONCERNS.md as a starting point but go deeper with fresh analysis.

**Step 1 — Review server entry point.** Read `src/index.ts` and evaluate:
- Is it doing too much? (server init, CLI routing, tool registration, startup logic)
- Are there separation-of-concerns violations?
- Is error handling adequate for a production MCP server?
- Is the tool registration pattern clean and extensible?

**Step 2 — Review tool handler layer.** Read all 6 handler files:
- `src/tools/handlers/getSwiftPattern.ts`
- `src/tools/handlers/searchSwiftContent.ts`
- `src/tools/handlers/getPatreonPatterns.ts`
- `src/tools/handlers/setupPatreon.ts`
- `src/tools/handlers/listContentSources.ts`
- `src/tools/handlers/enableSource.ts`
Also read: `src/tools/registry.ts`, `src/tools/types.ts`, `src/tools/extract-cookie.ts`

Evaluate:
- Code duplication between handlers (shared patterns that should be extracted)
- Input validation consistency (are all handlers validating inputs the same way?)
- Error handling patterns (consistent error responses?)
- Response formatting (duplicated formatting logic?)
- Handler complexity (any over 100 lines that should be split?)

**Step 3 — Review source layer.** Read:
- `src/sources/free/rssPatternSource.ts` (base class)
- `src/sources/premium/patreon.ts` (792 lines — biggest file, likely needs splitting)
- `src/sources/premium/youtube.ts` (module-level state concerns)
- `src/sources/premium/patreon-dl.ts` (duplication concerns)
- `src/sources/premium/patreon-oauth.ts` (security concerns)

Evaluate:
- Is the base class pattern (RssPatternSource) well-designed?
- Is patreon.ts too large? What can be extracted?
- Are there DRY violations?
- Is the scoring/ranking logic testable?

**Step 4 — Review utility layer.** Read key utilities:
- `src/utils/cache.ts` (cache key collision risk)
- `src/utils/source-registry.ts` (singleton pattern)
- `src/utils/semantic-recall.ts` (embedding integration)
- `src/utils/intent-cache.ts` (query caching)
- `src/utils/inflight-dedup.ts` (request coalescing)

Evaluate:
- Are there any God objects or over-coupled modules?
- Is the caching strategy coherent or fragmented?
- Are there testability barriers (singletons, module-level state)?
  </action>
  <verify>All listed source files have been read. Refactoring opportunities documented with file references, severity, and effort estimates.</verify>
  <done>MCP server refactoring section complete with: (a) entry point assessment, (b) handler layer findings, (c) source layer findings, (d) utility layer findings, (e) cross-cutting architectural observations.</done>
</task>

<task type="auto">
  <name>Task 3: Compile and Write the Review Report</name>
  <files>.planning/quick/004-review-test-adequacy-and-mcp-refactoring/004-REVIEW-REPORT.md</files>
  <action>
Compile findings from Tasks 1 and 2 into a single comprehensive report at `.planning/quick/004-review-test-adequacy-and-mcp-refactoring/004-REVIEW-REPORT.md`.

**Report structure:**

```markdown
# Review Report: Test Adequacy and MCP Server Refactoring
**Date:** {date}
**Scope:** All test files, all MCP server source files

## Executive Summary
- [3-5 bullet overview of key findings]
- [Overall health assessment: tests, architecture, code quality]

## Part 1: Test Adequacy Review

### 1.1 Coverage Map
[Table: source file | test file | status (tested/untested/partial) | notes]

### 1.2 Coverage Gaps (Priority Ordered)
[For each untested file: what's missing, risk level, recommended test type]

### 1.3 Test Quality Assessment
[Per test file: quality grade (A-D), specific issues found, edge cases missing]

### 1.4 Integration & E2E Test Assessment
[Findings from integration tests, CI skip concerns, real protocol coverage]

### 1.5 Test Infrastructure Issues
[Coverage tooling, CI pipeline, test isolation concerns]

## Part 2: MCP Server Refactoring Review

### 2.1 Entry Point (index.ts)
[Findings: responsibilities, separation of concerns, extensibility]

### 2.2 Handler Layer
[Findings: duplication, validation patterns, error handling consistency]

### 2.3 Source Layer
[Findings: base class design, patreon.ts complexity, DRY violations]

### 2.4 Utility Layer
[Findings: caching coherence, testability barriers, module-level state]

### 2.5 Cross-Cutting Concerns
[Architecture patterns, dependency management, error propagation]

## Part 3: Prioritized Recommendations

### Critical (Do First)
[Items that affect correctness, security, or prevent testing]

### High Priority (Do Soon)
[Items that significantly improve maintainability or test confidence]

### Medium Priority (Plan For)
[Items that improve code quality but aren't blocking]

### Low Priority (Nice to Have)
[Cleanup items, style improvements, documentation]

## Appendix: File Inventory
[Complete list of all source files with line counts and test status]
```

Each recommendation must include:
- What: specific change
- Why: concrete problem it solves
- Where: exact file(s) affected
- Effort: S (< 1hr), M (1-4hr), L (4hr+)
- Impact: correctness, maintainability, testability, security
  </action>
  <verify>Report file exists at the expected path. Report has all sections filled with specific findings (not placeholder text). Recommendations are prioritized. Line count > 200.</verify>
  <done>Complete review report written with specific findings, file references, and prioritized actionable recommendations.</done>
</task>

</tasks>

<verification>
- [ ] All 23 test files read and analyzed
- [ ] All key source files (handlers, sources, utils, index.ts) read and analyzed
- [ ] `npm test` executed to verify current test suite status
- [ ] Coverage map table is complete (every source file mapped)
- [ ] Each finding references specific files and line numbers where possible
- [ ] Recommendations are prioritized (Critical/High/Medium/Low)
- [ ] Report is self-contained and actionable without needing to re-read source
</verification>

<success_criteria>
Report exists at `.planning/quick/004-review-test-adequacy-and-mcp-refactoring/004-REVIEW-REPORT.md` with:
1. Complete source-to-test coverage map
2. Specific test quality findings with file references
3. MCP server refactoring opportunities with severity ratings
4. Prioritized recommendations with effort estimates
5. Minimum 200 lines of substantive content
</success_criteria>

<output>
After completion, create `.planning/quick/004-review-test-adequacy-and-mcp-refactoring/004-SUMMARY.md`
</output>
