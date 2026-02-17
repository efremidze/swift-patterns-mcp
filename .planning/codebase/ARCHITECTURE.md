# Architecture

**Analysis Date:** 2026-02-17

## Pattern Overview

**Overall:** Modular MCP (Model Context Protocol) server with multi-source pattern aggregation, optional premium integrations, and hybrid search capabilities.

**Key Characteristics:**
- Dual-mode entry point (CLI or MCP server)
- Multi-source plugin architecture with free and premium sources
- Layered search combining lexical, semantic, and cross-session recall
- Configuration-driven source and feature enablement
- Handler-based tool execution with request validation

## Layers

**Entry Point Layer:**
- Purpose: Route between CLI and MCP server modes based on arguments
- Location: `src/index.ts`, `src/cli/router.ts`
- Contains: CLI command routing, interactive wizard detection, MCP server startup
- Depends on: CLI modules, server module
- Used by: Node.js runtime (package.json bin entry)

**MCP Server Layer:**
- Purpose: Implement Model Context Protocol server interface for tool registration and execution
- Location: `src/server.ts`
- Contains: MCP server setup, tool request handling, source manager initialization
- Depends on: @modelcontextprotocol/sdk, tool handlers, source manager
- Used by: MCP clients (Claude, Cursor, etc.)

**Tool Handler Layer:**
- Purpose: Implement business logic for individual tools (search, fetch, enable, setup)
- Location: `src/tools/handlers/*.ts`
- Contains: Request validation, multi-source search coordination, response formatting
- Depends on: Source registry, utilities (caching, formatting, analysis), validation
- Used by: MCP server via handler registry

**Configuration Layer:**
- Purpose: Manage source enablement, feature flags, and persistent settings
- Location: `src/config/sources.ts`, `src/config/creators.ts`, `src/config/swift-keywords.ts`
- Contains: Source definitions, configuration schema, runtime state management
- Depends on: zod for validation, file system for persistence
- Used by: Server, handlers, CLI

**Source Layer:**
- Purpose: Fetch and process patterns from RSS feeds, APIs, and external sources
- Location: `src/sources/free/*.ts`, `src/sources/premium/patreon*.ts`
- Contains: Source-specific pattern fetching, content extraction, enrichment
- Depends on: HTTP utilities, caching, parsing (RSS, HTML), analysis utilities
- Used by: Source registry, handlers

**Utility Layer:**
- Purpose: Cross-cutting concerns: caching, search, analysis, formatting, HTTP
- Location: `src/utils/*.ts`
- Contains: Pattern formatting, relevance scoring, semantic indexing, response building, HTTP with headers
- Depends on: External libraries (minisearch, transformers, pino for logging)
- Used by: All layers

**CLI Layer:**
- Purpose: Interactive setup and source management outside of MCP server
- Location: `src/cli/*.ts`
- Contains: Setup wizards, Patreon authentication, source listing
- Depends on: Source manager, HTTP utilities, interactive prompts
- Used by: index.ts when CLI subcommands are detected

## Data Flow

**Tool Request Flow:**

1. MCP client sends `CallToolRequest` to server via stdio
2. `src/server.ts` receives request, looks up handler by tool name
3. Handler in `src/tools/handlers/*.ts` validates arguments using `src/tools/validation.ts`
4. Handler executes search/fetch logic, potentially using multiple sources
5. Source registry (`src/utils/source-registry.ts`) instantiates source singletons and deduplicates concurrent requests
6. Individual source (`src/sources/free/*.ts` or `src/sources/premium/*.ts`) fetches patterns
7. Patterns are cached by `src/utils/cache.ts` to avoid redundant fetches
8. Results are processed through supplementary layers (semantic recall, memvid memory, deduplication)
9. Handler formats results using `src/utils/pattern-formatter.ts`
10. Response is serialized and sent back to MCP client

**Search Execution:**

- **Lexical Search**: Query tokenization → multi-source search via MiniSearch index → relevance scoring via quality signals
- **Semantic Recall**: Triggered when lexical results are weak or empty → lazy initialization of embedding model → semantic search → deduplication with lexical results
- **Memvid Memory**: Cross-session pattern recall from persistent memory → semantic or lexical matching → merging with current search results
- **Ranking**: Patterns ranked by relevance score, then by query overlap analysis, then by secondary signals (code presence, publish date)

**State Management:**

- **Configuration**: Persisted to `~/.config/swift-patterns-mcp/config.json` via `SourceManager`
- **Source Caches**: In-memory singleton instances of source classes keep search indexes warm
- **Search Result Caching**: Intent-based caching at `src/tools/handlers/cached-search.ts` deduplicates identical queries
- **Pattern Caches**: RSS and article content cached with TTLs via `src/utils/cache.ts` (in-memory with optional file-based fallback)
- **Semantic Index**: Lazy-loaded and kept in memory for the lifetime of the server process

