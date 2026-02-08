# Architecture

**Analysis Date:** 2026-02-07

## Pattern Overview

**Overall:** Model Context Protocol (MCP) Server with pluggable content sources

**Key Characteristics:**
- Request-response server using MCP SDK (stdio transport)
- Tool-based API where handlers are registered in a central registry
- Layered separation: MCP protocol → Tool handlers → Source layer → Utilities
- Support for both free (RSS-based) and premium (Patreon/YouTube) content sources
- Optional features: semantic recall, intent caching, memvid integration

## Layers

**MCP Server Layer:**
- Purpose: Exposes tools to the MCP client via Model Context Protocol
- Location: `src/index.ts`
- Contains: Server initialization, tool definitions, request routing
- Depends on: Tool registry, source manager, response helpers
- Used by: Claude AI or other MCP-compatible clients

**Tool Handler Layer:**
- Purpose: Implements business logic for each MCP tool
- Location: `src/tools/handlers/*.ts`
- Contains: Handler functions that process tool arguments and return formatted responses
- Depends on: Source registry, formatters, caches, response helpers
- Used by: MCP server's CallToolRequestSchema handler

**Tool Registry:**
- Purpose: Central registration and dispatch of tool handlers
- Location: `src/tools/registry.ts`
- Contains: Map-based handler lookup by tool name
- Depends on: Type definitions
- Used by: MCP server to resolve which handler to call

**Source Management Layer:**
- Purpose: Manages configuration of enabled sources (free/premium) and their credentials
- Location: `src/config/sources.ts`
- Contains: SourceManager class controlling source enable/disable, config persistence
- Depends on: File system, zod validation, environment variables
- Used by: Tool handlers to determine which sources to query

**Source Registry Layer:**
- Purpose: Consolidates source instances and deduplicates requests across handlers
- Location: `src/utils/source-registry.ts`
- Contains: Singleton cache of source instances, in-flight deduplication
- Depends on: Source classes
- Used by: Tool handlers (getSwiftPattern, searchSwiftContent)

**Content Source Layer:**
- Purpose: Fetches and processes patterns from external feeds or APIs
- Location: `src/sources/free/*.ts` (Sundell, VanderLee, NilCoalescing, PointFree), `src/sources/premium/*.ts` (Patreon, YouTube)
- Contains: RSS-based sources extending RssPatternSource, Patreon OAuth handler
- Depends on: HTTP clients, RSS parser, caching utilities
- Used by: Source registry and handlers

**Base Pattern Source:**
- Purpose: Abstract base for RSS-fed content sources
- Location: `src/sources/free/rssPatternSource.ts`
- Contains: RSS parsing, content fetching, topic detection, relevance scoring
- Depends on: rss-parser, cache, HTTP utilities, swift-analysis utilities
- Used by: All free source implementations

**Utility Layers:**
- **Caching:** `src/utils/cache.ts` - File-based LRU cache with TTL and memory layer
- **Search:** `src/utils/search.ts` - MiniSearch with stemming and fuzzy matching
- **Semantic Recall:** `src/utils/semantic-recall.ts` - Optional embeddings-based search fallback
- **Pattern Formatting:** `src/utils/pattern-formatter.ts` - Consistent response formatting
- **Response Helpers:** `src/utils/response-helpers.ts` - MCP-compliant response creation
- **Error Handling:** `src/utils/errors.ts` - Structured error logging
- **Logging:** `src/utils/logger.ts` - Pino logger for structured output
- **Intent Cache:** `src/utils/intent-cache.ts` - Caches search results by intent key
- **Memvid Memory:** `src/utils/memvid-memory.ts` - Optional persistent memory storage

## Data Flow

**Tool Execution Flow:**

1. MCP client calls tool (e.g., `get_swift_pattern` with topic and optional source)
2. Server's CallToolRequestSchema handler receives request
3. Handler resolution: `getHandler(name)` looks up handler in registry (from `src/tools/registry.ts`)
4. Handler execution: Handler function receives args and ToolContext (sourceManager, patreonSource)
5. Source lookup: Handler calls `searchMultipleSources()` from source registry
6. Source deduplication: If same query already in-flight, wait for existing result
7. Source instance retrieval: Get singleton source instance, use cached search index if available
8. Pattern fetching: Source calls `fetchPatterns()` on RSS feed with caching
9. Pattern processing: RSS items → parsed patterns with topics, relevance scores, code detection
10. Results filtering: Apply quality thresholds, cache results in intent cache
11. Response formatting: Apply pattern formatter for consistent output structure
12. Optional enhancements: Semantic recall or memvid storage if enabled
13. Return: MCP-compliant ToolResponse with formatted text content

**State Management:**

