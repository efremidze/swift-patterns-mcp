# Roadmap: swift-patterns-mcp Improvements

## Overview

Improve swift-patterns-mcp from working prototype to production-ready MCP server. Focus on reliability (error handling, OAuth), maintainability (tests, refactoring), and usability (better responses).

## Domain Expertise

None (TypeScript/Node.js project, standard patterns)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation & Error Handling** - Consistent error handling, structured logging
- [ ] **Phase 2: Test Infrastructure** - Test coverage for utilities and core logic
- [~] **Phase 3: MCP Tool Refactoring** - Extract handlers from monolithic index.ts (IN PROGRESS)
- [ ] **Phase 4: Patreon OAuth Hardening** - Robust OAuth flow, token refresh edge cases
- [ ] **Phase 5: Search & Response Quality** - Better MCP responses, improved search
- [ ] **Phase 6: Premium Source Testing** - Test coverage for Patreon/YouTube

## Phase Details

### Phase 1: Foundation & Error Handling ✓
**Goal**: Establish consistent error handling strategy and add structured logging
**Depends on**: Nothing (first phase)
**Research**: Unlikely (internal patterns, standard logging libraries)
**Plans**: 1 (complete)

Completed:
- Created `src/utils/errors.ts` with logError, toErrorMessage, isError utilities
- Applied consistent error handling to `src/utils/cache.ts`
- Applied consistent error handling to `src/sources/free/rssPatternSource.ts`
- Applied consistent error handling to `src/sources/premium/youtube.ts`
- Pattern: logError(context, error, details) + graceful degradation
- Note: Logging library deferred - using console.error with structured context

### Phase 2: Test Infrastructure
**Goal**: Add test coverage for utilities and core analysis logic
**Depends on**: Phase 1
**Research**: Unlikely (standard vitest patterns)
**Plans**: TBD

Key work:
- Tests for `src/utils/cache.ts`
- Tests for `src/utils/search.ts`
- Tests for `src/utils/swift-analysis.ts`
- Add coverage reporting to vitest config

### Phase 3: MCP Tool Refactoring (IN PROGRESS)
**Goal**: Extract tool handlers from monolithic 515-line index.ts
**Depends on**: Phase 2
**Research**: Unlikely (internal refactoring)
**Plans**: 1 (in progress)

Progress:
- [x] Plan 01: Handler registry structure and core handler extraction
  - Created `src/tools/types.ts`, `src/tools/registry.ts`, `src/tools/index.ts`
  - Extracted 4 core handlers to `src/tools/handlers/`
  - Reduced index.ts from 515 to 330 lines (36% reduction)
  - Fixed `any[]` to `BasePattern[]` in handlers

Remaining work:
- Consider extracting Patreon handlers (requires refactoring dynamic import pattern)
- Consider extracting tool definitions to separate module

### Phase 4: Patreon OAuth Hardening
**Goal**: Make OAuth flow robust and handle edge cases
**Depends on**: Phase 3
**Research**: Likely (OAuth 2.0 best practices)
**Research topics**: OAuth refresh token patterns, error recovery, token expiry handling
**Plans**: TBD

Key work:
- Fix shell command injection risk in `patreon-oauth.ts`
- Improve token refresh error handling
- Handle redirect URI mismatch edge cases
- Better error messages for OAuth failures

### Phase 5: Search & Response Quality
**Goal**: Improve MCP tool response quality and search relevance
**Depends on**: Phase 4
**Research**: Likely (MCP response patterns)
**Research topics**: MCP response best practices, MiniSearch optimization, response formatting
**Plans**: TBD

Key work:
- Optimize string concatenation in search (cache normalized content)
- Better structured responses from MCP tools
- Fix N+1 pattern in creator scanning
- Improve search result relevance

### Phase 6: Premium Source Testing
**Goal**: Add test coverage for Patreon and YouTube integrations
**Depends on**: Phase 5
**Research**: Unlikely (mocking patterns)
**Plans**: TBD

Key work:
- Mock OAuth flow for testing
- Mock Patreon API responses
- Mock YouTube API responses
- Integration test patterns for external services

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Error Handling | 1/1 | Complete | 2026-01-16 |
| 2. Test Infrastructure | 0/TBD | Not started | - |
| 3. MCP Tool Refactoring | 1/TBD | In progress | - |
| 4. Patreon OAuth Hardening | 0/TBD | Not started | - |
| 5. Search & Response Quality | 0/TBD | Not started | - |
| 6. Premium Source Testing | 0/TBD | Not started | - |

---

*Roadmap created: 2026-01-16*
