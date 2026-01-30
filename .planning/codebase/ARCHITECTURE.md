# Architecture

**Analysis Date:** 2026-01-29

## Pattern Overview

**Overall:** MCP Server + Tool Handler Registry + Modular Content Source Architecture

**Key Characteristics:**
- **MCP Protocol**: Standard Model Context Protocol server exposing callable tools to AI assistants
- **Tool Handler Registry**: Dynamic dispatch system mapping tool names to handler functions
- **Layered Source Abstraction**: Free sources (RSS-based) and premium sources (OAuth-based) with unified interface
- **Multi-Stage Data Processing**: Lexical search → semantic recall → persistent memory supplementation
- **Intent-Aware Caching**: Query normalization with source fingerprinting for intelligent cache invalidation

## Layers

**MCP Server Layer:**
- Purpose: Protocol implementation and stdio transport handling
- Location: `src/index.ts`
- Contains: Server initialization, tool list generation, request routing
- Depends on: Tool handlers, SourceManager, MCP SDK
- Used by: AI assistants (Claude, Cursor, etc.) via stdio

**Tool Handler Layer:**
- Purpose: Implements individual tool logic for end-user queries
- Location: `src/tools/handlers/`
- Contains: Six handler implementations (getSwiftPattern, searchSwiftContent, listContentSources, enableSource, setupPatreon, getPatreonPatterns)
- Depends on: Source registry, intent cache, memvid memory, pattern formatters
- Used by: MCP server request dispatcher

**Handler Registry:**
- Purpose: Dynamic tool handler registration and lookup
- Location: `src/tools/registry.ts`
- Contains: Simple Map-based handler store with register/get/has functions
- Depends on: Nothing (pure registry)
- Used by: MCP server, imported handlers

**Source Layer - Free Sources:**
- Purpose: Aggregate Swift/iOS content from public RSS feeds
- Location: `src/sources/free/`
- Contains: RssPatternSource (base class), SundellSource, VanderLeeSource, NilCoalescingSource, PointFreeSource
- Depends on: rss-parser, HTTP utilities, cache layer, Swift analysis utilities
- Used by: Source registry, search handlers

**Source Layer - Premium Sources:**
- Purpose: Authenticated access to creator Patreon content
- Location: `src/sources/premium/`
- Contains: PatreonSource, OAuth flow, YouTube API integration for creator verification
- Depends on: Keytar (secure credential storage), OAuth utilities, HTTP client, file download
- Used by: Tool handlers when Patreon is enabled

**Source Registry:**
- Purpose: Centralized source instantiation, deduplication, and batch search coordination
- Location: `src/utils/source-registry.ts`
- Contains: Source singleton cache, in-flight deduplication, multi-source search orchestration
- Depends on: Source classes, InflightDeduper
- Used by: Tool handlers

**Search & Indexing Layer:**
- Purpose: Full-text search with stemming, fuzzy matching, and field boosting
- Location: `src/utils/search.ts`
- Contains: SearchIndex<T> with MiniSearch, smart tokenization with stemming
- Depends on: MiniSearch, natural (Porter Stemmer), search-terms utilities
- Used by: Free sources, intent cache, semantic recall

**Intent Cache Layer:**
- Purpose: Cache tool handler results by normalized query intent
- Location: `src/utils/intent-cache.ts`
- Contains: IntentCache class, query normalization, source fingerprinting
- Depends on: FileCache, InflightDeduper, search-terms
- Used by: Tool handlers for response caching

**File Cache Layer:**
- Purpose: Hybrid memory+disk caching with TTL and periodic cleanup
- Location: `src/utils/cache.ts`
- Contains: FileCache (in-memory LRU + JSON files), cleanup scheduler
- Depends on: quick-lru, crypto, file system
- Used by: RSS cache, article cache, intent cache

**Semantic Recall Layer:**
- Purpose: AI-powered supplemental search when lexical results are weak
- Location: `src/utils/semantic-recall.ts`
- Contains: SemanticRecallIndex using transformers-based embeddings
- Depends on: @xenova/transformers, SearchIndex
- Used by: searchSwiftContent handler (optional, with timeout)

