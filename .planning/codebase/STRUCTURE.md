# Codebase Structure

**Analysis Date:** 2026-02-09

## Directory Layout

```
swift-mcp/
├── src/                           # TypeScript source code
│   ├── index.ts                   # MCP server entry point + CLI routing
│   ├── cli/                       # Command-line interface modules
│   │   ├── setup.ts               # Interactive setup wizard
│   │   ├── patreon.ts             # Patreon OAuth and configuration
│   │   └── sources.ts             # Source management CLI
│   ├── config/                    # Configuration and source definitions
│   │   ├── sources.ts             # SourceManager class and source definitions
│   │   ├── creators.ts            # Patreon creator metadata
│   │   └── swift-keywords.ts      # Swift topic keywords for analysis
│   ├── tools/                     # MCP tool system
│   │   ├── index.ts               # Barrel export and handler registration
│   │   ├── registry.ts            # Tool handler registry
│   │   ├── types.ts               # ToolHandler, ToolResponse, ToolContext types
│   │   ├── extract-cookie.ts      # Cookie extraction utility
│   │   ├── handlers/              # Tool handler implementations
│   │   │   ├── getSwiftPattern.ts
│   │   │   ├── searchSwiftContent.ts
│   │   │   ├── getPatreonPatterns.ts
│   │   │   ├── setupPatreon.ts
│   │   │   ├── listContentSources.ts
│   │   │   ├── enableSource.ts
│   │   │   └── __tests__/         # Handler tests
│   │   └── __tests__/             # Tool registry tests
│   ├── sources/                   # Content source implementations
│   │   ├── free/                  # Free (no-auth) sources
│   │   │   ├── rssPatternSource.ts  # Base RSS pattern class
│   │   │   ├── sundell.ts           # Swift by Sundell
│   │   │   ├── vanderlee.ts         # Antoine van der Lee
│   │   │   ├── nilcoalescing.ts     # Nil Coalescing
│   │   │   ├── pointfree.ts         # Point-Free
│   │   │   └── __tests__/
│   │   └── premium/               # Premium (auth required) sources
│   │       ├── patreon.ts         # Patreon content fetcher
│   │       ├── patreon-oauth.ts   # OAuth token management
│   │       ├── patreon-dl.ts      # Patreon content downloader
│   │       ├── youtube.ts         # YouTube video metadata
│   │       └── __tests__/
│   ├── utils/                     # Shared utilities and infrastructure
│   │   ├── cache.ts               # Two-tier file+memory cache
│   │   ├── search.ts              # MiniSearch wrapper with stemming
│   │   ├── search-terms.ts        # Tokenization and normalization
│   │   ├── semantic-recall.ts     # Embedding-based semantic search
│   │   ├── memvid-memory.ts       # Cross-session memory integration
│   │   ├── intent-cache.ts        # Query-level result caching
│   │   ├── inflight-dedup.ts      # Request coalescing
│   │   ├── source-registry.ts     # Centralized source instance management
│   │   ├── response-helpers.ts    # Markdown formatting
│   │   ├── pattern-formatter.ts   # Result formatting for display
│   │   ├── swift-analysis.ts      # Topic/code/relevance detection
│   │   ├── patreon-env.ts         # Environment variable helpers
│   │   ├── http.ts                # Fetch wrapper
│   │   ├── errors.ts              # Error utilities
│   │   ├── logger.ts              # Pino logger
│   │   ├── paths.ts               # Config/cache directory paths
│   │   └── __tests__/             # Utility tests
│   └── integration/               # Integration tests
│       ├── test-client.ts         # MCP client test harness
│       └── __tests__/
├── build/                         # Compiled JavaScript (auto-generated)
├── scripts/                       # Build and deployment scripts
├── docs/                          # Documentation
├── .planning/                     # GSD planning documents
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── eslint.config.js               # ESLint configuration
├── vitest.config.ts               # Test runner configuration
└── README.md                      # Project documentation
```

## Directory Purposes

