# External Integrations

**Analysis Date:** 2026-02-07

## APIs & External Services

**Patreon API:**
- Service: Patreon OAuth 2.0 + Content API
- What it's used for: Authenticate users and fetch premium content from creators they support
- SDK/Client: Custom OAuth client in `src/sources/premium/patreon-oauth.ts`
- Auth: PATREON_CLIENT_ID, PATREON_CLIENT_SECRET environment variables
- Token Storage: OS keychain via keytar (macOS/Linux/Windows)
- Scopes: `identity`, `identity.memberships` (required for patron data), `campaigns`, `campaigns.members`
- OAuth Flow: Initiated by `src/cli/patreon.ts` → `startOAuthFlow()` at line 89
- Token Endpoint: `https://www.patreon.com/api/oauth2/token`
- Auth Endpoint: `https://www.patreon.com/oauth2/authorize`
- Callback Port: 9876 (local http listener during OAuth)

**YouTube Data API v3:**
- Service: Google YouTube Data API
- What it's used for: Fetch video metadata and descriptions from creator channels to supplement Patreon content
- SDK/Client: Custom HTTP client in `src/sources/premium/youtube.ts`
- Auth: YOUTUBE_API_KEY environment variable
- API Base: `https://www.googleapis.com/youtube/v3`
- Cache TTL: 3600 seconds (1 hour)
- Fetch Timeout: 10 seconds
- Data Extracted: Video metadata (title, description, publishedAt, tags), Patreon links, GitHub code links
- Error Tracking: Module-level status object tracks failures via `getYouTubeStatus()` at line 32

**RSS Feeds (Free Sources):**
- Swift by Sundell: `https://www.swiftbysundell.com/feed.rss`
  - Implementation: `src/sources/free/sundell.ts`
  - Cache TTL: 3600 seconds

- Antoine van der Lee: `https://www.avanderlee.com/feed/`
  - Implementation: `src/sources/free/vanderlee.ts`
  - Fetches full article HTML content (not just RSS summary)
  - HTML extraction via linkedom

- Nil Coalescing: `https://nilcoalescing.com/feed.rss`
  - Implementation: `src/sources/free/nilcoalescing.ts`

- Point-Free (GitHub-based):
  - GitHub API: `https://api.github.com/repos/{owner}/{repo}`
  - Raw content: `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file}`
  - Implementation: `src/sources/free/pointfree.ts`
  - Fetches Swift source files directly from repository

**GitHub API:**
- Service: GitHub REST API v3
- What it's used for: Fetch open-source Swift library code and documentation from Point-Free repository
- No explicit auth (public repo, rate-limited by IP)
- Endpoints used in `src/sources/free/pointfree.ts`:
  - `/repos/{owner}/{repo}` - Repository metadata
  - `/repos/{owner}/{repo}/git/trees/{branch}?recursive=1` - Repository structure
  - Raw content at `raw.githubusercontent.com`

## Data Storage

**Databases:**
- None (in-memory and file-based storage only)

**File Storage:**
- Local filesystem only
- Cache directory: `~/.swift-patterns-mcp/cache/`
  - RSS cache: `cache/rss/`
  - Article content cache: `cache/articles/`
  - Semantic embeddings: `cache/semantic-embeddings/`
  - YouTube metadata: `cache/youtube/`
  - Search index: `cache/search-index/`

**Caching:**
- FileCache with LRU memory layer in `src/utils/cache.ts`
- Dual-layer: Memory cache (QuickLRU max 100 entries) + File cache (persistent, TTL-based)
- Cache expiration: Configurable per operation (default 24 hours)
- Automatic cleanup: Hourly expired entry cleanup (fire-and-forget)

**Memvid Memory Database:**
- Service: Memvid (local semantic memory store)
- Implementation: `src/utils/memvid-memory.ts`
- Storage: `~/.swift-patterns-mcp/swift-patterns-memory.mv2`
- Features: Full-text + semantic search, persistent across sessions
- Modes: Lexical ('lex'), semantic ('sem'), or automatic ('auto')
- Auto-store: Configurable to store search results for future recall

## Authentication & Identity

