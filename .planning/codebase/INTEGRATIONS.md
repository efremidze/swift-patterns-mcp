# External Integrations

**Analysis Date:** 2026-02-17

## APIs & External Services

**Patreon:**
- Service: Patreon creator monetization platform
- What it's used for: Fetching premium Swift patterns and tutorials from Patreon creators
  - SDK/Client: Custom OAuth client in `src/sources/premium/patreon-oauth.ts`
  - Auth: OAuth 2.0 with PKCE flow
  - Environment variables: `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`
  - Scopes: `identity`, `identity.memberships`, `campaigns`, `campaigns.members`
  - Token storage: System keychain (via keytar) at service name `swift-patterns-mcp`, account `patreon-tokens`
  - Token refresh: Automatic, with 5-minute buffer before expiry
  - Endpoints:
    - OAuth authorize: `https://www.patreon.com/oauth2/authorize`
    - Token exchange: `https://www.patreon.com/api/oauth2/token`
  - Callback: Local HTTP server on port 9876 (macOS only)

**YouTube Data API v3:**
- Service: Google YouTube Data API
- What it's used for: Searching for Swift tutorial videos and extracting metadata
  - Client: Fetch-based API client at `src/sources/premium/youtube.ts`
  - Auth: API key from environment
  - Environment variable: `YOUTUBE_API_KEY`
  - Base URL: `https://www.googleapis.com/youtube/v3`
  - Endpoints used:
    - `search.list` - Video search with timeout (10 seconds)
    - `videos.list` - Video details retrieval
  - Response extraction: Extracts Patreon links and GitHub code links from video descriptions
  - Cache: 1-hour TTL via FileCache at `src/utils/cache.ts`

**RSS Feeds:**
- Service: Various RSS/Atom feeds
- What it's used for: Aggregating Swift content from blogs (SwiftLee, Point-Free, etc.)
  - Client: `rss-parser` (npm package)
  - Feeds configured at `src/config/sources.ts`
  - Cache: 1-hour TTL for feed lists, 24-hour TTL for full articles
  - Article fetching: Full HTML extraction with `linkedom` for DOM parsing
  - User-agent: `swift-patterns-mcp/1.0 (RSS Reader)`

**Patreon Content Download (patreon-dl):**
- Service: External `patreon-dl` CLI tool (npm package @3.6.0)
- What it's used for: Downloading Swift files and posts from Patreon
  - Execution: Via child process (`execFile`)
  - Cookie authentication: Patreon session cookie stored at `.patreon-session` (validated for format)
  - Download location: OS-specific directory via `getPatreonContentDir()`
  - File types extracted: Swift code, ZIP archives, Markdown files, other attachments
  - Timeout: Implicit (inherits from patreon-dl behavior)
  - Used by: `src/sources/premium/patreon-dl.ts`

## Data Storage

**Caching:**
- Provider: Local filesystem + in-memory LRU
- Implementation: `src/utils/cache.ts` - `FileCache` class
- Features:
  - Two-tier cache: Fast in-memory (QuickLRU) with fallback to disk
  - JSON serialization for persistence
  - TTL-based expiration with periodic cleanup (1-hour interval)
  - Deduplication of in-flight requests (prevents duplicate fetches)
  - Cache directory: OS home directory at `.swift-patterns-mcp/cache/`
  - Namespaced instances:
    - `rssCache` - RSS feed caching (namespace: `rss`)
    - `articleCache` - Article HTML caching (namespace: `articles`)
    - `youtubeCache` - YouTube API response caching (namespace: `youtube`)

**Semantic Memory:**
- Provider: Memvid (binary format file storage)
- Implementation: `src/utils/memvid-memory.ts` - `MemvidMemoryManager` class
- Storage location: `.swift-patterns-mcp/swift-patterns-memory.mv2`
- Features:
  - Persistent semantic memory across sessions
  - Full-text and semantic search modes
  - Pattern metadata: ID, source, author, publish date, relevance score, code detection
  - Embedding model: In-process via `@xenova/transformers`
  - URI format: `mv2://patterns/{source}/{patternId}`
  - Graceful degradation: Failures don't break the main application flow
  - Singleton access: `getMemvidMemory()`

