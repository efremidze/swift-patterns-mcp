# swift-patterns-mcp - Complete Directory Structure

```
swift-patterns-mcp/
│
├── package.json                      # NPM package configuration
├── tsconfig.json                     # TypeScript compiler config
├── .gitignore                        # Git ignore rules
├── LICENSE                           # MIT License
├── README.md                         # Main documentation
├── QUICKSTART.md                     # 2-minute quick start guide
│
├── docs/                             # Documentation
│   ├── PATREON_SETUP.md             # Patreon integration guide
│   ├── CONTRIBUTING.md              # Contribution guidelines (TODO)
│   └── ARCHITECTURE.md              # Technical architecture (TODO)
│
├── src/                              # Source code
│   │
│   ├── index.ts                      # Main MCP server entry point
│   │
│   ├── config/                       # Configuration
│   │   └── sources.ts               # Source management system
│   │
│   ├── sources/                      # Content sources
│   │   │
│   │   ├── free/                    # Free sources (no auth)
│   │   │   ├── sundell.ts           # Swift by Sundell RSS
│   │   │   ├── vanderlee.ts         # Antoine van der Lee RSS
│   │   │   └── pointfree.ts         # Point-Free OSS (TODO)
│   │   │
│   │   └── premium/                 # Premium sources (require auth)
│   │       ├── patreon.ts           # Patreon OAuth integration (TODO)
│   │       ├── patreon-oauth.ts     # OAuth handler (TODO)
│   │       ├── patreon-zip.ts       # Zip extraction (TODO)
│   │       └── github-sponsors.ts   # GitHub Sponsors (TODO)
│   │
│   ├── tools/                        # MCP tool handlers (TODO)
│   │   ├── get-pattern.ts           # Pattern retrieval
│   │   ├── search.ts                # Search functionality
│   │   └── source-manager.ts        # Source management
│   │
│   └── cli/                          # CLI commands
│       ├── setup.ts                 # Setup wizard
│       ├── auth.ts                  # Authentication utilities
│       └── source-manager.ts        # Source enable/disable
│
├── build/                            # Compiled TypeScript (generated)
│   └── (generated .js files)
│
└── node_modules/                     # Dependencies (generated)
    └── (npm packages)
```

## File Descriptions

### Root Level

| File | Purpose |
|------|---------|
| `package.json` | NPM package config, dependencies, scripts |
| `tsconfig.json` | TypeScript compiler configuration |
| `.gitignore` | Files to exclude from git |
| `LICENSE` | MIT License |
| `README.md` | Main project documentation |
| `QUICKSTART.md` | Quick start guide for users |

### `/docs`

| File | Purpose | Status |
|------|---------|--------|
| `PATREON_SETUP.md` | Patreon integration guide | ✅ Done |
| `CONTRIBUTING.md` | How to contribute | 📝 TODO |
| `ARCHITECTURE.md` | Technical architecture docs | 📝 TODO |

### `/src`

| File | Purpose | Status |
|------|---------|--------|
| `index.ts` | Main MCP server, tool handlers | ✅ Done |

### `/src/config`

| File | Purpose | Status |
|------|---------|--------|
| `sources.ts` | Source management, enable/disable | ✅ Done |

### `/src/sources/free`

| File | Purpose | Status |
|------|---------|--------|
| `sundell.ts` | Swift by Sundell RSS integration | ✅ Done |
| `vanderlee.ts` | Antoine van der Lee RSS | ✅ Done |
| `pointfree.ts` | Point-Free GitHub integration | 📝 TODO |

### `/src/sources/premium`

| File | Purpose | Status |
|------|---------|--------|
| `patreon.ts` | Main Patreon integration | 📝 TODO |
| `patreon-oauth.ts` | OAuth 2.0 flow handler | 📝 TODO |
| `patreon-zip.ts` | Zip file extraction | 📝 TODO |
| `github-sponsors.ts` | GitHub Sponsors API | 📝 TODO |

### `/src/tools` (TODO)

| File | Purpose |
|------|---------|
| `get-pattern.ts` | Handle get_swift_pattern tool |
| `search.ts` | Handle search_swift_content tool |
| `source-manager.ts` | Handle source management tools |

### `/src/cli`

| File | Purpose |
|------|---------|
| `setup.ts` | Interactive setup wizard |
| `auth.ts` | Reset Patreon authentication data |
| `source-manager.ts` | CLI for managing sources |

