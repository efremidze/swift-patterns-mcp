# Patreon OAuth Integration Design

## Overview

Full Patreon integration for swift-patterns-mcp, enabling users to access premium Swift/iOS content from creators they support.

## Files

| File | Purpose |
|------|---------|
| `src/sources/premium/patreon-oauth.ts` | OAuth flow, token management, refresh |
| `src/sources/premium/patreon-zip.ts` | Zip download, extraction, parsing |
| `src/sources/premium/patreon.ts` | Update with full API client |
| `src/cli/setup.ts` | Interactive setup wizard |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        swift-patterns-mcp CLI                            │
│                    swift-patterns-mcp setup --patreon                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     src/cli/setup.ts                            │
│              Interactive Setup Wizard                           │
│  - Launches OAuth flow                                          │
│  - Auto-detects Swift/iOS creators                              │
│  - Confirms creator selection                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│patreon-oauth │ │  patreon.ts  │ │ patreon-zip  │
│    .ts       │ │   (updated)  │ │    .ts       │
│              │ │              │ │              │
│ OAuth flow   │ │ API client   │ │ Extract zips │
│ Token mgmt   │ │ Post fetch   │ │ Parse content│
│ Refresh      │ │ Search       │ │              │
└──────┬───────┘ └──────┬───────┘ └──────────────┘
       │                │
       ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ~/.swift-patterns-mcp/                                │
│  ├── config.json      (enabled creators, preferences)          │
│  ├── tokens.json      (encrypted via keytar master key)        │
│  └── cache/                                                     │
│      ├── posts/       (cached API posts as JSON)               │
│      └── zips/        (extracted zip content)                  │
└─────────────────────────────────────────────────────────────────┘
```

## OAuth Flow (patreon-oauth.ts)

### Sequence

1. User runs: `swift-patterns-mcp setup --patreon`
2. CLI starts local server on `localhost:9876`
3. Opens browser to Patreon authorization URL:
   ```
   https://www.patreon.com/oauth2/authorize?
     client_id=<CLIENT_ID>
     &redirect_uri=http://localhost:9876/callback
     &response_type=code
     &scope=identity campaigns campaigns.members
   ```
4. User authorizes, Patreon redirects to `localhost:9876/callback?code=XXX`
5. CLI exchanges code for tokens via `POST /api/oauth2/token`
6. Tokens stored encrypted in `~/.swift-patterns-mcp/tokens.json` (master key in system keychain via keytar)
7. Local server shuts down, CLI continues to creator selection

### Token Management

- Access token expires in 31 days
- Refresh token used to get new access token automatically
- On each API call, check expiry and refresh if needed
- If refresh fails, prompt user to re-authenticate

### Scopes

- `identity` - Get user info
- `campaigns` - List creators they follow
- `campaigns.members` - Get membership/tier details

### Security

- Tokens encrypted at rest (AES-256, key in keychain)
- Local callback server binds only to 127.0.0.1
- Server auto-closes after 60 seconds if no callback

## API Client (patreon.ts)

### Interface

```typescript
class PatreonSource {
  // Core methods
  async fetchPatterns(creatorId?: string): Promise<PatreonPattern[]>
  async searchPatterns(query: string): Promise<PatreonPattern[]>

  // Creator management
  async getSubscribedCreators(): Promise<Creator[]>
  async detectSwiftCreators(): Promise<Creator[]>

  // Internal
  private async fetchPosts(creatorId: string): Promise<RawPost[]>
  private async fetchAttachments(postId: string): Promise<Attachment[]>
  private extractPatternMetadata(post: RawPost): PatternMetadata
  private fallbackContentScan(content: string): PatternMetadata
}
```

### Pattern Extraction (Metadata-First)

1. Check post title for Swift keywords
   - "Building a SwiftUI Navigation Stack" → topics: [swiftui, navigation]
2. Check Patreon tags/labels if present
   - tags: ["swift", "ios"] → merge into topics
3. Fallback: Scan content for code blocks
   - Find ```swift blocks → hasCode: true
   - Extract @State, async, etc. → add to topics

No relevance scoring - sort results by date (newest first).

### Caching