**Persistent Memory Layer:**
- Purpose: Cross-session pattern storage with semantic recall capability
- Location: `src/utils/memvid-memory.ts`
- Contains: MemvidMemoryManager wrapping @memvid/sdk
- Depends on: @memvid/sdk, paths utilities
- Used by: Tool handlers for long-term pattern accumulation

**Configuration Layer:**
- Purpose: Source metadata, config initialization, Swift keyword definitions
- Location: `src/config/`
- Contains: sources.ts (source registry), swift-keywords.ts (topic detection), creators.ts (Patreon creators)
- Depends on: Zod for validation, file system
- Used by: SourceManager, tool handlers, source classes

**CLI Layer:**
- Purpose: Command-line tools for setup, authentication, and source management
- Location: `src/cli/`
- Contains: setup.ts (Patreon OAuth flow), auth.ts, source-manager.ts
- Depends on: SourceManager, OAuth utilities, readline for interactive prompts
- Used by: npm scripts (setup, auth, source commands)

## Data Flow

**Search Flow (get_swift_pattern, search_swift_content):**

1. User invokes tool with query/topic
2. Handler builds IntentKey (tool + normalized query + sources + minQuality)
3. Handler checks IntentCache
   - **Cache Hit**: Return formatted cached patterns
   - **Cache Miss**: Proceed to step 4
4. Handler calls searchMultipleSources() → SourceRegistry
5. SourceRegistry gets/creates source instances (singleton cache)
6. Each source's searchPatterns() executes:
   - Lexical search via SearchIndex (MiniSearch + stemming)
   - Applies topic detection and quality scoring
   - Returns matching BasePattern[] objects
7. Results aggregated across sources, deduplicated
8. Optional: If enabled and lexical results weak, SemanticRecallIndex runs in parallel
9. Optional: If enabled, MemvidMemoryManager supplements results from persistent memory
10. Results sorted by relevance score
11. Handler formats results via pattern-formatter utilities
12. Handler caches final results in IntentCache
13. Handler returns formatted text response to MCP server

**Patreon Setup Flow (setup_patreon):**

1. User runs `npm run setup`
2. CLI interactive prompt collects OAuth approval
3. startOAuthFlow() initiates browser OAuth flow
4. Patreon authorization → auth code exchanged for tokens
5. Tokens stored securely via keytar (OS credential storage)
6. SourceManager marks patreon as enabled

**Tool Availability Flow:**

1. MCP server starts in index.ts
2. Dynamic tool list generation based on enabled sources:
   - CORE_TOOLS always included (get_swift_pattern, search_swift_content, etc.)
   - PATREON_TOOLS added only if patreon source is enabled
3. ListToolsRequestSchema handler returns tool list
4. AI assistant receives available tools and can invoke them

**State Management:**

- **Source State**: Stored in SourceManager config + keytar for credentials
- **Cache State**: FileCache on disk (~/.swift-mcp/cache/), TTL-based expiration
- **Intent Cache State**: FileCache + query normalization for detection of equivalent searches
- **Persistent Memory State**: Memvid database file (~/.swift-mcp/swift-patterns-memory.mv2)
- **In-Flight Requests**: InflightDeduper map, per-handler (prevents duplicate concurrent fetches)

## Key Abstractions

**BasePattern:**
- Purpose: Unified pattern representation across all sources
- Examples: `src/sources/free/rssPatternSource.ts`, `src/tools/types.ts`
- Pattern: Interface with id, title, url, content, topics, relevanceScore, hasCode
- Used by: All sources, handlers, cache layer, semantic recall

**RssPatternSource<T extends BasePattern>:**
- Purpose: Base class for free sources that fetch via RSS feeds
- Examples: `src/sources/free/sundell.ts`, `src/sources/free/vanderlee.ts`
- Pattern: Abstract class defining processRssItem, processArticle, topic detection, quality calculation
- Extensible: Subclasses only define feedUrl, topicKeywords, qualitySignals