## Configuration Files

### `~/.swift-patterns-mcp/` (User's Home Directory)

```
~/.swift-patterns-mcp/
├── config.json              # User's source configuration
├── patreon-meta.json       # Patreon metadata (if enabled)
└── patreon-code-cache/     # Cached extracted code
    ├── abc123.json         # Extracted zip metadata
    └── def456.json
```

### System Keychain

```
System Keychain (macOS/Windows/Linux)
└── ios-mcp-patreon
    ├── access-token        # Encrypted Patreon access token
    └── refresh-token       # Encrypted refresh token
```

## Build Output

### `/build` (Generated by `npm run build`)

```
build/
├── index.js                 # Compiled main server
├── index.d.ts              # Type definitions
├── config/
│   └── sources.js
├── sources/
│   ├── free/
│   │   ├── sundell.js
│   │   └── vanderlee.js
│   └── premium/
│       └── patreon.js
└── (other compiled files)
```

## Environment Variables

```bash
# Optional - for Patreon integration
PATREON_CLIENT_ID=your_client_id
PATREON_CLIENT_SECRET=your_client_secret
PATREON_REDIRECT_URI=http://localhost:3000/patreon/callback

# Optional - for GitHub Sponsors (future)
GITHUB_TOKEN=your_github_token

# Optional - for YouTube API (future)
YOUTUBE_API_KEY=your_youtube_key
```

## Data Flow

```
User Query
    ↓
MCP Server (index.ts)
    ↓
Source Manager (config/sources.ts)
    ↓
├─→ Free Sources
│   ├─→ sundell.ts → RSS Feed → Patterns
│   └─→ vanderlee.ts → RSS Feed → Patterns
│
└─→ Premium Sources (if enabled)
    └─→ patreon.ts → OAuth → API → Patterns
        └─→ patreon-zip.ts → Extract Code
    ↓
Format & Return
    ↓
AI Assistant
```

## File Sizes (Approximate)

| File | Lines | Size |
|------|-------|------|
| `src/index.ts` | ~250 | 8KB |
| `src/config/sources.ts` | ~200 | 7KB |
| `src/sources/free/sundell.ts` | ~100 | 3KB |
| `src/sources/free/vanderlee.ts` | ~100 | 3KB |
| `src/sources/premium/patreon.ts` | ~400 | 15KB |
| `src/sources/premium/patreon-zip.ts` | ~300 | 12KB |
| `README.md` | ~400 | 15KB |
| **Total** | ~1,750 | ~63KB |

## Required Files (Minimum Working Version)

To get a working MCP, you need at minimum:

```
✅ package.json
✅ tsconfig.json
✅ src/index.ts
✅ src/config/sources.ts
✅ src/sources/free/sundell.ts
✅ src/sources/free/vanderlee.ts
```

Everything else is optional enhancements!

## Next Files to Create (Priority Order)

1. **High Priority** (Core functionality)
   - [ ] `src/sources/premium/patreon.ts` - Patreon integration
   - [ ] `src/sources/premium/patreon-oauth.ts` - OAuth handler

2. **Medium Priority** (Enhanced features)
   - [ ] `src/sources/premium/patreon-zip.ts` - Zip extraction
   - [ ] `src/sources/free/pointfree.ts` - GitHub integration

3. **Low Priority** (Nice to have)
   - [ ] `docs/CONTRIBUTING.md` - Contribution guide
   - [ ] `docs/ARCHITECTURE.md` - Technical docs
   - [ ] `src/tools/` - Refactor tools into separate files

## Dependencies (from package.json)

### Production
- `@modelcontextprotocol/sdk` - MCP protocol
- `node-fetch` - HTTP requests
- `rss-parser` - RSS feed parsing
- `adm-zip` - Zip file handling
- `keytar` - Secure credential storage

### Development
- `typescript` - TypeScript compiler
- `@types/node` - Node.js types

## Installation & Build

```bash
# Install dependencies
npm install

# Build TypeScript → JavaScript
npm run build

# Watch mode (development)
npm run watch

# Run locally
node build/index.js
```

## Testing the Structure

```bash
# Verify all files exist
find src -name "*.ts" -type f

# Check for TypeScript errors
npm run build

# Run the server
node build/index.js
```