- Posts cached in `~/.swift-patterns-mcp/cache/posts/<creator_id>/`
- Cache expires after 24 hours
- Force refresh with `--no-cache` flag

## Zip Extraction (patreon-zip.ts)

### Interface

```typescript
class PatreonZipExtractor {
  async extractFromPost(post: RawPost): Promise<PatreonPattern[]>

  private async downloadZip(url: string, postId: string): Promise<string>
  private extractZip(zipPath: string, destDir: string): void
  private parseExtractedContent(dir: string): PatreonPattern[]
  private detectFileType(filePath: string): 'swift' | 'markdown' | 'playground' | 'other'
}
```

### Extraction Flow

1. Post has attachment with mime type `application/zip`
   - Download to `~/.swift-patterns-mcp/cache/zips/<post_id>.zip`
2. Extract zip contents to `~/.swift-patterns-mcp/cache/zips/<post_id>/`
3. Scan extracted files:
   - `*.swift` → Parse as code, extract to pattern
   - `*.md` → Parse as tutorial, extract code blocks
   - `*.playground` → Treat as Swift code
   - other → Ignore
4. Build PatreonPattern for each meaningful file

### Limits

- Max zip size: 50MB (skip larger with warning)
- Max files per zip: 100 (prevent zip bombs)
- Cache extracted content indefinitely (user can clear manually)

## Setup Wizard (cli/setup.ts)

### User Experience

```
$ swift-patterns-mcp setup --patreon

🔐 Patreon Setup
━━━━━━━━━━━━━━━━

Step 1/3: Authentication
Opening browser for Patreon authorization...
✓ Authenticated as @username

Step 2/3: Detecting Swift/iOS Creators
Scanning your subscriptions...

Found 3 potential Swift/iOS creators:
  ✓ [1] Sean Allen (@seanallen) - iOS Development
  ✓ [2] Paul Hudson (@twostraws) - Swift Tutorials
    [3] Some Other Creator - General Tech

Toggle numbers to change selection, or press Enter to confirm: 3

Updated:
  ✓ [1] Sean Allen
  ✓ [2] Paul Hudson
  ✓ [3] Some Other Creator

Press Enter to confirm:

Step 3/3: Initial Sync
Fetching content from 3 creators...
  Sean Allen: 24 posts (3 with code)
  Paul Hudson: 156 posts (89 with code)
  Some Other Creator: 12 posts (0 with code)

✅ Setup complete!

Found 192 posts across 3 creators.
Use 'get_patreon_patterns' in your AI assistant to search them.
```

### Auto-Detection Logic

1. Fetch all subscribed campaigns via API
2. Check campaign name/description for keywords: swift, swiftui, ios, apple, xcode, uikit
3. Check creator's post titles (sample last 5)
4. Pre-select creators with 2+ keyword matches
5. Show all creators, let user toggle

### CLI Implementation

- Use Node.js readline for interactive input
- No external dependencies
- Support `--non-interactive` flag for CI (uses auto-detected defaults)

## Error Handling

### OAuth Errors

| Error | Handling |
|-------|----------|
| User denies authorization | Show message, exit gracefully |
| Callback timeout (60s) | Kill server, prompt to retry |
| Invalid client credentials | Clear error message with setup instructions |
| Token refresh fails | Prompt to re-authenticate |

### API Errors

| Error | Handling |
|-------|----------|
| Rate limited (429) | Retry with exponential backoff, max 3 attempts |
| Unauthorized (401) | Trigger token refresh, retry once |
| Creator removed/blocked | Skip creator, warn user, continue with others |
| Network failure | Retry once, then fail with clear message |

### Zip Errors

| Error | Handling |
|-------|----------|
| Zip > 50MB | Skip with warning, continue |
| Corrupt zip | Skip with warning, continue |
| > 100 files | Extract first 100, warn about limit |
| Extraction fails | Log error, skip this attachment |

### Graceful Degradation

- If one creator fails, others still load
- If zip extraction fails, API posts still work
- If cache is corrupted, delete and re-fetch
- Always prefer partial results over complete failure

## Dependencies

Already in package.json (no new dependencies needed):
- `keytar` - token encryption
- `adm-zip` - zip extraction
