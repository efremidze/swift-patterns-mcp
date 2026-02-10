# Technology Stack

**Analysis Date:** 2026-02-09

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code in `src/`
- JavaScript (ES2022) - Build output and CLI tools

**Secondary:**
- HTML - Used in OAuth callback responses (`src/sources/premium/patreon-oauth.ts`)

## Runtime

**Environment:**
- Node.js >= 18.0.0 (specified in `package.json`)

**Package Manager:**
- npm 10+ (with package-lock.json)
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- @modelcontextprotocol/sdk 1.25.3 - MCP server implementation (`src/index.ts`)
  - Uses `Server`, `StdioServerTransport`, tool request/response handlers
- TypeScript 5.9.3 - Compilation and type checking

**Testing:**
- Vitest 3.2.4 - Test runner (`vitest.config.ts`, `vitest.setup.ts`)
- Tests: `.test.ts` and `.test.ts` files in `src/**/__tests__/`

**Build/Dev:**
- TypeScript compiler (tsc) - Compiles `src/` to `build/`
- ESLint 9.39.2 - Linting with typescript-eslint
- Node.js built-in modules: fs, path, http, readline, crypto, child_process

## Key Dependencies

**Critical:**
- @memvid/sdk 2.0.153 - Persistent semantic memory storage (`src/utils/memvid-memory.ts`)
- @xenova/transformers 2.17.2 - Embedding model for semantic search (`src/utils/semantic-recall.ts`)
  - Uses Xenova/all-MiniLM-L6-v2 model for feature extraction
- rss-parser 3.13.0 - RSS feed parsing (`src/sources/free/rssPatternSource.ts`)

**HTTP & Fetching:**
- undici 7.19.2 - HTTP client (`src/utils/fetch.ts`)
- playwright 1.58.0 - Browser automation for Patreon cookie extraction (`src/tools/extract-cookie.ts`)

**Search & Analysis:**
- minisearch 7.2.0 - Full-text search indexing (`src/utils/search.ts`)
- natural 8.1.0 - NLP utilities for tokenization and stemming
- ml-distance 4.0.1 - Cosine similarity for semantic search (`src/utils/semantic-recall.ts`)
- linkedom 0.18.12 - DOM parsing for HTML content extraction

**Authentication:**
- keytar 7.9.0 - Secure credential storage (macOS/Linux/Windows) (`src/sources/premium/patreon-oauth.ts`)
  - Falls back gracefully if system keyring unavailable

**Utilities:**
- dotenv 17.2.3 - Environment variable loading
- zod 3.25.76 - Schema validation
- adm-zip 0.5.16 - ZIP file handling
- async-cache-dedupe 3.4.0 - Cache deduplication
- quick-lru 7.3.0 - LRU memory cache
- string-strip-html 13.5.3 - HTML cleanup
- p-limit 7.2.0 - Concurrency control
- pino 9.5.0 - Structured logging

## Configuration

**Environment:**
- Loaded via `dotenv` in `src/index.ts`
- Configuration file: `.env` (not committed)
- Example: `.env.example`

**Required env vars:**
- `PATREON_CLIENT_ID` - OAuth client ID (optional, for premium content)
- `PATREON_CLIENT_SECRET` - OAuth client secret (optional, for premium content)
- `YOUTUBE_API_KEY` - YouTube Data API key (optional, for video content)

**Build:**
- `tsconfig.json` - TypeScript configuration
  - Target: ES2022
  - Module: Node16
  - Strict mode enabled
  - Declaration maps enabled (for type hints)
  - Source maps enabled

**Linting:**
- `eslint.config.js` - ESLint configuration
  - Parser: typescript-eslint
  - Files: `src/**/*.ts`
  - Rules: strict TypeScript checks with some flexibility (no-explicit-any allowed)

## Platform Requirements

**Development:**
- Node.js >= 18.0.0
- npm or compatible package manager
- macOS/Linux: keytar requires libsecret (Linux) or Keychain (macOS)
- For Patreon OAuth: macOS only (uses `open` command to launch browser)

**Production:**
- Node.js >= 18.0.0
- No external databases required
- Persistent storage: local filesystem only (cache files, memvid memory, patreon profiles)

## Storage & Caching

**Local Filesystem:**
- Cache directory: `~/.swift-patterns-mcp/` (created by `src/utils/paths.js`)
  - `cache/rss/` - RSS feed cache
  - `cache/articles/` - Article content cache
  - `cache/youtube/` - YouTube API response cache
  - `cache/semantic-embeddings/` - Embedding vectors (24-hour TTL)
  - `swift-patterns-memory.mv2` - Memvid persistent memory database

**Profile Directory:**
- `.patreon-profile/` - Playwright persistent context (local working directory)
- `.patreon-session` - Session cookie file (plaintext, overwritten per session)

**Tokens:**
- Stored in system keyring via keytar (macOS/Windows/Linux with libsecret)
- Fallback: in-memory only if keytar unavailable
- Path: `~/.swift-patterns-mcp/tokens.json` (legacy)

---

*Stack analysis: 2026-02-09*
