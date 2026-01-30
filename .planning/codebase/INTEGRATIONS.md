# External Integrations

**Analysis Date:** 2026-01-29

## APIs & External Services

**Authentication & Content:**
- Patreon API - Premium content access
  - OAuth 2.0 flow via `src/sources/premium/patreon-oauth.ts`
  - Requires: PATREON_CLIENT_ID, PATREON_CLIENT_SECRET env vars
  - Scopes: identity, identity.memberships, campaigns, campaigns.members
  - Token endpoint: https://www.patreon.com/api/oauth2/token
  - Callback port: 9876 (localhost)
  - Token storage: System keychain via keytar (with fallback to no persistence)
  - Token refresh: Automatic 5 minutes before expiry

- YouTube Data API v3 - Video discovery and metadata
  - Requires: YOUTUBE_API_KEY env var
  - Endpoints: `/search`, `/videos` for channel/video queries
  - Client: `src/sources/premium/youtube.ts`
  - Cache: 1-hour TTL via FileCache
  - Timeout: 10 seconds per request
  - Status tracking: Module-level error tracking for graceful degradation

**Content Sources (RSS-based):**
- Swift by Sundell (RSS) - https://www.swiftbysundell.com/
  - Client: `src/sources/free/sundell.ts`
  - Format: RSS feed parser
  - Status: Always enabled

- Antoine van der Lee (RSS) - https://www.avanderlee.com/
  - Client: `src/sources/free/vanderlee.ts`
  - Format: RSS + HTML scraping with linkedom
  - Status: Always enabled

- Nil Coalescing (RSS) - https://www.nilcoalescing.com/
  - Client: `src/sources/free/nilcoalescing.ts`
  - Format: RSS feed parser
  - Status: Always enabled

- Point-Free (RSS) - https://www.pointfree.co/
  - Client: `src/sources/free/pointfree.ts`
  - Format: RSS feed parser
  - Status: Always enabled

## Data Storage

**Databases:**
- None (no database server required)
- Local file-based storage via FileCache

**File Storage:**
- Local filesystem only
  - Cache directory: `~/.swift-patterns-mcp/cache/` (platform-dependent)
  - Memvid memory: `~/.swift-patterns-mcp/swift-patterns-memory.mv2`
  - Patreon tokens: System keychain (via keytar) or fallback to ~/.swift-patterns-mcp/tokens.json
  - Config: `~/.swift-patterns-mcp/sources.json`

**Caching:**
- FileCache hybrid system (memory + disk)
  - Memory: QuickLRU with configurable max entries (default: 100)
  - Disk: JSON files in cache directory
  - TTL: Configurable per cache item (default: 24 hours)
  - Cleanup: Automatic hourly expiration check
  - Located in `src/utils/cache.ts`

- Shared cache instances:
  - `rssCache` - RSS feed content
  - `articleCache` - Article content
  - `youtubeCache` - YouTube video metadata (50 max memory entries)
  - `semanticCache` - Embedding vectors (7-day TTL)

**Semantic Memory:**
- Memvid v2 database - Persistent semantic storage
  - Path: `~/.swift-patterns-mcp/swift-patterns-memory.mv2`
  - Features: Full-text search, semantic search, tagging
  - Embeddings: Optional with @xenova/transformers
  - Client: `src/utils/memvid-memory.ts`
  - Manager: MemvidMemoryManager singleton

## Authentication & Identity

**Auth Provider:**
- Patreon OAuth 2.0 (optional)
  - Implementation: Custom OAuth flow via local HTTP server
  - Located: `src/sources/premium/patreon-oauth.ts`
  - Callback: http://localhost:9876/callback
  - Timeout: 60 seconds for user authorization
  - Token persistence: Keytar (system keychain) with fallback

**Custom Auth:**
- API key (YouTube)
  - Environment variable: YOUTUBE_API_KEY
  - No token refresh required
  - No expiration tracking

## Monitoring & Observability

**Error Tracking:**
- None (no external error tracking service)

