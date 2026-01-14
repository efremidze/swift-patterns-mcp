# ADR: Hybrid YouTube + Patreon Content Access

**Date:** 2026-01-14
**Status:** Accepted
**Author:** swift-mcp team

## Context

swift-mcp needs to provide users access to premium Swift/SwiftUI content from
Patreon creators they already support (Kavsoft, etc.). The goal is to surface
relevant code patterns and tutorials without requiring users to manually browse
multiple platforms.

Three constraints drove the architecture:

1. **Patreon API limitations** - The official OAuth API provides membership
   metadata but does not expose post content or file attachments (zips, source code)
2. **Authentication complexity** - OAuth tokens alone don't grant access to
   download protected files
3. **Discovery problem** - Users don't know which Patreon posts contain relevant
   code; there's no searchable index of Swift content across creators

## Alternatives Considered

### Option 1: Patreon OAuth API Only (Rejected)

Use Patreon's official OAuth API to fetch posts and content.

**Why rejected:**
- API returns post metadata (title, publish date, teaser text) but NOT:
  - Full post content for patron-only posts
  - File attachments (zip files, source code)
  - Direct download URLs
- Would only provide a "table of contents" with no actual content

### Option 2: Status Quo - Manual User Downloads

Users manually download content from Patreon, swift-mcp indexes local files.

**Why rejected:**
- Poor user experience
- No discoverability - users must know which posts to download
- Defeats the purpose of an integrated assistant

## Decision

Adopt a hybrid architecture combining three components:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DISCOVERY LAYER                              │
│  YouTube Data API → Search videos → Extract Patreon links from       │
│                     descriptions                                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AUTHORIZATION LAYER                            │
│  Patreon OAuth API → Verify user has active membership to creator   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CONTENT LAYER                                │
│  patreon-dl + session cookie → Download posts, extract zips,        │
│                                index Swift files                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Works

1. **YouTube as discovery index** - Creators like Kavsoft post tutorial videos
   with Patreon links in descriptions. YouTube's search API provides the
   discoverability that Patreon lacks.

2. **OAuth for authorization check** - Before attempting downloads, verify the
   user is an active patron. Prevents wasted requests and provides clear error
   messages.

3. **patreon-dl for content access** - Existing open-source tool that uses
   browser session cookies to download patron-only content. Solves the file
   access problem without reinventing authentication.

## Security & Privacy

### Principles

1. **User owns their session** - The session cookie is extracted from the user's
   own browser via Playwright. No credentials are shared or stored centrally.

2. **Respects Patreon access control** - Only downloads content the user has
   legitimate access to as a paying patron. Non-patrons cannot bypass the paywall.

3. **Local-only storage** - OAuth tokens stored in system keychain (macOS Keychain,
   etc.). Session cookies and downloaded content stored locally in `~/.swift-mcp/`.
   Nothing uploaded to external servers.

### Authentication Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  extract-cookie  │     │   OAuth Flow     │     │   patreon-dl     │
│                  │     │                  │     │                  │
│ Playwright opens │     │ Browser opens    │     │ Uses session_id  │
│ persistent       │────▶│ Patreon OAuth    │────▶│ cookie to        │
│ browser profile  │     │ consent page     │     │ download files   │
│                  │     │                  │     │                  │
│ Saves session_id │     │ Tokens stored    │     │ Content saved to │
│ to .patreon-     │     │ in keychain      │     │ ~/.swift-mcp/    │
│ session          │     │                  │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

## Implementation Components

| Component | File | Purpose |
|-----------|------|---------|
| YouTube client | `src/sources/premium/youtube.ts` | Search videos, extract Patreon links |
| Creator registry | `src/config/creators.ts` | Map creators to YouTube channels + Patreon IDs |
| OAuth handler | `src/sources/premium/patreon-oauth.ts` | Membership verification, token management |
| Cookie extractor | `src/tools/extract-cookie.ts` | Playwright persistent browser for session |
| Content downloader | `src/sources/premium/patreon-dl.ts` | Wrapper for patreon-dl, content indexing |
| Main orchestrator | `src/sources/premium/patreon.ts` | Combines all layers, returns patterns |

## Consequences

### Positive
- Users get seamless access to content they already pay for
- Discovery via YouTube search makes content findable
- Leverages existing tools (patreon-dl) rather than building from scratch
- Respects creator paywalls and Patreon ToS

### Negative
- Requires two auth mechanisms (OAuth + session cookie)
- Depends on creators linking Patreon in YouTube descriptions
- Session cookies expire; users may need to re-authenticate periodically

### Risks
- YouTube API quotas could limit search volume
- patreon-dl is third-party; could break if Patreon changes their site
- Persistent browser profile stores sensitive data locally