**src/**
- Purpose: All TypeScript source code
- Contains: Entry point, CLI, tools, sources, utilities
- Key files: `index.ts` (server), `tools/handlers/` (tool implementations), `sources/` (content providers)

**src/cli/**
- Purpose: Command-line interface for setup and configuration
- Contains: Interactive wizards, OAuth flows, CLI commands
- Key files: `setup.ts` (onboarding), `patreon.ts` (Patreon auth), `sources.ts` (source management)

**src/config/**
- Purpose: Configuration management and source metadata
- Contains: SourceManager class, source definitions, keywords
- Key files: `sources.ts` (SourceManager, AVAILABLE_SOURCES, SourceConfig), `creators.ts` (creator metadata)

**src/tools/**
- Purpose: MCP tool implementation framework
- Contains: Registry system, handler types, tool dispatcher
- Key files: `index.ts` (barrel/registration), `registry.ts` (Map-based registry), `handlers/` (implementations)

**src/tools/handlers/**
- Purpose: Individual MCP tool implementations
- Contains: Business logic for each tool
- Key files: `getSwiftPattern.ts` (topic search), `searchSwiftContent.ts` (unified search), `getPatreonPatterns.ts` (premium search)

**src/sources/free/**
- Purpose: Free content providers
- Contains: RSS-based source implementations
- Key files: `rssPatternSource.ts` (base class), `sundell.ts`, `vanderlee.ts`, `nilcoalescing.ts`, `pointfree.ts`

**src/sources/premium/**
- Purpose: Premium content providers
- Contains: Patreon integration, OAuth, YouTube metadata
- Key files: `patreon.ts` (main source), `patreon-oauth.ts` (token management), `patreon-dl.ts` (content fetch)

**src/utils/**
- Purpose: Shared infrastructure and utilities
- Contains: Caching, search, formatting, error handling, logging
- Key files: `cache.ts` (file+memory caching), `search.ts` (MiniSearch), `semantic-recall.ts` (embeddings), `source-registry.ts` (source management)

**src/integration/**
- Purpose: Integration testing utilities
- Contains: MCP client test harness for E2E tests
- Key files: `test-client.ts` (JSON-RPC client)

**build/**
- Purpose: Compiled JavaScript output (auto-generated by TypeScript)
- Generated: Yes
- Committed: No (in .gitignore)

## Key File Locations

**Entry Points:**
- `src/index.ts`: MCP server initialization, CLI routing, tool dispatch
- `src/cli/setup.ts`: Interactive setup wizard (fallback when no args + TTY)
- `src/cli/patreon.ts`: Patreon OAuth flow
- `src/cli/sources.ts`: Source management commands

**Configuration:**
- `src/config/sources.ts`: SourceManager class, AVAILABLE_SOURCES, SourceConfig schema
- `src/utils/paths.ts`: Config/cache directory resolution
- `src/utils/logger.ts`: Pino logger initialization

**Core Logic:**
- `src/tools/handlers/getSwiftPattern.ts`: Topic-based pattern search
- `src/tools/handlers/searchSwiftContent.ts`: Unified cross-source search with semantic/memvid fallback
- `src/tools/handlers/getPatreonPatterns.ts`: Patreon-specific pattern search
- `src/utils/source-registry.ts`: Centralized source instantiation and in-flight dedup
- `src/utils/cache.ts`: Two-tier caching system
- `src/sources/free/rssPatternSource.ts`: Base class for RSS sources

**Testing:**
- `src/tools/handlers/__tests__/handlers.test.ts`: Tool handler tests
- `src/sources/free/__tests__/`: Individual source tests
- `src/utils/__tests__/`: Utility function tests
- `src/integration/__tests__/`: E2E MCP client tests

## Naming Conventions

**Files:**
- Camel case: `getSwiftPattern.ts`, `searchSwiftContent.ts`
- Index files: `index.ts` for barrel exports
- Test files: `{name}.test.ts` or `{name}.spec.ts`
- CLI modules: Named command: `setup.ts`, `patreon.ts`, `sources.ts`
- Classes: `RssPatternSource`, `SourceManager`, `FileCache`, `SemanticRecallIndex`

**Directories:**
- Plural for collections: `src/tools/`, `src/sources/`, `src/utils/`
- Structured by feature: `free/`, `premium/` under sources
- Handlers grouped: All in `src/tools/handlers/`
- Tests co-located: `__tests__/` adjacent to code or in parallel directory

**Functions & Variables:**
- Camel case: `searchMultipleSources()`, `prefetchAllSources()`, `getHandler()`
- Descriptive action verbs: `fetch`, `search`, `format`, `enable`, `disable`, `validate`
- Constants: All caps: `DEFAULT_TTL`, `SEMANTIC_TIMEOUT_MS`, `AVAILABLE_SOURCES`
- Types: Pascal case: `ToolResponse`, `BasePattern`, `SourceConfig`

## Where to Add New Code

**New Tool Implementation:**
- Implementation: `src/tools/handlers/{toolName}.ts` (export handler function)
- Registration: Add to `src/tools/index.ts` (registerHandler call)
- Tests: `src/tools/handlers/__tests__/{toolName}.test.ts`
- Tool definition: Add to CORE_TOOLS or PATREON_TOOLS array in `src/index.ts`

**New Content Source (Free):**
- Implementation: `src/sources/free/{sourceName}.ts` extending RssPatternSource
- Registration: Import in `src/utils/source-registry.ts` and add to SOURCE_CLASSES
- Config: Add to AVAILABLE_SOURCES array in `src/config/sources.ts`
- Tests: `src/sources/free/__tests__/{sourceName}.test.ts`

**New Content Source (Premium):**
- Implementation: `src/sources/premium/{sourceName}.ts`
- Registration: Conditional import in `src/index.ts` (like patreon.ts)
- Config: Add to AVAILABLE_SOURCES in `src/config/sources.ts`
- Tests: `src/sources/premium/__tests__/{sourceName}.test.ts`

**New Utility Function:**
- Implementation: `src/utils/{utilityName}.ts` or add to existing util
- Exports: Named exports, not default
- Tests: `src/utils/__tests__/{utilityName}.test.ts`

**New CLI Command:**
- Implementation: `src/cli/{commandName}.ts`
- Routing: Add to CLI_COMMANDS map in `src/index.ts`
- Tests: `src/cli/__tests__/{commandName}.test.ts`

## Special Directories

**src/__tests__/ & src/**/__tests__/:**
- Purpose: Co-located test files using Vitest
- Generated: No
- Committed: Yes
- Pattern: Mirror source structure, one test file per source file