**Logs:**
- Local structured logging with Pino
  - Logger initialized: `src/utils/logger.ts`
  - Service name: 'swift-patterns-mcp'
  - Level: Configurable via LOG_LEVEL env var (default: 'info')
  - Format: JSON structured logs to stdout
  - Usage: Throughout codebase for operation tracking

**Health Tracking:**
- YouTube status module in `src/sources/premium/youtube.ts`
  - Tracks last error and error timestamp
  - Accessible via `getYouTubeStatus()` function
  - Used for graceful degradation when API fails

## CI/CD & Deployment

**Hosting:**
- npm package registry (npmjs.org)
- Published as: `swift-patterns-mcp`
- Entry point: `build/index.js` (compiled TypeScript)
- Distribution: Files listed in `package.json` files array

**CI Pipeline:**
- GitHub Actions
  - File: `.github/workflows/ci.yml`
  - Triggers: Push to main, pull requests
  - Steps: Install, Lint, Build, Test
  - Node version: 20

**CD Pipeline:**
- GitHub Actions Release workflow
  - File: `.github/workflows/release.yml`
  - Trigger: Manual (workflow_dispatch) with version bump choice
  - Steps: Install, Build, Test, Version bump, Push tags, Publish to npm
  - Authentication: SSH key for commits, NPM_TOKEN for publishing
  - Environment: release (requires approval)

## Environment Configuration

**Required env vars:**
- PATREON_CLIENT_ID - OAuth client ID (for Patreon integration)
- PATREON_CLIENT_SECRET - OAuth client secret (for Patreon integration)
- YOUTUBE_API_KEY - Google API key (for YouTube video discovery)

**Optional env vars:**
- LOG_LEVEL - Logging verbosity (default: 'info')
  - Values: debug, info, warn, error, fatal

**Source Configuration:**
- File: `~/.swift-patterns-mcp/sources.json`
- Format: SourceConfig interface in `src/config/sources.ts`
- Contains: Per-source enable/disable status, sync timestamps, semantic recall settings

**Secrets location:**
- Environment variables: `.env` file (not committed, see `.env.example`)
- OAuth tokens: System keychain (via keytar) or fallback path
- API keys: Environment variables only

## Webhooks & Callbacks

**Incoming:**
- Patreon OAuth callback
  - URL: http://localhost:9876/callback
  - Method: GET
  - Parameters: code (authorization code) or error
  - Handler: `src/sources/premium/patreon-oauth.ts` line 144-230

**Outgoing:**
- None (application doesn't initiate webhooks)

## Rate Limiting & Quotas

**YouTube API:**
- No explicit rate limiting in code
- Standard YouTube API quotas apply (100 requests/100 seconds by default)
- Caching (1-hour TTL) reduces request volume

**Patreon API:**
- Standard Patreon OAuth rate limits apply
- Token refresh: On-demand when expired

**RSS Feeds:**
- No rate limiting
- 24-hour cache TTL per feed

## Network Configuration

**HTTP Client:**
- Fetch implementation: undici (high-performance alternative)
  - Located: `src/utils/fetch.ts`
  - Supports: AbortController, timeout handling
  - Used throughout for all HTTP requests

**Timeouts:**
- YouTube API calls: 10 seconds
- Patreon OAuth flow: 60 seconds total
- RSS feed fetches: No explicit timeout (relies on undici defaults)

**Error Handling:**
- YouTube: Returns empty array on failure, records error for status check
- Patreon: Falls back to offline mode if OAuth fails
- RSS: Continues if individual feeds fail

## Data Flow

**Content Discovery:**
1. Free sources (RSS) fetched and cached automatically
2. Optional Patreon source requires OAuth setup first
3. YouTube API queries channel videos for configured creators
4. Content stored in FileCache and optional memvid memory

**Search:**
1. Lexical search via minisearch (fast, indexed)
2. Optional semantic fallback via embeddings when scores below threshold
3. Results ranked by relevance score and semantic similarity

**Authentication:**
1. User initiates Patreon OAuth via `setup_patreon` tool
2. Local HTTP server awaits callback on port 9876
3. Browser opens to https://www.patreon.com/oauth2/authorize
4. Tokens exchanged and stored in system keychain
5. Tokens auto-refreshed when expired

---

*Integration audit: 2026-01-29*
