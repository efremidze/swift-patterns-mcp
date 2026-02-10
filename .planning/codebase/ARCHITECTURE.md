# Architecture

**Analysis Date:** 2026-02-09

## Pattern Overview

**Overall:** Model Context Protocol (MCP) Server with layered handler-based architecture

**Key Characteristics:**
- Request/response pattern using MCP SDK (Model Context Protocol)
- Handler registry system for decoupled tool implementations
- Source abstraction layer supporting free and premium content providers
- Multi-level caching with semantic search fallback
- Persistent cross-session memory via Memvid integration

## Layers

**Entry Point & Server Layer:**
- Purpose: Initialize MCP server, CLI routing, and request handling
- Location: `src/index.ts`
- Contains: Server setup, tool registration, MCP request/response handling
- Depends on: MCP SDK, tool handlers, source manager, config
- Used by: MCP clients (Claude, Cursor, etc.)

**Tool Handler Layer:**
- Purpose: Implement MCP tool logic and client-facing interfaces
- Location: `src/tools/handlers/`
- Contains: Core handlers (get_swift_pattern, search_swift_content, list_content_sources, enable_source) and premium handlers (get_patreon_patterns, setup_patreon)
- Depends on: Source registry, response helpers, caching, validation
- Used by: MCP server request dispatcher

**Source Abstraction Layer:**
- Purpose: Provide consistent interface for content providers (free and premium)
- Location: `src/sources/free/` and `src/sources/premium/`
- Contains: RSS-based free sources (Sundell, van der Lee, Nil Coalescing, Point-Free) and Patreon premium source
- Depends on: HTTP utilities, cache, content analysis
- Used by: Tool handlers, source registry

**Configuration & State Layer:**
- Purpose: Manage source configuration, feature flags, and user preferences
- Location: `src/config/sources.ts`
- Contains: SourceManager class, source definitions, default configuration, semantic recall settings
- Depends on: File system, Zod validation
- Used by: Server initialization, handlers, CLI

**Utility & Infrastructure Layer:**
- Purpose: Cross-cutting concerns and shared utilities
- Location: `src/utils/`
- Contains:
  - Cache (`cache.ts`): File + memory caching with TTL and cleanup
  - Search (`search.ts`): MiniSearch + stemming for lexical search
  - Semantic recall (`semantic-recall.ts`): Xenova embeddings fallback
  - Response helpers (`response-helpers.ts`): Markdown formatting
  - Error handling (`errors.ts`): Structured error logging
  - HTTP (`http.ts`): Fetch with headers and deduplication
  - Logging (`logger.ts`): Pino-based structured logging
  - Memvid integration (`memvid-memory.ts`): Cross-session pattern storage
  - Intent cache (`intent-cache.ts`): Query-level result caching
- Used by: All layers

**CLI Layer:**
- Purpose: Interactive setup and configuration outside MCP context
- Location: `src/cli/`
- Contains: Interactive setup wizard, Patreon OAuth flow, source management CLI
- Depends on: Readline, SourceManager, OAuth handlers
- Used by: Direct user invocation via package binary

## Data Flow

**Search Flow (get_swift_pattern / search_swift_content):**

1. User invokes tool via MCP with query and optional filters
2. Handler checks intent cache for previous results with same parameters
3. If cache miss:
   - Query routed to source registry → multiple sources searched in parallel
   - Results combined and sorted by relevance score
   - If semantic recall enabled and lexical score < threshold → Xenova embeddings supplement results
   - If memvid enabled → patterns from previous sessions retrieved and merged
   - Results cached in intent cache with semantic/memvid additions
4. Results formatted as markdown with optional code snippets
5. Response returned to MCP client

**Patreon Setup Flow (setup_patreon):**

1. Handler detects setup request
2. If "start" action:
   - Generates OAuth URL for Patreon authentication
   - Stores temporary session state
   - Returns URL to user
3. If "status" action:
   - Checks if PATREON_CLIENT_ID, PATREON_CLIENT_SECRET, YOUTUBE_API_KEY are set
   - Returns configuration status
4. OAuth callback (triggered externally) validates token and enables source

**Startup Flow:**

1. index.ts loads dotenv configuration
2. Checks CLI subcommand (sources, patreon, setup)
3. If no CLI command and TTY available → runs interactive setup wizard
4. Otherwise starts MCP server:
   - Initializes SourceManager from config file
   - Conditionally imports PatreonSource (premium)
   - Auto-enables Patreon if credentials detected
   - Registers all tool handlers
   - Starts stdio transport
   - Background: Prefetches sources if enabled, prefetches embedding model if semantic recall enabled

## State Management

**Configuration State:**
- Persisted in JSON file at `~/.config/swift-patterns-mcp/config.json`
- Managed by SourceManager class
- Contains: enabled sources, semantic recall settings, memvid settings, prefetch preference
- Modified via: enableSource/disableSource methods or CLI commands

