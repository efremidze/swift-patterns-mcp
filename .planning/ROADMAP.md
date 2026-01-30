# Roadmap: Swift Patterns MCP — Security & Bug Fixes

## Overview

This milestone hardens the MCP server against security vulnerabilities and known bugs through four focused phases. Phase 1 eliminates shell command injection vectors, Phase 2 secures credential handling, Phase 3 fixes user-visible bugs in scoring and parsing, and Phase 4 adds comprehensive input validation and test coverage to prevent regression.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Command Injection Elimination** - Replace shell interpolation with safe execution
- [ ] **Phase 2: Bug Fixes** - Fix memvid scoring, YouTube parsing, code detection
- [ ] **Phase 3: Input Validation & Test Coverage** - Zod schemas and comprehensive tests

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
- [ ] 01-01-PLAN.md — Replace exec with execFile and add cookie format validation

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
- [ ] 02-01-PLAN.md — Fix memvid scoring, YouTube parsing, and code detection

### Phase 3: Input Validation & Test Coverage
**Goal**: Tool inputs are validated and all fixes have test coverage
**Depends on**: Phase 2 (tests verify fixes from all prior phases)
**Requirements**: HARD-01, HARD-02, HARD-03
**Success Criteria** (what must be TRUE):
  1. Tool handler inputs validated via Zod schemas with minQuality range 0-100 enforced
  2. Invalid tool inputs (out-of-range values, missing required fields) return clear MCP error responses
  3. Tests exist proving SEC-01 and SEC-03 injection vectors are closed
  4. Tests exist proving BUG-01, BUG-02, BUG-03 fixes work correctly
  5. Tests exist proving HARD-01 Zod validation catches invalid inputs
**Plans**: TBD

Plans:
- [ ] 03-01: TBD (will be created during planning)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Command Injection Elimination | 0/1 | Not started | - |
| 2. Bug Fixes | 0/1 | Not started | - |
| 3. Input Validation & Test Coverage | 0/1 | Not started | - |

---
*Roadmap created: 2026-01-29*
*Last updated: 2026-01-29 after phase 1 planning*