**SourceManager:**
- Purpose: Central configuration and state for all content sources
- Examples: `src/config/sources.ts`
- Pattern: Singleton managing AVAILABLE_SOURCES, enabled/disabled states, env var validation
- Used by: Index.ts, handlers, CLI

**ToolHandler:**
- Purpose: Type-safe async function signature for tool implementations
- Pattern: `(args: Record<string, unknown>, context: ToolContext) => Promise<ToolResponse>`
- Used by: Registry, all handler implementations

**SearchIndex<T>:**
- Purpose: Full-text search with stemming and fuzzy matching
- Pattern: Wraps MiniSearch with custom tokenizer (Porter Stemmer) and field boosting
- Used by: Free sources' search, semantic recall, intent cache deduplication

**IntentKey:**
- Purpose: Components for cache key generation and query equivalence detection
- Pattern: Records tool name, normalized query, sources, minQuality, requireCode
- Used by: Intent cache to detect when two searches should return same cached results

**MemvidMemoryManager:**
- Purpose: Persistent cross-session pattern storage
- Pattern: Lazy-initialized wrapper around @memvid/sdk with store/search methods
- Used by: Tool handlers for enriching results with historically accessed patterns

## Entry Points

**MCP Server (stdio):**
- Location: `src/index.ts`
- Triggers: Node.js startup via CLI (npx swift-patterns-mcp)
- Responsibilities: Protocol handler setup, tool registration, stdio transport, prefetch orchestration

**Tool Handlers:**
- Location: `src/tools/handlers/*.ts`
- Triggers: ListToolsRequestSchema (tool enumeration) or CallToolRequestSchema (tool invocation)
- Responsibilities: Argument validation, source search/fetch, caching, response formatting

**Setup CLI:**
- Location: `src/cli/setup.ts`
- Triggers: `npm run setup`
- Responsibilities: OAuth flow for Patreon, token storage, credential validation

**Source Manager CLI:**
- Location: `src/cli/source-manager.ts`
- Triggers: `npm run source`
- Responsibilities: Enable/disable sources, list status, clear caches

## Error Handling

**Strategy:** Graceful degradation with informative fallbacks

**Patterns:**
- **Network Errors** (RSS fetch, OAuth, HTTP): Log and return empty results or cached fallback
- **Missing Config** (Patreon credentials): Tool unavailable with helpful message
- **Search Failures** (MiniSearch errors): Fall back to empty results
- **Semantic Recall Timeout** (5s): Best-effort supplementation; timeouts don't block lexical results
- **Memvid Errors** (persistent memory): Logged as warnings but don't interrupt searches
- **Handler Errors** (unknown tool, invalid args): createErrorResponseFromError wraps in MCP ToolResponse

## Cross-Cutting Concerns

**Logging:** Pino logger at `src/utils/logger.ts`, configured via LOG_LEVEL env var, service tagged as 'swift-patterns-mcp'

**Validation:** Zod schemas in config layer for env vars and source metadata; handler args validated by tool definitions

**Authentication:** Keytar secure storage for Patreon OAuth tokens; fallback to local .env for development

**Deduplication:**
- In-flight request deduplication via InflightDeduper (prevents duplicate concurrent fetches)
- Pattern deduplication by ID in multi-source aggregation
- Semantic recall filters by existing ID to avoid duplicate results

**Performance Optimization:**
- Singleton source instances with warm search indexes
- LRU memory cache layer above file cache (quick-lru)
- RSS and article caches with configurable TTLs
- Intent cache for query-level result caching
- Semantic recall timeout (5s) to prevent blocking

**Configuration:**
- Environment variables (PATREON_CLIENT_ID, PATREON_CLIENT_SECRET, YOUTUBE_API_KEY, LOG_LEVEL)
- SourceManager handles enabled/disabled source state
- Swift keywords and quality signals configured per source

---

*Architecture analysis: 2026-01-29*