**File Storage:**
- Patreon content: Downloaded to OS-specific directory
  - macOS/Linux: `~/.swift-patterns-mcp/patreon-content/`
  - Windows: Equivalent user directory
- Swift extraction: Files analyzed for code content detection

## Authentication & Identity

**Auth Provider:**
- Type: Custom OAuth 2.0 implementation
- Protocol: Patreon OAuth 2.0 with PKCE code challenge
- Flow:
  1. Generate state and code verifier on startup
  2. Launch browser to authorization URL
  3. Local HTTP callback server receives authorization code
  4. Exchange code for access and refresh tokens
  5. Store tokens in system keychain
  6. Automatic refresh before expiry with 5-minute buffer
- Token storage: System credential store via `keytar`
  - Service: `swift-patterns-mcp`
  - Account: `patreon-tokens`
  - Format: JSON-serialized `PatreonTokens` object
  - Fallback: None (tokens don't persist without system credential store)
- macOS-only: Browser opening via `open` command
- Timeout: 60 seconds for OAuth callback

**Token Management:**
- File at `src/sources/premium/patreon-oauth.ts`
- Functions:
  - `startOAuthFlow()` - Initiates browser-based OAuth
  - `getValidAccessToken()` - Returns token, refreshes if needed
  - `refreshAccessToken()` - Refresh token exchange
  - `saveTokens()` - Persist to keychain
  - `loadTokens()` - Load from keychain
  - `clearTokens()` - Remove tokens
  - `isTokenExpired()` - Check if refresh needed

## Monitoring & Observability

**Logging:**
- Framework: Pino structured JSON logger
- Implementation: `src/utils/logger.ts`
- Levels: Debug, Info, Warn, Error
- Output: STDOUT (structured JSON format)
- Used throughout for:
  - Source initialization
  - Cache behavior
  - API call errors
  - OAuth flow status
  - Memvid memory operations

**Error Handling:**
- Centralized error utilities at `src/utils/errors.ts`
- Strategy: Graceful degradation
  - Failed integrations don't block other sources
  - Error responses formatted for MCP clients
  - User-friendly error messages

## CI/CD & Deployment

**Hosting:**
- npm package registry
- Published as: `swift-patterns-mcp`

**CI Pipeline:**
- Platform: GitHub Actions
- Workflow: `.github/workflows/ci.yml`
- Trigger: Push to main, pull requests
- Steps:
  1. Node 20 setup with npm cache
  2. Install dependencies
  3. Lint (ESLint + TypeScript strict mode check)
  4. Build (tsc compilation)
  5. Test with coverage gate (30% statement, 25% branch, 30% function, 30% line thresholds)

**Release Pipeline:**
- Workflow: `.github/workflows/release.yml`
- Trigger: Version tag or release creation
- Steps: Automated npm publish

**Integration Tests:**
- Workflow: `.github/workflows/integration-tests.yml`
- Separate from CI for long-running tests
- Environment: Uses CI flag to mock keytar (prevents credential store dependency)

## Environment Configuration

**Required env vars:**

Core (always required):
- None strictly required for basic MCP server startup

Patreon integration (required to enable):
- `PATREON_CLIENT_ID` - OAuth application ID
- `PATREON_CLIENT_SECRET` - OAuth application secret

Premium search features (required for YouTube search):
- `YOUTUBE_API_KEY` - Google Cloud API key with YouTube Data API enabled

GitHub integration (optional):
- `GITHUB_TOKEN` - GitHub API token for Point-Free source (optional, gracefully falls back)

**Secrets location:**
- Runtime environment variables loaded by `dotenv` from `.env` file
- Patreon tokens: System keychain (macOS Keychain, Linux libsecret, Windows Credential Manager)
- Configuration: Persisted by SourceManager in `.swift-patterns-mcp/config.json`

**Loading precedence:**
- `src/index.ts` imports `dotenv/config` at top level
- CLI commands import `dotenv/config` explicitly
- Environment checked at initialization time via `process.env[varName]`

## Webhooks & Callbacks

**Incoming:**
- Patreon OAuth callback: `http://localhost:9876/callback`
  - Receives authorization code and state parameter
  - Validates state for CSRF protection
  - Returns success/error page to browser

**Outgoing:**
- None (read-only integrations)

---

*Integration audit: 2026-02-17*
