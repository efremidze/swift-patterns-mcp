# Codebase Structure

**Analysis Date:** 2026-01-20

## Directory Layout

```
swift-mcp/
├── src/                          # TypeScript source code
│   ├── index.ts                  # MCP server entry point
│   ├── cli/                      # CLI commands
│   ├── config/                   # Configuration and constants
│   ├── integration/              # Integration tests
│   ├── sources/                  # Content source implementations
│   │   ├── free/                 # Free sources (RSS-based)
│   │   └── premium/              # Premium sources (Patreon, YouTube)
│   ├── tools/                    # Tool handlers & registry
│   │   └── handlers/             # Individual tool implementations
│   └── utils/                    # Shared utilities
├── build/                        # Compiled JavaScript output
├── .github/                      # GitHub Actions workflows
├── .planning/                    # Project planning documents
│   └── codebase/                 # Codebase analysis docs
├── docs/                         # Documentation
├── package.json                  # Project manifest
├── tsconfig.json                 # TypeScript configuration
└── eslint.config.js              # ESLint configuration
```

## Directory Purposes

**src/**
- Purpose: All TypeScript source code (51 files)
- Contains: Entry point, modules organized by function
- Key files: `index.ts` (MCP server main)
- Subdirectories: cli, config, integration, sources, tools, utils

**src/cli/**
- Purpose: Command-line interface tools
- Contains: Setup wizard, auth management, source management
- Key files:
  - `setup.ts` - Patreon OAuth configuration wizard
  - `auth.ts` - Reset authentication data
  - `source-manager.ts` - Enable/disable content sources

**src/config/**
- Purpose: Configuration files and registries
- Contains: Source definitions, creator mappings, keyword constants
- Key files:
  - `sources.ts` - SourceManager class and AVAILABLE_SOURCES registry
  - `sources.test.ts` - SourceManager tests
  - `creators.ts` - Patreon creator ID to YouTube channel mappings
  - `swift-keywords.ts` - BASE_TOPIC_KEYWORDS, BASE_QUALITY_SIGNALS, createSourceConfig()

**src/tools/**
- Purpose: Tool handlers and registry
- Contains: Handler registry, type definitions, individual handlers
- Key files:
  - `index.ts` - Barrel export, handler registration
  - `registry.ts` - getHandler(), registerHandler()
  - `registry.test.ts` - Registry unit tests
  - `types.ts` - ToolHandler, ToolResponse, ToolContext types
  - `extract-cookie.ts` - Cookie extraction utility

**src/tools/handlers/**
- Purpose: Individual tool handler implementations (6 handlers)
- Contains: One file per MCP tool
- Key files:
  - `getSwiftPattern.ts` - Query patterns by topic with quality filtering
  - `searchSwiftContent.ts` - Full-text search across sources
  - `listContentSources.ts` - List enabled/available sources
  - `enableSource.ts` - Enable/disable content sources
  - `setupPatreon.ts` - Interactive Patreon OAuth setup
  - `getPatreonPatterns.ts` - Query premium Patreon content
  - `handlers.test.ts` - Handler unit tests

**src/sources/free/**
- Purpose: Free content sources (no auth required)
- Contains: RSS-based source implementations
- Key files:
  - `rssPatternSource.ts` - Abstract base class for RSS sources
  - `rssPatternSource.test.ts` - Base class tests
  - `sundell.ts` - Swift by Sundell source
  - `sundell.test.ts` - Sundell source tests
  - `vanderlee.ts` - Antoine van der Lee source
  - `vanderlee.test.ts` - VanderLee source tests
  - `nilcoalescing.ts` - Nil Coalescing source
  - `pointfree.ts` - Point-Free source (fetches full articles)
  - `pointfree.test.ts` - PointFree source tests

**src/sources/premium/**
- Purpose: Premium content sources (auth required)
- Contains: Patreon integration, YouTube integration
- Key files:
  - `patreon.ts` - Main Patreon source implementation
  - `patreon.test.ts` - Integration tests (conditional)
  - `patreon-oauth.ts` - OAuth 2.0 token management
  - `patreon-dl.ts` - Downloaded content scanning
  - `patreon-zip.ts` - ZIP file extraction for attachments
  - `youtube.ts` - YouTube Data API integration

**src/utils/**
- Purpose: Shared utilities and helpers
- Contains: Caching, search, analysis, path resolution
- Key files:
  - `cache.ts` - FileCache class with memory + file layers, LRU eviction
  - `search.ts` - CachedSearchIndex with MiniSearch integration
  - `search.test.ts` - Search index tests
  - `swift-analysis.ts` - detectTopics(), hasCodeContent(), calculateRelevance()
  - `swift-analysis.test.ts` - Analysis function tests
  - `response-helpers.ts` - MCP response formatting
  - `pattern-formatter.ts` - Format patterns for display
  - `source-registry.ts` - getSources(), searchMultipleSources()
  - `paths.ts` - Cross-platform config directory resolution
  - `errors.ts` - Error logging utilities
  - `http.ts` - HTTP utilities (fetchText, buildHeaders)
  - `concurrency.ts` - Concurrency utilities

**src/integration/**
- Purpose: Integration tests
- Contains: End-to-end MCP client tests, response validation
- Key files:
  - `mcp-client.test.ts` - End-to-end MCP client tests
  - `response-quality.test.ts` - Response quality validation
  - `test-client.ts` - Test client utility

**build/**
- Purpose: Compiled JavaScript output
- Contains: ES2022 JavaScript files mirroring src/ structure
- Source: Generated by `tsc` from src/
- Committed: No (in .gitignore)

**.github/workflows/**
- Purpose: CI/CD pipeline configuration
- Contains: GitHub Actions workflow files
- Key files: `ci.yml` - Lint, build, test on push/PR

## Key File Locations

**Entry Points:**
- `src/index.ts` - MCP server main entry (shebang `#!/usr/bin/env node`)
- `src/cli/setup.ts` - CLI setup command (`npm run setup`)
- `src/cli/auth.ts` - CLI auth command
- `src/cli/source-manager.ts` - CLI source command (`npm run source`)

**Configuration:**
- `tsconfig.json` - TypeScript compiler options (ES2022, Node16 module)
- `eslint.config.js` - ESLint rules (flat config)
- `package.json` - Dependencies, scripts, bin config
- `.env.example` - Environment variable template

**Core Logic:**
- `src/tools/registry.ts` - Tool handler registry
- `src/config/sources.ts` - Source orchestration and SourceManager
- `src/config/swift-keywords.ts` - Keyword configurations
- `src/sources/free/rssPatternSource.ts` - RSS processing base class
- `src/sources/premium/patreon.ts` - Patreon integration
- `src/utils/swift-analysis.ts` - Content analysis pipeline
- `src/utils/cache.ts` - Two-tier caching system
- `src/utils/search.ts` - Full-text search

**Testing:**
- `src/tools/handlers.test.ts` - Handler unit tests
- `src/tools/registry.test.ts` - Registry tests
- `src/config/sources.test.ts` - SourceManager tests
- `src/sources/free/*.test.ts` - Source implementation tests
- `src/utils/search.test.ts` - Search index tests
- `src/utils/swift-analysis.test.ts` - Analysis function tests
- `src/integration/*.test.ts` - Integration tests

**Documentation:**
- `README.md` - User-facing installation and usage
- `CLAUDE.md` - Instructions for Claude Code
- `.planning/` - Planning documents and codebase map

## Naming Conventions

**Files:**
- `camelCase.ts` - Standard modules (`rssPatternSource.ts`, `swiftAnalysis.ts`)
- `kebab-case.ts` - Multi-word utilities (`source-manager.ts`, `patreon-oauth.ts`)
- `*.test.ts` - Test files co-located with source
- `UPPERCASE.md` - Important documentation files

**Directories:**
- lowercase for all directories
- Plural for collections: `sources/`, `utils/`, `tools/`, `handlers/`
- Singular for namespaces: `config/`, `cli/`, `integration/`

**Special Patterns:**
- `index.ts` - Entry point and barrel exports
- No `__tests__/` directory (tests co-located)
- Handler files match tool names: `getSwiftPattern.ts`, `searchSwiftContent.ts`

## Where to Add New Code

**New Content Source:**
- Free source: `src/sources/free/{name}.ts` extending `RssPatternSource`
- Premium source: `src/sources/premium/{name}.ts`
- Tests: `src/sources/{free|premium}/{name}.test.ts`
- Register in: `src/config/sources.ts` (AVAILABLE_SOURCES)
- Add keywords: `src/config/swift-keywords.ts` (use createSourceConfig())

**New MCP Tool:**
- Handler: `src/tools/handlers/{toolName}.ts`
- Types: Add to `src/tools/types.ts` if needed
- Register: Import and register in `src/tools/index.ts`
- Tests: Add to `src/tools/handlers.test.ts`

**New CLI Command:**
- Implementation: `src/cli/{command}.ts`
- Add script to `package.json`
- Update README with usage

**New Utility:**
- Implementation: `src/utils/{name}.ts`
- Tests: `src/utils/{name}.test.ts`
- Pure functions, minimal dependencies
- Export named functions

## Special Directories

**~/.swift-patterns-mcp/ (User Home):**
- Purpose: Runtime configuration and cache
- Contents:
  - `config.json` - Source enable/disable state
  - `cache/` - Cached RSS feeds and articles
  - `patreon-content/` - Downloaded Patreon posts
- Committed: No (user's home directory)

**.patreon-profile/ (Project Root):**
- Purpose: Persistent Playwright browser profile
- Source: Created by extract-cookie.ts
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-01-20*
*Update when directory structure changes*