- **Source instances:** Singleton cache in source registry maintains warm search indexes
- **In-flight requests:** Deduplication prevents simultaneous identical source fetches
- **Search caches:** Each source maintains CachedSearchIndex of indexed patterns
- **File caches:** RSS content cached to disk with TTL, reducing external API calls
- **Intent cache:** Search results cached by query+sources+quality, shared across identical requests
- **Config persistence:** SourceManager reads/writes config from `~/.config/swift-patterns-mcp/` on demand
- **Semantic index:** Singleton instance built on first use, then reused for semantic recall

## Key Abstractions

**RssPatternSource (Abstract Base):**
- Purpose: Template for fetching patterns from RSS feeds
- Examples: `src/sources/free/sundell.ts`, `src/sources/free/vanderlee.ts`
- Pattern: Template method with hooks for topic detection, quality scoring, full article fetching
- Subclasses provide: Feed URL, topic keywords, quality signals specific to each source

**BasePattern (Data Model):**
- Purpose: Standardized pattern representation across all sources
- Location: `src/sources/free/rssPatternSource.ts`
- Fields: id, title, url, publishDate, excerpt, content, topics[], relevanceScore, hasCode
- Used by: All handlers, caches, formatters, semantic recall

**ToolHandler (Functional Pattern):**
- Purpose: (args, context) => Promise<ToolResponse>
- Examples: `src/tools/handlers/getSwiftPattern.ts`, `src/tools/handlers/searchSwiftContent.ts`
- Pattern: Validate args → build intent key → check caches → fetch/search → format → return
- Consistent flow enables cache layering and optional features

**Source Registry Singleton:**
- Purpose: Coordinates source requests and caches
- Functions: getSource(), searchMultipleSources(), fetchAllPatterns()
- In-flight deduplication via InflightDeduper prevents duplicate work

**SearchIndex & CachedSearchIndex:**
- Purpose: Fast pattern searching using MiniSearch with stemming
- Stores: Indexed patterns from a source with fuzzy matching
- Strategy: Invalidate and rebuild when source data changes

**FileCache:**
- Purpose: Two-tier caching (memory LRU + disk-based with TTL)
- Operations: get(key, ttl), set(key, value, ttl), clear()
- Background cleanup removes expired entries periodically

## Entry Points

**MCP Server Entry Point:**
- Location: `src/index.ts`
- Triggers: npm start or swift-patterns-mcp (binary)
- Responsibilities:
  - Route CLI subcommands (sources, patreon) before starting server
  - Initialize SourceManager and load enabled sources
  - Auto-detect Patreon credentials and enable if configured
  - Register all tool handlers on import
  - Create MCP Server, attach handlers, start on stdio
  - Optionally prefetch all sources and embedding models on startup

**Tool Handlers (Via MCP):**
- `get_swift_pattern`: Search free sources by topic
- `search_swift_content`: Full-text search across all enabled sources
- `list_content_sources`: Show source status
- `enable_source`: Enable a source (requires setup for premium)
- `setup_patreon`: OAuth flow for Patreon access
- `get_patreon_patterns`: Search premium Patreon content

**CLI Entry Points:**
- Location: `src/cli/sources.ts`, `src/cli/patreon.ts`
- Triggers: `swift-patterns-mcp sources` or `swift-patterns-mcp patreon`
- Responsibilities: Manage source configuration and Patreon authentication outside MCP

## Error Handling

**Strategy:** Graceful degradation with structured logging

**Patterns:**
- RSS fetch failures: Log error, return empty array (allows partial results when some sources fail)
- Source fetch timeouts: Promise.allSettled collects partial results from available sources
- Semantic recall timeouts: 5-second timeout, returns empty if semantic model loads slow
- Invalid tool args: Return helpful error response with usage examples
- Handler errors: Caught in server, wrapped in createErrorResponseFromError()
- Cache errors: Logged silently, service continues with fresh fetch
- OAuth failures: Return user-friendly error with setup instructions

## Cross-Cutting Concerns

**Logging:** Pino structured logger with context/error details. Used in source fetching, cache operations, error handling.

**Validation:** Zod schemas for source config parsing. Ensures config file validity on load.

**Caching Strategy:** Multi-layer caching reduces API calls:
1. Intent cache (full results by query+sources+quality)
2. Source search indexes (warm on first query, reused)
3. RSS feed cache (1-hour TTL on disk)
4. Article cache (fetched HTML cached to avoid re-fetching)
5. In-flight deduplication (concurrent identical requests await same promise)

**Error Context:** All errors logged with context (source name, query, feed URL) for debugging.

**Type Safety:** TypeScript strict mode with zod validation for untrusted data.

**Optional Features Toggle:**
- Prefetch on startup: `sourceManager.isPrefetchEnabled()`
- Semantic recall: Enabled via config, 5-second timeout to prevent slowdowns
- Memvid integration: `sourceManager.isMemvidEnabled()` gating
- All features degrade gracefully if disabled or slow

---

*Architecture analysis: 2026-02-07*
