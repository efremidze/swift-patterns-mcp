# Architecture

**Analysis Date:** 2026-01-20

## Pattern Overview

**Overall:** MCP Server with Modular Layered Architecture and Service Aggregation

**Key Characteristics:**
- Model Context Protocol server exposing tools to Claude/AI assistants
- Plugin-based tool registration with handler registry pattern
- Plugin-based source architecture with abstract base classes
- Content aggregation from multiple free and premium sources
- Two-tier caching (memory + file) with LRU eviction
- Lazy loading of premium sources for graceful degradation

## Layers

**MCP Protocol Layer:**
- Purpose: Handle incoming tool requests from Claude and dispatch to handlers
- Contains: Server setup, tool registration, request routing
- Location: `src/index.ts`
- Depends on: Tool handlers, source registry
- Used by: External MCP clients (Claude, Cursor)

**Tool Handler Layer:**
- Purpose: Implement individual MCP tools (commands)
- Contains: Handler implementations for each tool
- Location: `src/tools/handlers/*.ts`
- Key handlers:
  - `getSwiftPattern.ts` - Query patterns by topic with quality filtering
  - `searchSwiftContent.ts` - Full-text search across sources
  - `listContentSources.ts` - List enabled/available sources
  - `enableSource.ts` - Enable/disable content sources
  - `setupPatreon.ts` - Interactive Patreon OAuth setup
  - `getPatreonPatterns.ts` - Query premium Patreon content
- Pattern: All handlers follow `ToolHandler` type signature: `(args, context) => Promise<ToolResponse>`
- Registered via: `src/tools/registry.ts`

**Source Abstraction Layer:**
- Purpose: Unified interface to content sources
- Contains: Base class, registry, configuration
- Location:
  - Base class: `src/sources/free/rssPatternSource.ts`
  - Registry: `src/utils/source-registry.ts`
  - Config: `src/config/sources.ts`
- Depends on: Utils (cache, search, analysis)
- Used by: Tool handlers

**Content Source Implementations:**
- Purpose: Fetch and process content from various sources
- Free sources (always available):
  - `src/sources/free/sundell.ts` - Swift by Sundell (RSS-based)
  - `src/sources/free/vanderlee.ts` - Antoine van der Lee (RSS-based)
  - `src/sources/free/nilcoalescing.ts` - Nil Coalescing (RSS-based)
  - `src/sources/free/pointfree.ts` - Point-Free (RSS-based, fetches full articles)
- Premium sources (require OAuth):
  - `src/sources/premium/patreon.ts` - Patreon integration
  - `src/sources/premium/youtube.ts` - YouTube video metadata
  - `src/sources/premium/patreon-oauth.ts` - OAuth2 flow
  - `src/sources/premium/patreon-dl.ts` - Local content scanning
- Depends on: Utils (cache, search, analysis), Config (keywords)
- Used by: Tool handlers via source registry

**Configuration Layer:**
- Purpose: Manage source configuration and keyword definitions
- Contains: Source definitions, creator mappings, keyword constants
- Location: `src/config/sources.ts`, `src/config/creators.ts`, `src/config/swift-keywords.ts`
- Key exports:
  - `SourceManager` class for enable/disable persistence
  - `AVAILABLE_SOURCES` registry
  - `BASE_TOPIC_KEYWORDS`, `createSourceConfig()` for customization
- Depends on: Utils (paths.ts for config persistence)
- Used by: Tool handlers, CLI commands

**Utility Layer:**
- Purpose: Shared infrastructure and cross-cutting concerns
- Contains: Caching, path resolution, search indexing, content analysis
- Location: `src/utils/*.ts`
- Key modules:
  - `cache.ts` - Two-tier caching (memory + file) with LRU eviction and TTL
  - `search.ts` - Full-text search with `CachedSearchIndex` using minisearch
  - `swift-analysis.ts` - Topic detection, code recognition, relevance scoring
  - `response-helpers.ts` - MCP response formatting
  - `pattern-formatter.ts` - Output formatting for patterns
  - `source-registry.ts` - Centralized source management
  - `paths.ts` - Config and cache directory resolution
  - `errors.ts` - Error logging
- Depends on: Node.js built-ins only
- Used by: All other layers

**CLI Layer:**
- Purpose: Command-line tools for setup and management
- Contains: Patreon OAuth setup, auth management, source management
- Location: `src/cli/`
- Key files:
  - `setup.ts` - Interactive Patreon OAuth setup wizard
  - `auth.ts` - Token management
  - `source-manager.ts` - CLI for source management
- Depends on: Config, Premium sources (oauth)
- Used by: End users via terminal

## Data Flow

