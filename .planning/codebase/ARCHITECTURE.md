# Architecture

**Analysis Date:** 2026-01-16

## Pattern Overview

**Overall:** MCP Server with Plugin-based Content Aggregation

**Key Characteristics:**
- Model Context Protocol server exposing tools to Claude/AI assistants
- Plugin-based source architecture with common interfaces
- Content aggregation from multiple free and premium sources
- Lazy loading of premium sources for graceful degradation

## Layers

**MCP Protocol Layer:**
- Purpose: Handle incoming tool requests from Claude and dispatch to handlers
- Contains: Server setup, tool registration, request routing
- Location: `src/index.ts`
- Depends on: All other layers
- Used by: External MCP clients (Claude, Cursor)

**Configuration & State Layer:**
- Purpose: Manage source configuration and persistent settings
- Contains: Source registry, creator mappings, keyword definitions
- Location: `src/config/sources.ts`, `src/config/creators.ts`, `src/config/swift-keywords.ts`
- Depends on: Utils (paths.ts for config persistence)
- Used by: MCP handlers, CLI commands

**Content Source Layer:**
- Purpose: Fetch and process content from various sources
- Contains: RSS parsers, Patreon integration, YouTube integration
- Location: `src/sources/free/`, `src/sources/premium/`
- Depends on: Utils (cache, search, analysis), Config (keywords)
- Used by: MCP tool handlers

**Content Analysis Layer:**
- Purpose: Analyze content for topics, code, and relevance
- Contains: Topic detection, code pattern matching, relevance scoring
- Location: `src/utils/swift-analysis.ts`, `src/utils/search.ts`
- Depends on: Config (swift-keywords)
- Used by: Source layer, MCP handlers

**Utility Layer:**
- Purpose: Shared infrastructure and helpers
- Contains: Caching, path resolution, search indexing
- Location: `src/utils/`
- Depends on: Node.js built-ins only
- Used by: All other layers

**CLI Layer:**
- Purpose: Command-line tools for setup and management
- Contains: Patreon OAuth setup, auth management, source management
- Location: `src/cli/`
- Depends on: Config, Premium sources (oauth)
- Used by: End users via terminal

## Data Flow

**MCP Tool Request:**

1. User query arrives via MCP client (Claude/Cursor)
2. Server receives `CallToolRequestSchema` (`src/index.ts`)
3. Tool handler dispatched based on tool name
4. Handler calls appropriate source(s):
   - `get_swift_pattern` → SundellSource, VanderLeeSource
   - `search_swift_content` → All enabled sources + SearchIndex
   - `get_patreon_patterns` → PatreonSource (conditionally loaded)
5. Source fetches data (cached or fresh)
6. Content analyzed: topics detected, code checked, relevance scored
7. Results formatted and returned to MCP client

**Content Processing Pipeline:**

```
RSS Feed / Patreon API / YouTube API
    ↓
Parse raw data (rss-parser, JSON response)
    ↓
Cache layer (memory → file)
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
- In-memory: Caches cleared on restart
- No persistent in-memory state between requests

## Key Abstractions

**BasePattern:**
- Purpose: Common interface for all content items
- Examples: `SundellPattern`, `VanderLeePattern`, `PatreonPattern`
- Pattern: Interface inheritance with source-specific extensions

**RssPatternSource:**
- Purpose: Generic RSS feed processing base class
- Examples: `SundellSource`, `VanderLeeSource` (`src/sources/free/`)
- Pattern: Template method - subclasses customize keywords and processing

**SourceManager:**
- Purpose: Central registry for all content sources
- Examples: Singleton-like class instance in `src/config/sources.ts`
- Pattern: Registry with state persistence

**FileCache:**
- Purpose: Two-tier caching (memory + file) with TTL
- Examples: `rssCache`, `articleCache` (`src/utils/cache.ts`)
- Pattern: Write-through cache with expiration

**SearchIndex:**
- Purpose: Full-text search with fuzzy matching
- Examples: Created per search request (`src/utils/search.ts`)
- Pattern: Index builder with custom tokenization and stemming

## Entry Points

**MCP Server Entry:**
- Location: `src/index.ts`
- Triggers: MCP client connection via stdio
- Responsibilities: Register tools, handle requests, manage sources

**CLI Entry Points:**
- Setup: `src/cli/setup.ts` (Patreon OAuth wizard)
- Auth: `src/cli/auth.ts` (Reset authentication)
- Source: `src/cli/source-manager.ts` (Enable/disable sources)

## Error Handling

**Strategy:** Graceful degradation with silent failures for non-critical paths

**Patterns:**
- Premium sources conditionally loaded - missing modules don't crash server
- API failures return empty arrays (degraded but functional)
- Cache failures fall through to fresh fetch
- OAuth errors surfaced to user via CLI output

## Cross-Cutting Concerns

**Logging:**
- console.log for normal output
- console.error for errors
- No structured logging framework

**Validation:**
- TypeScript strict mode for compile-time checks
- Runtime validation minimal (trusts internal data)
- API responses assumed well-formed

**Caching:**
- RSS feeds: 1 hour TTL
- Full articles: 24 hour TTL
- OAuth tokens: Stored via keytar, auto-refresh on expiry

**Content Analysis:**
- Shared keyword definitions in `src/config/swift-keywords.ts`
- Per-source customization via `mergeKeywords()` and `mergeQualitySignals()`
- Relevance scoring: 0-100 scale combining signals + code bonus

---

*Architecture analysis: 2026-01-16*
*Update when major patterns change*
