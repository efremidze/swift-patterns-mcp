# External Integrations

**Analysis Date:** 2026-01-16

## APIs & External Services

**Patreon API v2:**
- Purpose: Retrieve patron memberships, campaign info, creator details
- SDK/Client: REST API via `node-fetch` (`src/sources/premium/patreon.ts`)
- Endpoint: `https://www.patreon.com/api/oauth2/v2`
- Auth: OAuth 2.0 Bearer token
- Required env vars: `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`

**YouTube Data API v3:**
- Purpose: Search videos, retrieve video metadata, channel videos
- SDK/Client: REST API via `node-fetch` (`src/sources/premium/youtube.ts`)
- Endpoint: `https://www.googleapis.com/youtube/v3`
- Auth: API key in query param
- Required env var: `YOUTUBE_API_KEY`
- Features: Extracts Patreon links and GitHub code links from video descriptions

**RSS Feeds (Free Sources):**
- Swift by Sundell - `https://www.swiftbysundell.com/feed.rss` (`src/sources/free/sundell.ts`)
- Antoine van der Lee - `https://www.avanderlee.com/feed/` (`src/sources/free/vanderlee.ts`)
- SDK/Client: `rss-parser` npm package

## Data Storage

**File-based Configuration:**
- Location: `~/.swift-patterns-mcp/config.json`
- Purpose: Source enable/disable state, persistent settings
- Managed by: `src/config/sources.ts` (SourceManager class)

**Patreon Content Storage:**
- Location: `~/.swift-patterns-mcp/patreon-content/`
- Purpose: Downloaded Patreon posts and attachments
- Managed by: `patreon-dl` CLI tool via `src/sources/premium/patreon-dl.ts`

**File Cache:**
- Location: `~/.swift-patterns-mcp/cache/` (namespaced: rss/, articles/)
- Purpose: RSS feeds (1h TTL), full articles (24h TTL)
- Implementation: Dual-tier memory + file cache (`src/utils/cache.ts`)

**Caching:**
- Memory cache: In-process, fast reads
- File cache: JSON files with expiration timestamps

## Authentication & Identity

**Patreon OAuth 2.0:**
- Implementation: `src/sources/premium/patreon-oauth.ts`
- OAuth endpoints:
  - Authorize: `https://www.patreon.com/oauth2/authorize`
  - Token: `https://www.patreon.com/api/oauth2/token`
- Scopes: `identity`, `identity.memberships`, `campaigns`, `campaigns.members`
- Token storage: Native OS credential storage via `keytar` package
- Local redirect: `http://localhost:9876/callback`
- Refresh token support: Auto-refresh on expiry

**Browser-based Session Extraction:**
- Implementation: `src/tools/extract-cookie.ts`
- Uses Playwright chromium to log into patreon.com
- Extracts `session_id` cookie for authentication
- Persistent browser profile: `.patreon-profile/`
- Session cookie storage: `.patreon-session` file

## Monitoring & Observability

**Error Tracking:**
- None configured (console.error only)

**Analytics:**
- None

**Logs:**
- stdout/stderr only (console.log, console.error)

## CI/CD & Deployment

**CI Pipeline:**
- GitHub Actions - `.github/workflows/ci.yml`
- Triggers: Push/PR to main branch
- Jobs: lint (tsc --noEmit), build (tsc), test (vitest)
- Node version: 20 on ubuntu-latest

**Distribution:**
- npm package: `@efremidze/swift-patterns-mcp`
- Binary command: `swift-patterns-mcp`

## Environment Configuration

**Development:**
- Required env vars: None for free sources
- Optional: `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`, `YOUTUBE_API_KEY`
- Secrets location: `.env.local` (gitignored)
- Example template: `.env.example`

**Production:**
- Same env vars as development
- All sources degrade gracefully if credentials missing

## Webhooks & Callbacks

**Incoming:**
- OAuth callback: `http://localhost:9876/callback` (local dev only)
  - Handles Patreon OAuth redirect
  - Exchanges code for access/refresh tokens

**Outgoing:**
- None

## Creator Configuration

**Patreon Creator Mappings:**
- Location: `src/config/creators.ts`
- Maps Patreon Campaign IDs to YouTube channels:
  - Kavsoft (Patreon ID: 5338573, YouTube: UCsuV4MRk_aB291SrchUVb4w)
  - sucodee (Patreon ID: 9794927, YouTube: UC9YE4KZX3z89F0LkDRXjpJg)
  - SwiftUICodes (Patreon ID: 11011366, YouTube: UCvEdo8AyAUg_LqOr8rzTTbA)

---

*Integration audit: 2026-01-16*
*Update when adding/removing external services*