**MCP Tool Request:**

1. User query arrives via MCP client (Claude/Cursor)
2. Server receives `CallToolRequestSchema` (`src/index.ts`)
3. Tool handler dispatched via registry (`src/tools/registry.ts`)
4. Handler calls appropriate source(s) via `src/utils/source-registry.ts`:
   - `get_swift_pattern` → Parallel query to enabled sources
   - `search_swift_content` → All enabled sources + SearchIndex
   - `get_patreon_patterns` → PatreonSource (conditionally loaded)
5. Source fetches data (cached or fresh via `FileCache`)
6. Content analyzed via `swift-analysis.ts`:
   - `detectTopics()` → keyword matching
   - `hasCodeContent()` → regex patterns
   - `calculateRelevance()` → weighted scoring
7. Results formatted via `pattern-formatter.ts` and `response-helpers.ts`
8. Response returned to MCP client

**Content Processing Pipeline:**

```
RSS Feed / Patreon API / YouTube API
    ↓
Parse raw data (rss-parser, JSON response)
    ↓
Cache layer (memory LRU → file TTL)
    ↓
Content analysis:
  - detectTopics() → keyword matching
  - hasCodeContent() → regex patterns
  - calculateRelevance() → weighted scoring
    ↓
Transform to BasePattern interface
    ↓
Optional: Index for search (MiniSearch)
    ↓
Return to MCP handler
```

**State Management:**
- File-based: Source config in `~/.swift-patterns-mcp/config.json`
- File-based: Cache persistence across runs
- In-memory: LRU cache for hot data (limited entries)
- No persistent in-memory state between requests

## Key Abstractions

**BasePattern:**
- Purpose: Common interface for all content items
- Examples: `SundellPattern`, `VanderLeePattern`, `PatreonPattern`
- Pattern: Interface inheritance with source-specific extensions

**RssPatternSource:**
- Purpose: Generic RSS feed processing base class
- Location: `src/sources/free/rssPatternSource.ts`
- Examples: `SundellSource`, `VanderLeeSource`, `NilCoalescingSource`, `PointFreeSource`
- Pattern: Template method - subclasses customize keywords and processing

**ToolHandler:**
- Purpose: Unified handler interface for MCP tools
- Location: `src/tools/types.ts`
- Pattern: `(args, context) => Promise<ToolResponse>`

**SourceManager:**
- Purpose: Central registry for all content sources
- Location: `src/config/sources.ts`
- Pattern: Registry with state persistence

**FileCache:**
- Purpose: Two-tier caching (memory + file) with TTL and LRU eviction
- Location: `src/utils/cache.ts`
- Instances: `rssCache`, `articleCache`
- Pattern: Write-through cache with expiration

**CachedSearchIndex:**
- Purpose: Full-text search with fuzzy matching
- Location: `src/utils/search.ts`
- Pattern: Index builder with custom tokenization using minisearch

## Entry Points

**MCP Server Entry:**
- Location: `src/index.ts`
- Triggers: MCP client connection via stdio
- Responsibilities: Register tools, handle requests, manage sources
- Bin mapping: `package.json` → `"bin": {"swift-patterns-mcp": "build/index.js"}`

**CLI Entry Points:**
- Setup: `src/cli/setup.ts` → `npm run setup`
- Auth: `src/cli/auth.ts`
- Source: `src/cli/source-manager.ts` → `npm run source`

## Error Handling

**Strategy:** Graceful degradation with structured error logging

**Patterns:**
- Premium sources conditionally loaded - missing modules don't crash server
- API failures return empty arrays (degraded but functional)
- Cache failures fall through to fresh fetch
- OAuth errors surfaced to user via CLI output
- `createErrorResponseFromError()` converts errors to MCP responses
- `logError()` for structured error logging

## Cross-Cutting Concerns

**Logging:**
- `console.log` for normal output
- `console.error` for errors
- `logError()` utility for structured logging
- No structured logging framework

**Validation:**
- TypeScript strict mode for compile-time checks
- Runtime validation minimal (trusts internal data)
- API responses assumed well-formed

**Caching:**
- RSS feeds: TTL-based expiration
- Full articles: Longer TTL
- Memory cache: LRU eviction with max entries
- OAuth tokens: Stored via keytar, auto-refresh on expiry

**Content Analysis:**
- Shared keyword definitions in `src/config/swift-keywords.ts`
- Per-source customization via `createSourceConfig()`, `mergeKeywords()`, `mergeQualitySignals()`
- Relevance scoring: 0-100 scale combining signals + code bonus (15 points)

---

*Architecture analysis: 2026-01-20*
*Update when major patterns change*