## Key Abstractions

**Source Interface:**
- Purpose: Uniform interface for RSS-based and API-based pattern sources
- Examples: `src/sources/free/rssPatternSource.ts` (base class), `src/sources/free/sundell.ts` (RSS subclass), `src/sources/premium/patreon.ts` (API-based)
- Pattern: Template method pattern - subclasses define `feedUrl` and `topicKeywords`, parent handles fetch/search/cache

**ToolHandler Type:**
- Purpose: Standardized function signature for all tool implementations
- Examples: `getSwiftPatternHandler`, `searchSwiftContentHandler`, `setupPatreonHandler`
- Pattern: Async function receiving args dict and context, returning `ToolResponse` with MCP-compliant structure

**ToolContext:**
- Purpose: Dependency injection for handlers - provides access to source manager and premium sources
- Examples: Used in all handler files
- Pattern: Immutable context object passed to every handler invocation

**BasePattern Interface:**
- Purpose: Unified pattern structure across all sources
- Examples: `src/sources/free/rssPatternSource.ts`
- Pattern: All sources return patterns conforming to this interface (title, url, content, topics, relevanceScore, hasCode, etc.)

**CachedSearchIndex:**
- Purpose: Efficient search across patterns using keyword indexing
- Examples: `src/utils/search.ts` - used by each RSS source instance
- Pattern: Wraps MiniSearch library, caches results per source/query pair, invalidates on data refresh

## Entry Points

**CLI Entry Point (index.ts):**
- Location: `src/index.ts`
- Triggers: `npm start` or installed binary `swift-patterns-mcp`
- Responsibilities: Load environment, route between CLI and server based on argv

**Server Entry Point (server.ts):**
- Location: `src/server.ts`
- Triggers: `startServer()` called from index.ts when no CLI command matched
- Responsibilities: Initialize MCP server, attach tool handlers, set up prefetching, implement protocol handlers

**Tool Handlers:**
- Location: `src/tools/handlers/*.ts`
- Triggers: MCP client calls `CallToolRequest` with handler name
- Responsibilities: Validate arguments, execute search/fetch, format and return results

**CLI Commands:**
- Location: `src/cli/*.ts` (sources.ts, patreon.ts, setup.ts)
- Triggers: `swift-patterns-mcp sources`, `swift-patterns-mcp patreon`, `swift-patterns-mcp setup`
- Responsibilities: Interactive configuration, source management, Patreon authentication

## Error Handling

**Strategy:** Graceful degradation with partial results; never throw unhandled errors from handlers.

**Patterns:**

- **Promise.allSettled**: Used in `src/utils/source-registry.ts` to collect results from multiple sources even if some fail (see `searchMultipleSources`, `prefetchAllSources`, `fetchAllPatterns`)
- **Try-catch with empty fallback**: Semantic recall and memvid operations catch errors internally and return empty arrays, allowing main search to complete without interruption (see `src/tools/handlers/searchSwiftContent.ts` lines 62-93)
- **Timeout with Promise.race**: Semantic and Patreon searches wrapped in race with timeout - if semantic indexing is slow, lexical results are already returned (see `trySemanticRecall`, `SEMANTIC_TIMEOUT_MS`)
- **Validation-first**: Input validation via `src/tools/validation.ts` returns `ToolResponse` errors immediately, preventing cascading failures
- **Logging at layer boundaries**: Errors logged when crossing layer boundaries (e.g., source fetch failures in `prefetchAllSources`), reducing noise from recovered errors

## Cross-Cutting Concerns

**Logging:**
- Framework: `pino` configured in `src/utils/logger.ts`
- Approach: Structured logging with error context passed as objects; used at layer boundaries and for non-recoverable issues
- Examples: `logger.info`, `logger.warn`, `logger.error` with contextual data

**Validation:**
- Framework: `zod` for configuration schemas; custom validators in `src/tools/validation.ts` for request arguments
- Approach: Synchronous validation of inputs returns either valid value or ToolResponse error
- Examples: `validateRequiredString`, `validateOptionalNumber`, `isValidationError` guard function

**Authentication:**
- Approach: Environment variable based for Patreon (PATREON_CLIENT_ID, PATREON_CLIENT_SECRET, YOUTUBE_API_KEY)
- Credential storage: Secure keytar-based storage for tokens (via `src/sources/premium/patreon-oauth.ts`)
- Source enablement: Conditional - Patreon only added to tool list if credentials present and source enabled

**Caching:**
- Multi-level strategy: Source-level search index cache + pattern cache (RSS, articles) + intent-based result cache
- TTLs: Configurable per cache layer; defaults to 1 hour for RSS, 24 hours for articles
- Invalidation: Search index invalidated after new patterns fetched; intent cache keyed by query + sources + filters

---

*Architecture analysis: 2026-02-17*
