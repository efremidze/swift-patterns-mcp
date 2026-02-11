# Roadmap: Swift Patterns MCP — Security, Quality & Architecture

## Overview

This milestone hardens the MCP server against security vulnerabilities and known bugs, then refactors architecture for testability and adds comprehensive test coverage. Phases 1-2 fix critical security/bugs, Phase 3 decomposes monolithic files, Phase 4 adds test coverage for critical paths, and Phase 5 establishes sustainable test infrastructure with security hardening.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3...): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Command Injection Elimination** - Replace shell interpolation with safe execution
- [x] **Phase 2: Bug Fixes** - Fix memvid scoring, YouTube parsing, code detection
- [ ] **Phase 3: Architecture Refactoring** - Decompose monolithic files, eliminate anti-patterns
- [ ] **Phase 4: Test Coverage** - Critical/high-priority test coverage, fix failing tests, enable CI
- [ ] **Phase 5: Test Infrastructure & Hardening** - Coverage tools, fixtures, error paths, security, benchmarks

## Phase Details

### Phase 1: Command Injection Elimination
**Goal**: Shell commands execute safely without injection risk
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-03
**Success Criteria** (what must be TRUE):
  1. Patreon OAuth flow uses execFile with argument arrays instead of shell interpolation
  2. Patreon download tool uses execFile with argument arrays instead of shell interpolation
  3. Cookie values are validated for format compliance before being passed to any subprocess
  4. Attempting to inject shell metacharacters via cookies or OAuth parameters fails safely
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — Replace exec with execFile and add cookie format validation

### Phase 2: Bug Fixes
**Goal**: Search scoring, metadata parsing, and code detection work correctly
**Depends on**: Phase 1 (sequential execution, though logically independent)
**Requirements**: BUG-01, BUG-02, BUG-03
**Success Criteria** (what must be TRUE):
  1. Memvid relevance scores display in 0-100 range matching user expectations
  2. YouTube videos with missing snippet fields (channelId, channelTitle) are parsed without crashes
  3. Code detection correctly identifies Swift code blocks beyond single-line heuristics
  4. Search results with memvid context show accurate relevance percentages
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md — Fix memvid scoring, YouTube parsing, and code detection

### Phase 3: Architecture Refactoring
**Goal**: Server code is modular and testable with monolithic files decomposed
**Depends on**: Phase 2 (refactoring stable, correct code)
**Recommendations**: C3, C4, C5, H3 (from 004-REVIEW-REPORT)
**Success Criteria** (what must be TRUE):
  1. `src/index.ts` is < 60 lines, delegating to `src/cli/router.ts`, `src/server.ts`, `src/tools/registration.ts`
  2. `src/sources/premium/patreon.ts` is < 300 lines, delegating to scoring, dedup, enrichment, query-analysis modules
  3. YouTube module (`src/sources/premium/youtube.ts`) has zero module-level mutable state
  4. `src/tools/validation.ts` exists and all 6 handlers use it for consistent argument validation
  5. All existing tests pass without modification (backward compatibility maintained)
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Entry point decomposition (CLI router, server module, tool registration, shared validation)
- [ ] 03-02-PLAN.md — Patreon source decomposition & YouTube state fix

### Phase 4: Test Coverage
**Goal**: Critical paths have test coverage and all tests pass in CI
**Depends on**: Phase 3 (refactored modules are easier to test)
**Recommendations**: C1, C2, H1, H2, H4, H5, H6, M4 (from 004-REVIEW-REPORT)
**Success Criteria** (what must be TRUE):
  1. OAuth flow has integration tests with mock provider (8+ test cases)
  2. Server startup tests verify tool registration and error handling (6+ test cases)
  3. Patreon download tests cover file extraction, post matching, error paths (10+ test cases)
  4. Setup wizard tests verify config writing and path validation (8+ test cases)
  5. Zero failing YouTube tests (3 previously-failing tests fixed via mocked fixtures)
  6. Patreon scoring/dedup have dedicated test files (15+ test cases each)
  7. Integration tests run in CI without keytar dependency (mocked)
  8. Cookie extraction has injection security tests (5+ test cases)
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — Critical path testing (OAuth, server startup, Patreon download, cookie extraction)
- [ ] 04-02-PLAN.md — Premium logic testing (scoring, dedup, query analysis, setup wizard)
- [ ] 04-03-PLAN.md — Test infrastructure fixes (YouTube mock fixtures, CI integration tests)

### Phase 5: Test Infrastructure & Hardening
**Goal**: Sustainable test infrastructure with coverage metrics, security hardening, and performance baselines
**Depends on**: Phase 4 (infrastructure most valuable when comprehensive tests exist)
**Recommendations**: M1-M3, M5-M8, L1-L5 (from 004-REVIEW-REPORT)
**Success Criteria** (what must be TRUE):
  1. `@vitest/coverage-v8` configured with thresholds enforced in CI
  2. HTTP utilities and inflight dedup have unit tests (10+ test cases each)
  3. Shared test fixtures in `src/__tests__/fixtures/` used by 5+ test files
  4. Error path tests added to all free source tests (3+ error cases per source)
  5. OAuth uses state parameter and PKCE for security
  6. Cache observability tracks hit/miss rates for intent cache and file cache
  7. Performance benchmark baseline for 5 common queries (< 500ms target)
  8. Load tests verify 10 concurrent requests without degradation
  9. Handler test harness reduces boilerplate
  10. ESLint rules enforce test quality
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md — Test infrastructure & quality tools (coverage, fixtures, harness, linter rules)
- [ ] 05-02-PLAN.md — Network & concurrency testing (HTTP utils, inflight dedup, error paths, infrastructure modules)
- [ ] 05-03-PLAN.md — Hardening & observability (OAuth security, cache metrics, benchmarks, load tests)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Command Injection Elimination | 1/1 | Complete | 2026-01-29 |
| 2. Bug Fixes | 1/1 | Complete | 2026-01-30 |
| 3. Architecture Refactoring | 0/2 | Not started | - |
| 4. Test Coverage | 0/3 | Not started | - |
| 5. Test Infrastructure & Hardening | 0/3 | Not started | - |

---
*Roadmap created: 2026-01-29*
*Last updated: 2026-02-10 — Replaced Phase 3 with Phases 3-5 based on 004-REVIEW-REPORT findings*
