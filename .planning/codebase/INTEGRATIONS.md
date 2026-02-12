# External Integrations

**Analysis Date:** 2026-02-09

## APIs & External Services

**Patreon:**
- Purpose: Access creator content (videos, code) for premium Swift learning patterns
- SDK/Client: Custom OAuth flow + fetch-based API calls
- Auth: `PATREON_CLIENT_ID` + `PATREON_CLIENT_SECRET` env vars
- Implementation: `src/sources/premium/patreon-oauth.ts`, `src/sources/premium/patreon.ts`
- Endpoints:
  - OAuth: `https://www.patreon.com/oauth2/authorize` (authZ)
  - Token: `https://www.patreon.com/api/oauth2/token` (token exchange & refresh)
  - API: `https://www.patreon.com/api/` (identity, memberships, campaigns)
- Scopes: `identity`, `identity.memberships`, `campaigns`, `campaigns.members`
- Token Storage: System keyring (keytar) with fallback to in-memory
- Token Refresh: Automatic 5-min before expiry, `PATREON_TOKEN_URL`
- Session: Playwright persistent context stores cookies in `.patreon-profile/`

**YouTube Data API v3:**
- Purpose: Search for video content from creator channels
- SDK/Client: Direct HTTP requests via `undici`
- Auth: `YOUTUBE_API_KEY` env var (API key)
- Implementation: `src/sources/premium/youtube.ts`
- Endpoints:
  - Search: `https://www.googleapis.com/youtube/v3/search`
  - Videos: `https://www.googleapis.com/youtube/v3/videos`
- Query params: `key`, `q`, `channelId`, `part=snippet`, `maxResults`
- Caching: 1-hour TTL in `cache/youtube/`
- Error tracking: Module-level `YouTubeStatus` for tracking API failures
- Timeout: 10 seconds per request

**RSS Feeds:**
- Purpose: Parse free Swift learning content from curated blogs
- SDK/Client: rss-parser 3.13.0
- Sources: Multiple (Sundell, van der Lee, Nil Coalescing, Point Free)
- Implementation: `src/sources/free/rssPatternSource.ts` (base class)
- Feed URLs configured in: `src/config/sources.ts`
- Caching: RSS metadata cached 1 hour, article content cached 24 hours
- Full article fetching: Optional `fetchFullArticle` via `linkedom` DOM parsing
- HTML cleaning: `string-strip-html` for content extraction

## Data Storage

**Databases:**
- None (no traditional database)

**File Storage:**
- Local filesystem only
- Cache directory: `~/.swift-patterns-mcp/`
  - Structure: `.planning/cache/{rss,articles,youtube,semantic-embeddings}/`
  - Files: JSON format with TTL expiration metadata
- Implementation: `src/utils/cache.ts` (`FileCache` class)
  - Memory + file hybrid cache (LRU + persistent)
  - Automatic cleanup of expired entries (1-hour intervals)

**Persistent Memory:**
- Memvid database: `~/.swift-patterns-mcp/swift-patterns-memory.mv2`
- Purpose: Cross-session semantic memory of searched patterns
- Features:
  - Full-text search + semantic similarity search
  - Automatic deduplication
  - Embedding vectors cached separately
- Implementation: `src/utils/memvid-memory.ts` (`MemvidMemoryManager`)
- Auto-store: Enabled by default when searching (`autoStore` config)

**Caching:**
- Memory: QuickLRU (configurable max entries, default 100)
- File: `.swift-patterns-mcp/cache/{namespace}/{hash}.json`
- Cache deduplication: Prevents duplicate in-flight fetches (`async-cache-dedupe`)
- TTL: Configurable per entry (default 24 hours)

## Authentication & Identity

**Auth Provider:**
- Patreon OAuth 2.0 (primary)
- Custom implementation: `src/sources/premium/patreon-oauth.ts`

