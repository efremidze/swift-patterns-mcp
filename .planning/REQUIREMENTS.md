# Requirements: Swift Patterns MCP — Security & Bug Fixes

**Defined:** 2026-01-29
**Core Value:** Fix security vulnerabilities and bugs so the server is safe to run and returns correct results.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Security

- [ ] **SEC-01**: Shell commands in `patreon-oauth.ts` and `patreon-dl.ts` use `execFile` instead of `exec` to prevent injection
- [ ] **SEC-02**: Error messages sanitized to strip credentials/tokens before logging
- [ ] **SEC-03**: Cookie values validated (format check) before use in shell commands
- [ ] **SEC-04**: Keytar unavailability produces a visible warning instead of silent failure
- [ ] **SEC-05**: Environment variables validated on startup — fail fast if partially configured (e.g., CLIENT_ID present but CLIENT_SECRET missing)

### Bug Fixes

- [ ] **BUG-01**: Memvid relevance scores correctly scaled from 0-1 to 0-100 range
- [ ] **BUG-02**: YouTube metadata parsing handles missing snippet fields (channelId, channelTitle) without crashing
- [ ] **BUG-03**: Code detection improved beyond single regex — handles Swift code blocks and common patterns

### Hardening

- [ ] **HARD-01**: Tool handler inputs validated via Zod schemas (minQuality 0-100, required string fields, etc.)
- [ ] **HARD-02**: Tests added for each security fix proving the vulnerability is closed
- [ ] **HARD-03**: Tests added for each bug fix proving correct behavior

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Performance

- **PERF-01**: Semantic embedding model prefetched eagerly on startup
- **PERF-02**: Patreon content scan cache TTL extended or replaced with file watchers
- **PERF-03**: Memvid indexing queued asynchronously instead of blocking search
- **PERF-04**: Singleton initialization serialized with promise-based locking

### Scaling

- **SCALE-01**: File cache has max size enforcement and eviction policy
- **SCALE-02**: Memvid embedding index garbage collected via LRU
- **SCALE-03**: Concurrent semantic searches rate-limited

### Observability

- **OBS-01**: Metrics on cache hit rates, search frequency, error rates
- **OBS-02**: Circuit breaker pattern for API failures
- **OBS-03**: API call rate limiting for Patreon, YouTube, RSS

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Performance optimization | Separate milestone — different risk profile |
| Scaling improvements | Separate milestone — premature without metrics |
| Observability/metrics | Separate milestone — needs design first |
| Fragile area refactoring (Patreon API parsing, quality scoring) | Only fix if directly related to security/bugs |
| New features | This is a hardening milestone, not feature work |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 2 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 2 | Pending |
| SEC-05 | Phase 2 | Pending |
| BUG-01 | Phase 3 | Pending |
| BUG-02 | Phase 3 | Pending |
| BUG-03 | Phase 3 | Pending |
| HARD-01 | Phase 4 | Pending |
| HARD-02 | Phase 4 | Pending |
| HARD-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 after roadmap creation*
