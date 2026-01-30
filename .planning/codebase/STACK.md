# Technology Stack

**Analysis Date:** 2026-01-29

## Languages

**Primary:**
- TypeScript 5.9.3 - Main development language, used throughout `src/`
- JavaScript - Runtime execution (Node.js)

**Secondary:**
- Shell/Bash - CLI setup and authentication scripts

## Runtime

**Environment:**
- Node.js >= 18.0.0 (required in `package.json`)
- ES2022 target (TypeScript compiler target in `tsconfig.json`)

**Package Manager:**
- npm (with lock file: `package-lock.json`)
- Module format: ES modules (type: "module" in `package.json`)

## Frameworks

**Core:**
- @modelcontextprotocol/sdk 1.25.3 - MCP server framework for Claude integration
  - Provides Server, StdioServerTransport, and tool/request handling
  - Located in `src/index.ts` entry point

**Semantic Search & Memory:**
- @xenova/transformers 2.17.2 - Embeddings for semantic search
  - Uses Xenova/all-MiniLM-L6-v2 model for feature extraction
  - Located in `src/utils/semantic-recall.ts`

- @memvid/sdk 2.0.153 - Persistent semantic memory database
  - Stores and searches patterns with full-text and semantic capabilities
  - Located in `src/utils/memvid-memory.ts`

**Content Processing:**
- rss-parser 3.13.0 - Parse RSS feeds from free sources (Sundell, van der Lee, etc.)
  - Located in `src/sources/free/rssPatternSource.ts`

- linkedom 0.18.12 - DOM parsing for HTML content extraction
  - Used in `src/sources/free/vanderlee.ts` for web scraping

- string-strip-html 13.5.3 - HTML sanitization and stripping
  - Paired with linkedom for clean text extraction

**Testing:**
- vitest 3.2.4 - Test runner and framework
  - Config: `vitest.config.ts`
  - Run: `npm run test`

**Build/Dev:**
- TypeScript 5.9.3 - Compiler with strict mode enabled
  - Build output: `build/` directory
  - Source maps and declarations included

- ESLint 9.39.2 + typescript-eslint 8.54.0 - Code linting
  - Config: `eslint.config.js`
  - Run: `npm run lint`

- tsc - TypeScript compiler
  - Watch mode: `npm run watch`

## Key Dependencies

**Critical:**
- pino 9.5.0 - Structured logging
  - Logger initialized with service name and configurable log level
  - Located in `src/utils/logger.ts`

- zod 3.25.76 - Runtime schema validation
  - Used for type-safe environment variable validation and API responses

**HTTP & Networking:**
- undici 7.19.2 - High-performance HTTP client
  - Wraps `fetch` API used throughout the application
  - Located in `src/utils/fetch.ts`

- playwright 1.58.0 - Browser automation (optional, for premium sources)
  - Available for patreon content scraping if needed

**Infrastructure:**
- dotenv 17.2.3 - Environment variable loading
  - Imported at top of `src/index.ts` for config management

- keytar 7.9.0 - Secure credential storage (platform-specific)
  - Stores Patreon OAuth tokens in system keychain/keyring
  - Gracefully handles missing system libraries on Linux
  - Located in `src/sources/premium/patreon-oauth.ts`

- adm-zip 0.5.16 - ZIP file handling
  - Used for extracting Patreon download archives
  - Located in `src/sources/premium/patreon-dl.ts`

**Search & Utilities:**
- minisearch 7.2.0 - Lightweight full-text search library
  - Used for lexical pattern searching
  - Located in `src/utils/search.ts`

- ml-distance 4.0.1 - Distance calculations for embeddings
  - Cosine similarity for semantic search
  - Located in `src/utils/semantic-recall.ts`

- quick-lru 7.3.0 - In-memory LRU cache
  - Part of `FileCache` hybrid memory/disk caching system
  - Located in `src/utils/cache.ts`

- natural 8.1.0 - Natural language processing
  - Available for NLP tasks (currently integrated but usage may vary)

## Configuration

**Environment:**
- `.env` - Runtime configuration (secrets)
  - PATREON_CLIENT_ID, PATREON_CLIENT_SECRET - OAuth credentials
  - YOUTUBE_API_KEY - YouTube Data API access
  - LOG_LEVEL - Logging verbosity (default: 'info')

- `.env.example` - Template for required variables

**Build:**
- `tsconfig.json` - TypeScript compilation settings
  - Target: ES2022
  - Strict mode enabled
  - Module resolution: Node16
  - Output directory: `./build`

- `eslint.config.js` - ESLint configuration
  - Files checked: `src/**/*.ts`
  - TypeScript strict rules enabled with some relaxations
  - Unused vars ignored if prefixed with `_`

- `vitest.config.ts` - Vitest test runner configuration
  - Excludes: node_modules, build, dist

**Distribution:**
- `package.json` bin entry - Executable at `build/index.js`
  - Command: `swift-patterns-mcp`

## Platform Requirements

**Development:**
- Node.js 20 (used in CI/CD)
- On Linux: libsecret for keytar (optional for token storage)
- npm for dependency management

**Production:**
- Node.js >= 18.0.0
- stdio transport for MCP protocol communication
- Optional: System keychain/keyring for credential storage
- Optional: Internet connection for OAuth flows and API calls

## Optional Features

**Patreon Integration:**
- Requires OAuth 2.0 credentials from https://www.patreon.com/portal/registration/register-clients
- Uses local HTTP server on port 9876 for OAuth callback
- Token refresh: 5 minutes before expiry

**YouTube Integration:**
- Requires API key from https://console.cloud.google.com
- YouTube Data API v3 for video discovery and metadata
- 1-hour cache TTL for video data

**Semantic Features:**
- Requires model download on first use (Xenova/all-MiniLM-L6-v2)
- Optional memvid persistent memory for cross-session recall
- Optional embedding-based semantic search as fallback

---

*Stack analysis: 2026-01-29*
