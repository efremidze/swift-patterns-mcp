# Technology Stack

**Analysis Date:** 2026-01-16

## Languages

**Primary:**
- TypeScript 5.7.2 - All application code (`package.json`, `tsconfig.json`)

**Secondary:**
- JavaScript (ES2022) - Build output, config files

## Runtime

**Environment:**
- Node.js >= 18.0.0 (`package.json` engines field)
- CI uses Node 20 (`.github/workflows/ci.yml`)

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Model Context Protocol (MCP) SDK 1.25.2 (`@modelcontextprotocol/sdk`) - Server implementation for Claude integration

**Testing:**
- Vitest 3.2.4 - Unit testing framework

**Build/Dev:**
- TypeScript 5.9.3 - Compilation to JavaScript
- ESLint with TypeScript support - Linting via `eslint.config.js`

## Key Dependencies

**Critical:**
- `@modelcontextprotocol/sdk` 1.25.2 - MCP server protocol implementation (`src/index.ts`)
- `rss-parser` 3.13.0 - RSS feed parsing for free content sources (`src/sources/free/rssPatternSource.ts`)
- `minisearch` 7.2.0 - Full-text search with fuzzy matching (`src/utils/search.ts`)
- `natural` 8.1.0 - NLP, Porter Stemmer for search stemming (`src/utils/search.ts`)

**Infrastructure:**
- `node-fetch` 3.3.2 - HTTP requests for external APIs
- `keytar` 7.9.0 - Native OS credential storage for OAuth tokens (`src/sources/premium/patreon-oauth.ts`)
- `playwright` 1.57.0 - Browser automation for Patreon session extraction (`src/tools/extract-cookie.ts`)
- `adm-zip` 0.5.16 - ZIP file extraction for Patreon content (`src/sources/premium/patreon-zip.ts`)
- `patreon-dl` 3.5.0 - Patreon content downloader CLI wrapper (`src/sources/premium/patreon-dl.ts`)
- `dotenv` 17.2.3 - Environment variable loading (`src/index.ts`)

## Configuration

**Environment:**
- `.env` files for secrets (gitignored)
- `.env.example` documents required vars: `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`, `YOUTUBE_API_KEY`
- Runtime config persisted to `~/.swift-patterns-mcp/config.json`

**Build:**
- `tsconfig.json` - TypeScript compiler (ES2022 target, Node16 module resolution, strict mode)
- `eslint.config.js` - ESLint flat config with TypeScript plugin

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js 18+)
- Optional: Playwright browsers for Patreon session extraction

**Production:**
- Distributed as npm package (`@efremidze/swift-patterns-mcp`)
- Runs as MCP server via stdio transport
- CLI command: `swift-patterns-mcp` pointing to `./build/index.js`

---

*Stack analysis: 2026-01-16*
*Update after major dependency changes*