**build/:**
- Purpose: Compiled JavaScript output
- Generated: Yes (by `npm run build`)
- Committed: No
- Source: TypeScript compiler output, published to npm

**.planning/codebase/:**
- Purpose: GSD codebase analysis documents
- Generated: By `/gsd:map-codebase` command
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

**docs/:**
- Purpose: Project documentation and planning
- Contains: README, setup guides, planning documents, benchmarks
- Key files: `README.md` (main documentation)

## File Type Patterns

**Configuration Files:**
- `tsconfig.json`: TypeScript compiler options
- `eslint.config.js`: ESLint rules
- `vitest.config.ts`: Test runner configuration
- `package.json`: Dependencies and npm scripts

**Entry Point Pattern:**
- Shebang: `#!/usr/bin/env node` for CLI modules
- Top export from handlers: Single default export or named export matching handler name
- Index files: Barrel exports re-exporting from submodules

**Handler Pattern:**
All handlers follow this structure:
```typescript
import type { ToolHandler } from '../types.js';

export const {handlerName}Handler: ToolHandler = async (args, context) => {
  // Argument validation
  // Intent cache check
  // Business logic
  // Response formatting
  return createTextResponse(...);
};
```

**Source Implementation Pattern:**
Free sources extend RssPatternSource:
```typescript
export class {SourceName}Source extends RssPatternSource<{SourceName}Pattern> {
  constructor() {
    super({
      feedUrl: '...',
      cacheKey: '...',
      topicKeywords: { ... },
      qualitySignals: { ... },
    });
  }
}
```

---

*Structure analysis: 2026-02-09*
