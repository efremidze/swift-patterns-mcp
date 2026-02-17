# Technology Stack

**Analysis Date:** 2026-02-17

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code, built to ES2022

## Runtime

**Environment:**
- Node.js 18.0.0+ (required, enforced via `engines` in package.json)
- Tested on Node 20 in CI

**Package Manager:**
- npm (lockfile present: `package-lock.json`)

## Frameworks

**Core:**
- @modelcontextprotocol/sdk 1.25.3 - MCP server implementation and protocol
- Model Context Protocol - Enables integration with Claude and other AI assistants via stdio transport

**CLI:**
- Custom routing system at `src/cli/router.ts` for command dispatch
- Subcommands: `sources`, `patreon`, `setup`

**Build/Dev:**
- TypeScript compiler (tsc) - Compiles to `build/` directory
- ESLint 9.39.2 with typescript-eslint - Linting and type checking
- Vitest 3.2.4 - Test runner with V8 coverage support

## Key Dependencies

**Critical:**
- @modelcontextprotocol/sdk 1.25.3 - Protocol implementation for AI assistants
- @xenova/transformers 2.17.2 - In-process embedding model for semantic search
- @memvid/sdk 2.0.153 - Persistent semantic memory and full-text search storage
- dotenv 17.2.4 - Environment variable loading

**Premium Source Access:**
- keytar 7.9.0 - Secure credential storage (system keychain/credential store)
  - macOS: Keychain integration
  - Linux: libsecret (optional, gracefully degraded if unavailable)
  - Windows: Credential Manager

**Content Fetching & Parsing:**
- rss-parser 3.13.0 - RSS/Atom feed parsing
- linkedom 0.18.12 - DOM parsing for HTML content extraction
- playwright 1.58.2 - Browser automation for Patreon content download
- string-strip-html 13.5.3 - HTML sanitization

**Search & Ranking:**
- minisearch 7.2.0 - Full-text search index
- ml-distance 4.0.1 - Distance metrics for semantic similarity
- stemmer 2.0.1 - English stemming for search
- async-cache-dedupe 3.4.0 - Request deduplication for cache hits
- quick-lru 7.3.0 - Fast LRU memory cache
- adm-zip 0.5.16 - ZIP file extraction (for Patreon downloads)

**Concurrency & Utilities:**
- p-limit 7.3.0 - Concurrency limiting for parallel operations
- zod 3.25.76 - Schema validation and type inference

**Logging:**
- pino 9.5.0 - Fast structured JSON logging

**Testing:**
- @vitest/coverage-v8 3.2.4 - Code coverage reporting

## Configuration

**Environment:**
- Loaded via `dotenv/config` in `src/index.ts`
- File location: `.env` (not committed)
- Initialization: `src/index.ts` line 5 imports `dotenv/config` before any application code

**Build Configuration:**
- `tsconfig.json` - TypeScript compiler options
  - Target: ES2022
  - Module: Node16
  - Strict mode enabled
  - Source maps and declaration files generated

**Linting Configuration:**
- `eslint.config.js` - ESLint flat config (v9)
  - Base: `@eslint/js` + `typescript-eslint/configs.recommended`
  - Tests: Restrict `describe.only`, `it.only`, `test.only`
  - Tool tests: Prevent `Math.random()` and `crypto.randomUUID()` (use deterministic fixtures instead)

## Platform Requirements

**Development:**
- Node.js 18.0.0 or later
- macOS (for Patreon OAuth - uses `open` command to launch browser)
- npm or compatible package manager

**Production:**
- Node.js 18.0.0+
- Runs as stdio MCP server (consumed by Claude, Cursor, etc.)
- No external servers or databases required (self-contained)
- Local filesystem for caching (see `getCacheDir()` at `src/utils/paths.ts`)
- System credential store for OAuth tokens (optional, gracefully degrades)

## Entry Points

**CLI Executable:**
- `build/index.js` (compiled from `src/index.ts`)
- bin entry: `swift-patterns-mcp` (from package.json)

**MCP Server:**
- Starts at `src/index.ts` → `src/cli/router.ts` → `src/server.ts`
- Exports tools based on enabled sources
- Communicates via stdio with MCP client

## Deployment

**Package Distribution:**
- Published to npm as `swift-patterns-mcp`
- Installs globally: `npm install -g swift-patterns-mcp`
- CI: GitHub Actions on Node 20 (lint, build, test with coverage gate)
- Release: Automated via `release.yml` workflow

---

*Stack analysis: 2026-02-17*