**Auth Provider:**
- Custom OAuth 2.0 implementation (no auth SDK used)
- Implementation: `src/sources/premium/patreon-oauth.ts`
- Flow: Authorization Code Grant with PKCE
- Token Management:
  - Refresh logic: 5-minute pre-expiry refresh window
  - Storage: OS keychain via keytar (encrypted)
  - Fallback: Graceful degradation if keytar unavailable (no persistence)

**Credential Management:**
- keytar wrapper (`src/sources/premium/patreon-oauth.ts` lines 18-25) for cross-platform support
- Service name: `swift-patterns-mcp`
- Account name: `patreon-tokens`
- Graceful handling of missing system libraries (keytar optional on Linux systems without libsecret)

**Session Management:**
- Patreon tokens expire and auto-refresh via `refreshAccessToken()` at line 91
- No explicit session management (stateless requests with bearer tokens)

## Monitoring & Observability

**Error Tracking:**
- None (no external error tracking service)
- Local error handling with structured logging

**Logs:**
- Pino JSON structured logging at `src/utils/logger.ts`
- Configurable log level: LOG_LEVEL env var (default: info)
- Service name: `swift-patterns-mcp`
- Error logging: `logError()` helpers in `src/utils/errors.ts` with context
- Request/response logging in HTTP operations

**Status Monitoring:**
- YouTube API health: `getYouTubeStatus()` in `src/sources/premium/youtube.ts` (tracks last error + timestamp)
- Patreon auth status: `showStatus()` in `src/cli/patreon.ts` (connection state, creator count, content stats)

## CI/CD & Deployment

**Hosting:**
- npm registry (published as package)
- Entrypoint: `build/index.js` (bin field in package.json)
- Invoked as: `swift-patterns-mcp` command

**CI Pipeline:**
- GitHub Actions (`.github/` directory structure)
- Tests run via: `npm test` (Vitest runner)
- Linting: `npm run lint` (ESLint + TypeScript strict check)

**CLI Commands:**
- `swift-patterns-mcp` - Start MCP server on stdio
- `swift-patterns-mcp sources` - List/manage content sources
- `swift-patterns-mcp patreon` - Setup/manage Patreon integration

## Environment Configuration

**Required env vars (for premium features):**
- `PATREON_CLIENT_ID` - OAuth client ID from Patreon Portal
- `PATREON_CLIENT_SECRET` - OAuth client secret from Patreon Portal
- `YOUTUBE_API_KEY` - API key from Google Cloud Console

**Optional env vars:**
- `LOG_LEVEL` - Pino logging level (default: info)

**Secrets location:**
- Patreon tokens: OS keychain (encrypted, not in files)
- YouTube API key: `.env` file (developers responsible for security)

## Webhooks & Callbacks

**Incoming:**
- Patreon OAuth callback: Local http listener on port 9876 during setup (line 13 of patreon-oauth.ts)
- No persistent webhook endpoints

**Outgoing:**
- None

## Rate Limiting & Quotas

**RSS Feeds:**
- No documented rate limits (caching mitigates impact)
- Cache TTL: 1 hour per feed

**GitHub API:**
- Public API: 60 requests/hour per IP (no auth)
- Cached to minimize requests

**YouTube API:**
- Quota: Depends on API key quota allocation
- Cache TTL: 1 hour per video
- Timeout: 10 seconds per request with fallback to cached data

**Patreon API:**
- Token-based auth (subscriber-specific quotas)
- Auto-refresh logic handles expiration

## Data Flow

**Free Source Fetch:**
1. RSS feed URL → rss-parser → HTML extraction (if needed, via linkedom)
2. Content analysis → minisearch indexing + relevance scoring
3. Results cached in FileCache
4. Optionally stored in Memvid (if autoStore enabled)

**Premium Source Fetch (Patreon):**
1. Load Patreon tokens from OS keychain
2. Validate/refresh tokens via Patreon API
3. Fetch patron memberships via `/identity` endpoint
4. Fetch creator content via Patreon API
5. Supplement with YouTube metadata via Google API
6. Combine and cache in FileCache + Memvid

**Search Flow:**
1. Query → Lexical search via minisearch
2. If score < threshold AND semantic recall enabled:
   - Generate embedding via @xenova/transformers
   - Vector similarity search in Memvid
   - Merge results
3. Return ranked results with relevance scores

---

*Integration audit: 2026-02-07*
