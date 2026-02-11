# Swift Patterns MCP — Security, Quality & Architecture Milestone

## What This Is

An MCP server that provides Swift/iOS development patterns from multiple content sources (RSS feeds, Patreon, YouTube) to AI assistants via the Model Context Protocol. This milestone addresses security vulnerabilities, known bugs, architectural debt, and test coverage gaps identified in the codebase audit and 004-REVIEW-REPORT.

## Core Value

Fix security vulnerabilities and bugs, refactor architecture for maintainability, and establish comprehensive test coverage.

## Requirements

### Validated

- ✓ MCP server serves Swift patterns via stdio transport — existing
- ✓ Free sources (Sundell, van der Lee, Nil Coalescing, Point-Free) deliver patterns via RSS — existing
- ✓ Premium Patreon source with OAuth 2.0 authentication — existing
- ✓ YouTube API integration for creator video discovery — existing
- ✓ Full-text search with stemming via MiniSearch — existing
- ✓ Semantic recall via transformer embeddings as search fallback — existing
- ✓ Persistent cross-session memory via memvid — existing
- ✓ Intent-aware caching with query normalization — existing
- ✓ Hybrid memory+disk file cache with TTL — existing

### Active (Phase 4: Test Coverage)

- [ ] OAuth flow integration tests with mock provider (C1)
- [ ] Server startup and tool registration tests (C2)
- [ ] Patreon download tests — file extraction, post matching, error paths (H1)
- [ ] Setup wizard tests — config writing, path validation (H2)
- [ ] Fix 3 failing YouTube tests via mocked API fixtures (H4)
- [ ] Patreon scoring/dedup module tests (H5)
- [ ] Integration tests enabled in CI — keytar mocked (H6)
- [ ] Cookie extraction injection security tests (M4)
- [ ] Tool handler input validation via Zod schemas (original HARD-01)

### Future (Phase 5: Test Infrastructure & Hardening)

- [ ] Code coverage tool (`@vitest/coverage-v8`) with thresholds enforced in CI (M1)
- [ ] HTTP utilities and inflight dedup tested (M2, M3)
- [ ] Shared test fixtures in `src/__tests__/fixtures/` (M5)
- [ ] Error path tests for all free sources (M6)
- [ ] OAuth security hardened — state parameter, PKCE (M7)
- [ ] Cache observability metrics — hit/miss rates (M8)
- [ ] Performance benchmarks and load tests (L2, L3)
- [ ] Infrastructure module tests, handler harness, linter rules (L1, L4, L5)

### Completed (Phases 1-2)

- [x] Shell command injection eliminated in Patreon OAuth and download tools (Phase 1)
- [x] Sensitive data stripped from error messages before logging (Phase 1)
- [x] Cookie injection attack surface closed in Patreon download (Phase 1)
- [x] Memvid relevance score scaling fixed 0-1 → 0-100 correctly (Phase 2)
- [x] YouTube metadata parsing handles missing snippet fields without crashing (Phase 2)
- [x] Code detection improved beyond brittle regex (Phase 2)
- [x] Entry point refactored to 16 lines delegating to cli/router, server, tools/registration (Phase 3, C3)
- [x] Patreon source split into 293-line orchestrator with scoring, dedup, enrichment, query-analysis modules (Phase 3, C4)
- [x] YouTube module-level mutable state eliminated (Phase 3, C5)
- [x] Shared validation utility used by 5 handlers (Phase 3, H3)

### Out of Scope

- Performance bottlenecks (semantic model lazy-loading, directory traversal, memvid indexing) — separate milestone
- Scaling limits (cache size, memory GC, rate limiting) — separate milestone
- Observability/metrics — separate milestone
- Fragile area hardening beyond what's needed for security/bug fixes — separate milestone
- Test coverage for areas unrelated to security/bugs — separate milestone

## Context

- Brownfield TypeScript/Node.js project, published to npm as `swift-patterns-mcp`
- Codebase mapped in `.planning/codebase/` with 7 analysis documents
- Concerns identified in `.planning/codebase/CONCERNS.md` — this milestone addresses Security Considerations, Known Bugs, and Missing Input Validation sections
- Existing test infrastructure: Vitest with colocated `__tests__/` directories
- ESLint with TypeScript strict rules already configured
- Zod already a dependency (used in config validation) — can extend to tool input validation

## Constraints

- **Backward compatibility**: Fixes must not change MCP tool interfaces or break existing Claude/Cursor integrations
- **Existing patterns**: Follow established error handling conventions (logError, toErrorMessage, createErrorResponseFromError)
- **Dependencies**: Prefer using existing deps (Zod, undici) over adding new ones

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use execFile over exec for shell commands | Prevents injection by avoiding shell interpolation | — Pending |
| Zod for tool input validation | Already a dependency, type-safe, standard approach | — Pending |
| Warn (not crash) when keytar unavailable | Graceful degradation is existing pattern | — Pending |

---
*Last updated: 2026-02-10 — Phase 3 completed*