**Auth Flow:**
- Type: Authorization Code flow
- Redirect URI: `http://localhost:9876/callback` (local HTTP server)
- Browser launch: Platform-specific (macOS only: `execFile('open', ...)`)
- Token exchange: POST to `/api/oauth2/token`
- Token refresh: Automatic using refresh token
- Session timeout: 60 seconds for OAuth flow completion
- Token validation: Checked before API calls, auto-refreshed if expired

**Credential Storage:**
- Keytar (system keyring):
  - Service: `swift-patterns-mcp`
  - Account: `patreon-tokens`
  - Encrypted storage per platform (Keychain/Credential Manager/libsecret)
- Fallback: In-memory only (tokens lost on restart)
- Legacy: `~/.swift-patterns-mcp/tokens.json` (cleaned up by migration)

## Monitoring & Observability

**Error Tracking:**
- None (no external service)

**Logs:**
- Framework: Pino 9.5.0 (structured logging)
- Implementation: `src/utils/logger.js`
- Log levels: debug, info, warn, error
- Output: stdout/stderr
- Format: JSON (Pino default)
- No external log aggregation

**YouTube API Error Tracking:**
- Module-level state tracking: `YouTubeStatus`
- Captures: Last error message + timestamp
- Used for: Diagnostics in handler responses
- Query: `getYouTubeStatus()` in `src/sources/premium/youtube.ts`

## CI/CD & Deployment

**Hosting:**
- Not a hosted service (local CLI tool + MCP server)
- Distribution: npm package (`swift-patterns-mcp`)
- Deployment: Via npm install locally

**CI Pipeline:**
- None detected (no GitHub Actions, no CI config)
- Manual: `npm run lint`, `npm run test`, `npm run build`

## Environment Configuration

**Required env vars (optional features):**
- `PATREON_CLIENT_ID` - Get from: https://www.patreon.com/portal/registration/register-clients
- `PATREON_CLIENT_SECRET` - Get from: https://www.patreon.com/portal/registration/register-clients
- `YOUTUBE_API_KEY` - Get from: https://console.cloud.google.com/apis/credentials

**Config env vars (optional, via SourceManager):**
- `SWIFT_PATTERNS_SKIP_WIZARD` - Skip interactive setup (set to '1')
- `MEMVID_ENABLED` - Enable semantic memory (SourceManager config)
- `SEMANTIC_RECALL_ENABLED` - Enable embedding-based search (SourceManager config)

**Secrets location:**
- `.env` file (not committed, `gitignore`d)
- `.env.example` - Template for required vars
- Patreon tokens: System keyring (encrypted)

## Webhooks & Callbacks

**Incoming:**
- OAuth callback: `http://localhost:9876/callback` (local HTTP server)
  - Method: GET with `code` or `error` query param
  - Response: HTML success/error page, auto-closes browser
  - Duration: Server closes after callback received or 60-second timeout

**Outgoing:**
- None

## Browser Automation

**Playwright 1.58.0:**
- Purpose: Extract Patreon session cookies
- Implementation: `src/tools/extract-cookie.ts`
- Browser: Chromium
- Profile directory: `.patreon-profile/` (persistent context)
- Usage:
  - Launches browser for Patreon login
  - Waits for `session_id` cookie
  - Saves to `.patreon-session` file
  - macOS platform only (CLI tool limitation)

## Search & Content Analysis

**Full-Text Search:**
- Framework: minisearch 7.2.0
- Implementation: `src/utils/search.ts` (`CachedSearchIndex`)
- Indexes: title, content, topics
- Cache: In-memory with invalidation on new fetches

**Semantic Search:**
- Framework: @xenova/transformers 2.17.2
- Model: Xenova/all-MiniLM-L6-v2 (ONNX format)
- Similarity: ml-distance cosine similarity
- Implementation: `src/utils/semantic-recall.ts`
- Caching: Embeddings cached 7 days per pattern
- Fallback: Graceful degradation if embeddings fail

**NLP Analysis:**
- Framework: natural 8.1.0
- Used for: Tokenization, stemming, topic detection
- Implementation: `src/utils/swift-analysis.ts`
- Topic keywords: Hardcoded in `src/config/creators.ts`

---

*Integration audit: 2026-02-09*
