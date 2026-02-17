---
phase: quick
plan: "005"
subsystem: core-utils, sources, handlers
tags: [refactoring, deduplication, consolidation]
dependency_graph:
  requires: []
  provides:
    - FileCache using InflightDeduper instead of inline Map dedup
    - Consolidated RssPatternSource.processItem method
    - Patreon handler using shared pattern-formatter utilities
    - Named sort comparator in searchSwiftContent
    - PointFreeSource title extraction using shared extractDescriptiveTitle
  affects:
    - src/utils/cache.ts
    - src/sources/free/rssPatternSource.ts
    - src/tools/handlers/getPatreonPatterns.ts
    - src/tools/handlers/searchSwiftContent.ts
    - src/sources/free/pointfree.ts
tech_stack:
  added: []
  patterns:
    - InflightDeduper for in-flight promise deduplication
    - Single processItem replacing dual processRssItem/processArticle
    - Named sort comparator function pattern
    - Shared formatter delegation with creator attribution via excerpt prefix
key_files:
  created: []
  modified:
    - src/utils/cache.ts
    - src/sources/free/rssPatternSource.ts
    - src/tools/handlers/getPatreonPatterns.ts
    - src/tools/handlers/searchSwiftContent.ts
    - src/sources/free/pointfree.ts
decisions:
  - Creator attribution in Patreon handler preserved via excerpt prefix rather than separate field
  - PointFreeSource not forced to extend RssPatternSource due to fundamentally different fetch mechanism
  - Swift title literal check kept before extractDescriptiveTitle delegation in pointfree.ts
metrics:
  duration: "9 min"
  completed: "2026-02-17"
  tasks_completed: 3
  files_modified: 5
---

# Quick Task 005: Review Improvements - Reduce Redundancies Summary

**One-liner:** Eliminated ~50 lines of duplicate logic across five files by wiring FileCache to InflightDeduper, merging RssPatternSource's dual processItem methods, consolidating Patreon's inline formatter, extracting a named sort comparator, and delegating PointFree title extraction to shared extractDescriptiveTitle.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | FileCache InflightDeduper + RssPatternSource consolidation | da43130 | cache.ts, rssPatternSource.ts |
| 2 | Patreon shared formatter + sort comparator extraction | 4dac1e7 | getPatreonPatterns.ts, searchSwiftContent.ts |
| 3 | PointFreeSource shared extractDescriptiveTitle | 2035ef1 | pointfree.ts |

## Changes Made

### Task 1: FileCache + RssPatternSource

**cache.ts:**
- Added `import { InflightDeduper } from './inflight-dedup.js'`
- Replaced `private inFlightFetches: Map<string, Promise<unknown>> = new Map()` with `private inFlightFetches = new InflightDeduper<string, unknown>()`
- Rewrote `getOrFetch()` to use `this.inFlightFetches.run(key, ...)` - eliminates manual get/set/finally/delete pattern

**rssPatternSource.ts:**
- Merged `processRssItem` and `processArticle` into a single `protected async processItem(item)` method
- `processItem` conditionally fetches full article content when `this.options.fetchFullArticle && url` (same logic, fewer code paths)
- `fetchPatterns` now calls `this.processItem(item)` unconditionally (no ternary)
- Removed the `fetchFullArticle` variable from the `fetchPatterns` destructure

### Task 2: Patreon Handler + Sort Comparator

**getPatreonPatterns.ts:**
- Added imports for `formatTopicPatterns`, `COMMON_FORMAT_OPTIONS` from pattern-formatter, and `BasePattern` type
- Replaced 14-line inline markdown template block with `formatTopicPatterns()` call
- Creator attribution preserved by prepending `By ${p.creator} | ` to each pattern's excerpt before passing to shared formatter

**searchSwiftContent.ts:**
- Added `byRelevanceDesc(a, b)` named comparator function at module scope
- Replaced all three `.sort((a, b) => b.relevanceScore - a.relevanceScore)` calls with `.sort(byRelevanceDesc)`

### Task 3: PointFreeSource Title Extraction

**pointfree.ts:**
- Added `extractDescriptiveTitle` to swift-analysis imports
- Refactored `extractTitle` to: frontmatter → Swift literal → `extractDescriptiveTitle(content, fallbackTitle)`
- Removed duplicated markdown H1 regex (`/^#\s+(.+)$/m`) now handled by shared utility
- `extractDescriptiveTitle` additionally handles HTML H1, H2, HTML H2 that the old code didn't cover

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Creator field not shown in Patreon output after formatter switch**
- **Found during:** Task 2 (test failure)
- **Issue:** Test `expect(text).toContain('Kavsoft')` failed because shared formatter has no `creator` field
- **Fix:** Prepend `By ${p.creator} | ` to each pattern's excerpt before passing to `formatTopicPatterns`, preserving creator visibility
- **Files modified:** src/tools/handlers/getPatreonPatterns.ts
- **Commit:** 4dac1e7 (fix incorporated in same commit)

## Self-Check: PASSED

All modified files exist. All three commits verified in git log. 384/384 tests pass. Build succeeds with no type errors.

## Verification Results

- `npm test`: 384/384 tests passed across 29 test files
- `npm run build`: clean build, no TypeScript errors
- `grep "inFlightFetches" cache.ts`: shows InflightDeduper type only
- `grep "processRssItem\|processArticle" rssPatternSource.ts`: no matches (eliminated)
- `grep "extractDescriptiveTitle" pointfree.ts`: import and usage confirmed
- `grep "byRelevanceDesc" searchSwiftContent.ts`: named comparator used in all 3 sort calls
