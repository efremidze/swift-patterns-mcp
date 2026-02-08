# Technology Stack

**Analysis Date:** 2026-02-07

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code in `src/`
- JavaScript - Build output, CLI scripts

**Secondary:**
- Bash - Build and installation scripts

## Runtime

**Environment:**
- Node.js >= 18.0.0 (from `package.json` engines)

**Package Manager:**
- npm - Managed via `package-lock.json`
- Lockfile: present at `/Users/home/Documents/GitHub/swift-mcp/package-lock.json`

## Frameworks

**Core:**
- @modelcontextprotocol/sdk 1.25.3 - MCP server framework, provides Server and transport layer at `src/index.ts`
- Model Context Protocol - Communication protocol for AI integration

**Testing:**
- Vitest 3.2.4 - Unit and integration test runner, configured via tsconfig and run with `npm test`

**Build/Dev:**
- TypeScript 5.9.3 - Compilation from `src/` to `build/` (tsc builds to ES2022)
- ESLint 9.39.2 + @typescript-eslint/8.54.0 - Linting configured in `eslint.config.js`

## Key Dependencies

**Critical:**
- @memvid/sdk 2.0.153 - Persistent semantic memory storage, used in `src/utils/memvid-memory.ts` for pattern caching and recall
- @xenova/transformers 2.17.2 - Embeddings model (Xenova/all-MiniLM-L6-v2) for semantic recall fallback in `src/utils/semantic-recall.ts`
- rss-parser 3.13.0 - RSS feed parsing for free sources (Sundell, van der Lee, etc.) in `src/sources/free/rssPatternSource.ts`

**Search & Analysis:**
- minisearch 7.2.0 - Full-text lexical search index in `src/utils/search.ts`
- natural 8.1.0 - NLP utilities: Porter Stemmer, Levenshtein distance for fuzzy matching
- ml-distance 4.0.1 - Distance/similarity calculations for semantic search in `src/utils/semantic-recall.ts`

**Infrastructure:**
- undici 7.19.2 - HTTP client (base for fetch wrapper in `src/utils/fetch.ts`)
- linkedom 0.18.12 - DOM parsing for HTML content extraction in `src/sources/free/vanderlee.ts`
- keytar 7.9.0 - Secure credential storage via OS keychain (macOS/Linux/Windows) for Patreon OAuth tokens in `src/sources/premium/patreon-oauth.ts`
- pino 9.5.0 - Structured JSON logging throughout codebase, configured in `src/utils/logger.ts`
- quick-lru 7.3.0 - In-memory LRU cache for frequently accessed data in `src/utils/cache.ts`
- adm-zip 0.5.16 - ZIP file handling for source registry in `src/tools/handlers/`
- string-strip-html 13.5.3 - HTML cleaning and text extraction
- p-limit 7.2.0 - Concurrency limiting for parallel operations
- dotenv 17.2.3 - Environment variable loading (loaded in `src/index.ts`)
- zod 3.25.76 - Schema validation for configuration and API responses

**CLI Tools:**
- playwright 1.58.0 - Browser automation (used in Patreon OAuth flow setup in `src/sources/premium/patreon-oauth.ts`)

## Configuration

**Environment:**
- `.env` file support via dotenv package
- Required env vars documented in `.env.example`:
  - `PATREON_CLIENT_ID` - OAuth credentials
  - `PATREON_CLIENT_SECRET` - OAuth credentials
  - `YOUTUBE_API_KEY` - YouTube Data API v3 access
  - `LOG_LEVEL` - Logging verbosity (default: info)

**Build:**
- `tsconfig.json` at root:
  - Target: ES2022
  - Module: Node16 (ES modules)
  - Strict type checking enabled
  - Declaration maps and source maps enabled
  - Output directory: `./build/`

**TypeScript Compilation:**
```bash
npm run build          # Compile src/ to build/
npm run watch          # Watch mode during development
```

## Platform Requirements

**Development:**
- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- For Patreon OAuth: macOS, Linux, or Windows with native keystore support (graceful fallback if keytar unavailable)
- For semantic embeddings: Download ~30MB ONNX model on first use (cached locally)

**Production:**
- Node.js 18.0.0 or higher
- Deployable as MCP server via stdio transport (`src/index.ts` line 212)
- Environment variables for Patreon/YouTube (optional)
- Cache directory in user home: `~/.swift-patterns-mcp/`

**Filesystem:**
- Cache directory structure: `~/.swift-patterns-mcp/cache/{namespace}/`
- Persistent config: `~/.swift-patterns-mcp/config.json`
- Semantic embeddings cache: `~/.swift-patterns-mcp/semantic-embeddings/`
- Memvid memory database: `~/.swift-patterns-mcp/swift-patterns-memory.mv2`
- Patreon tokens: Stored in OS keychain (keytar wrapper)

---

*Stack analysis: 2026-02-07*