**Runtime Caches:**
- In-memory: Quick-LRU cache for hot items (max 100 entries)
- File-based: JSON cache in ~/.cache/swift-patterns-mcp/{namespace}/ with TTL
- Search indexes: Singleton source instances maintain MiniSearch indexes
- Inflight dedup: Prevents concurrent duplicate requests to same source/query

**Semantic Index:**
- Singleton SemanticRecallIndex per process
- Cached embeddings stored in file cache with content hash keys
- Only activated when lexical search score falls below minLexicalScore threshold

**Cross-Session Memory (Memvid):**
- SDK client connected to Memvid API
- Stores patterns with optional semantic embeddings
- Survives across multiple MCP server invocations
- Disabled by default but auto-populated when enabled

## Key Abstractions

**ContentSource Interface:**
- Purpose: Metadata for available sources (free and premium)
- Examples:
  - `src/config/sources.ts`: AVAILABLE_SOURCES array
  - Each source has id, name, type, enabled, requiresAuth, status, configKeys
- Pattern: Configuration-driven source discovery

**RssPatternSource Class:**
- Purpose: Base class for RSS-feed-based pattern extraction
- Location: `src/sources/free/rssPatternSource.ts`
- Pattern: Abstract class with template methods for RSS parsing, content extraction, topic detection
- Subclasses: SundellSource, VanderLeeSource, NilCoalescingSource, PointFreeSource

**ToolHandler Type:**
- Purpose: Async function signature for MCP tool implementations
- Signature: `(args: Record<string, unknown>, context: ToolContext) => Promise<ToolResponse>`
- Pattern: Dependency injection via context parameter containing SourceManager and PatreonSource

**SourceRegistry:**
- Purpose: Centralized singleton access to source instances with inflight dedup
- Location: `src/utils/source-registry.ts`
- Pattern: Lazy instantiation, duplicate request coalescing, Promise.allSettled for fault tolerance

**FileCache:**
- Purpose: Two-tier caching (memory + disk) with automatic TTL and cleanup
- Location: `src/utils/cache.ts`
- Pattern: Memory tier checked first, disk tier for persistence, periodic cleanup on 1-hour interval

## Entry Points

**MCP Server (Default):**
- Location: `src/index.ts`
- Triggers: Package invocation with no args or --server flag
- Responsibilities: Initialize MCP server, list available tools, dispatch tool calls

**Interactive Setup Wizard:**
- Location: `src/cli/setup.ts`
- Triggers: Package invocation with no args + TTY available (unless SWIFT_PATTERNS_SKIP_WIZARD=1)
- Responsibilities: Guide user through MCP client setup, source configuration

**Patreon OAuth Handler:**
- Location: `src/cli/patreon.ts`
- Triggers: `swift-patterns-mcp patreon` command or `setup_patreon` tool
- Responsibilities: OAuth flow, token storage, credential validation

**Source CLI:**
- Location: `src/cli/sources.ts`
- Triggers: `swift-patterns-mcp sources` command
- Responsibilities: List sources, enable/disable sources, show configuration

## Error Handling

**Strategy:** Graceful degradation with structured logging

**Patterns:**

- **Source Failures:** `Promise.allSettled()` collects partial results from multiple sources; single source failure doesn't break overall response

- **Semantic Search Timeout:** 5-second timeout with fallback to lexical-only results; semantic failures never block response

- **Memvid Errors:** Try/catch with warning log; memvid errors don't interrupt search

- **Cache Failures:** Fall through to fresh fetch; file I/O errors silently ignored

- **Response Format:** All errors wrapped in ToolResponse with isError=true, displayed as markdown text

- **Logging:** Structured errors logged via Pino with context, error object, and metadata

## Cross-Cutting Concerns

**Logging:**
- Framework: Pino with service='swift-patterns-mcp' base context
- Level: Configured via LOG_LEVEL environment variable (default 'info')
- Usage: Structured logging throughout with { context, err, metadata } payloads

**Validation:**
- Zod schemas for configuration deserialization
- Type guards for runtime type narrowing
- Minimal input validation in handlers (assume MCP SDK pre-validates)

**Authentication:**
- Patreon: OAuth 2.0 flow stored in Keytar/system credential storage
- YouTube API: API key validation for video content
- Config: Environment variables required at startup time

**Caching Strategy:**
- Intent cache: Query-level results with semantic/memvid merged additions
- Source cache: RSS feed items (3600s TTL) and full article content
- Search index: Singleton MiniSearch instances kept warm across calls
- Embedding cache: Content hash-based caching of ONNX model outputs
- Dedup: Inflight request coalescing prevents thundering herd

---

*Architecture analysis: 2026-02-09*
