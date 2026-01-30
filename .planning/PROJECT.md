# Swift Patterns MCP — Security & Bug Fix Milestone

## What This Is

An MCP server that provides Swift/iOS development patterns from multiple content sources (RSS feeds, Patreon, YouTube) to AI assistants via the Model Context Protocol. This milestone addresses security vulnerabilities, known bugs, and input validation gaps identified in the codebase audit.

## Core Value

Fix security vulnerabilities and bugs so the server is safe to run and returns correct results.

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

### Active

- [ ] Shell command injection eliminated in Patreon OAuth and download tools
- [ ] Sensitive data stripped from error messages before logging
- [ ] Cookie injection attack surface closed in Patreon download
- [ ] OAuth token storage warns when keytar unavailable instead of silent failure
- [ ] Environment variable validation on startup for partially-configured credentials
- [ ] Memvid relevance score scaling fixed (0-1 → 0-100 correctly)
- [ ] YouTube metadata parsing handles missing snippet fields without crashing
- [ ] Code detection improved beyond brittle regex
- [ ] Tool handler input validation via Zod schemas (minQuality range, required fields)
- [ ] Tests added for each security fix and bug fix

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
*Last updated: 2026-01-29 after initialization*
