# Codebase Structure

**Analysis Date:** 2026-01-29

## Directory Layout

```
swift-mcp/
├── src/                        # Source code (TypeScript)
│   ├── index.ts               # MCP server entry point
│   ├── cli/                   # Command-line tools
│   ├── config/                # Configuration and constants
│   ├── integration/           # Integration tests and test client
│   ├── sources/               # Content source implementations
│   │   ├── free/              # Free (public) content sources
│   │   └── premium/           # Premium (authenticated) content sources
│   ├── tools/                 # MCP tool handlers
│   │   ├── handlers/          # Handler implementations for each tool
│   │   ├── index.ts           # Barrel export and handler registration
│   │   ├── registry.ts        # Tool handler registry/dispatcher
│   │   └── types.ts           # Type definitions for tools
│   └── utils/                 # Shared utilities and infrastructure
├── build/                     # Compiled JavaScript output (generated)
├── docs/                      # Documentation
├── .planning/                 # GSD planning documents
├── .github/                   # GitHub Actions and config
├── scripts/                   # Utility scripts
├── package.json              # Dependencies and npm scripts
├── tsconfig.json             # TypeScript configuration
├── vitest.config.ts          # Test runner configuration
├── eslint.config.js          # Linting rules
└── README.md                 # Project documentation
```

## Directory Purposes

**src/**
- Purpose: All TypeScript source code
- Contains: Handlers, sources, utilities, configuration, CLI
- Key files: `index.ts` (MCP server), handlers (tool implementations)

**src/cli/**
- Purpose: Command-line interface tools
- Contains: setup.ts, auth.ts, source-manager.ts
- Key files:
  - `setup.ts`: Interactive Patreon OAuth setup
  - `auth.ts`: Manual credential management
  - `source-manager.ts`: Enable/disable sources, manage cache

**src/config/**
- Purpose: Static configuration, metadata, and constants
- Contains: Source definitions, Swift keywords, creator information
- Key files:
  - `sources.ts`: ContentSource[] registry with metadata
  - `swift-keywords.ts`: Topic detection keywords and quality signals
  - `creators.ts`: Creator info with YouTube verification

**src/integration/**
- Purpose: Integration testing and helpers
- Contains: Test client for MCP protocol testing
- Key files: `test-client.ts` (MCP client for testing)

**src/sources/**
- Purpose: Content source implementations
- Contains: Free and premium source classes
- Structure: Each source extends RssPatternSource (free) or custom class (premium)

**src/sources/free/**
- Purpose: Free public content sources
- Contains: RssPatternSource (base class), source implementations
- Key files:
  - `rssPatternSource.ts`: Abstract base for RSS-based sources
  - `sundell.ts`: Swift by Sundell patterns
  - `vanderlee.ts`: Antoine van der Lee patterns
  - `nilcoalescing.ts`: Nil Coalescing patterns
  - `pointfree.ts`: Point-Free patterns

**src/sources/premium/**
- Purpose: Authenticated premium content sources
- Contains: Patreon integration, OAuth, YouTube API
- Key files:
  - `patreon.ts`: PatreonSource class implementation
  - `patreon-oauth.ts`: OAuth 2.0 flow and token management
  - `patreon-dl.ts`: Patreon post download and parsing
  - `youtube.ts`: Creator verification via YouTube API

**src/tools/**
- Purpose: MCP tool definitions and handlers
- Contains: Handler implementations, registry, type definitions
- Key files:
  - `index.ts`: Handler registration (imported by index.ts)
  - `registry.ts`: Tool handler dispatcher
  - `types.ts`: ToolHandler, ToolResponse, ToolContext interfaces

**src/tools/handlers/**
- Purpose: Implementation of each MCP tool
- Contains: Six handler functions, one per tool
- Key files:
  - `getSwiftPattern.ts`: Core pattern search by topic
  - `searchSwiftContent.ts`: Full-text search with semantic recall
  - `getPatreonPatterns.ts`: Patreon-specific pattern search
  - `listContentSources.ts`: List available sources and status
  - `setupPatreon.ts`: Configure Patreon integration
  - `enableSource.ts`: Enable/disable a source

**src/utils/**
- Purpose: Shared utilities and infrastructure
- Contains: Caching, search, logging, http, memory management
- Key files:
  - `cache.ts`: FileCache with memory LRU layer
  - `intent-cache.ts`: Query-intent result caching
  - `search.ts`: Full-text search with stemming
  - `source-registry.ts`: Source singleton cache and deduplication
  - `semantic-recall.ts`: AI embeddings-based search
  - `memvid-memory.ts`: Persistent cross-session memory
  - `pattern-formatter.ts`: Response formatting utilities
  - `inflight-dedup.ts`: In-flight request deduplication
  - `http.ts`: Fetch wrapper with error handling
  - `logger.ts`: Pino logger instance
  - `paths.ts`: Platform-specific home dir paths
  - `response-helpers.ts`: MCP response builders
  - `search-terms.ts`: Query tokenization and normalization
  - `swift-analysis.ts`: Swift-specific content analysis
  - `errors.ts`: Error message conversion
  - `concurrency.ts`: Promise utilities
  - `fetch.ts`: Fetch export

**build/**
- Purpose: Compiled JavaScript (generated during build)
- Generated: Yes (`npm run build`)
- Committed: No (in .gitignore)
- Entry point: `build/index.js` (referenced in package.json bin)

**docs/**
- Purpose: User-facing documentation
- Contains: Setup guides, API docs, feature documentation

**.planning/codebase/**
- Purpose: GSD codebase analysis documents
- Contains: ARCHITECTURE.md, STRUCTURE.md, and other analysis docs

## Key File Locations

**Entry Points:**
- `src/index.ts`: MCP server initialization, tool registration, stdio transport
- `src/cli/setup.ts`: CLI entry point for Patreon setup

**Configuration:**
- `src/config/sources.ts`: Source registry and metadata
- `src/config/swift-keywords.ts`: Topic detection and quality signals
- `tsconfig.json`: TypeScript compiler options
- `package.json`: Dependencies, npm scripts, version

**Core Logic:**
- `src/tools/handlers/getSwiftPattern.ts`: Pattern search by topic
- `src/tools/handlers/searchSwiftContent.ts`: Full-text search with semantic recall
- `src/sources/free/rssPatternSource.ts`: Base for all free sources
- `src/utils/source-registry.ts`: Multi-source orchestration
- `src/utils/search.ts`: Full-text indexing and search

**Testing:**
- `src/**/__tests__/*.test.ts`: Colocated unit/integration tests
- `src/integration/__tests__/`: Integration test suite
- `vitest.config.ts`: Test runner configuration

## Naming Conventions

**Files:**
- camelCase for utility files: `cache.ts`, `search.ts`, `logger.ts`
- kebab-case for tool handlers: `get-swift-pattern.ts` pattern (but currently camelCase)
- kebab-case for compound names: `intent-cache.ts`, `source-registry.ts`, `patreon-oauth.ts`
- Class implementations named after class: `SundellSource` in `sundell.ts`

**Directories:**
- lowercase, plural for collections: `src/sources/`, `src/tools/`, `src/utils/`
- lowercase for feature areas: `src/cli/`, `src/config/`, `src/integration/`
- `__tests__/` subdirectories for test files (colocated pattern)
- `free/` and `premium/` for source categorization

**Exports:**
- Barrel export pattern: `src/tools/index.ts` registers all handlers
- Type-only imports: `import type { BasePattern } from ...`
- Named exports for utilities, default export for source classes
- `export default` for singleton instances (logger)

## Where to Add New Code

**New MCP Tool:**
1. Create handler file: `src/tools/handlers/{toolName}.ts` implementing ToolHandler
2. Register in `src/tools/index.ts` with `registerHandler('tool_name', handlerFunction)`
3. Add tool definition to CORE_TOOLS or PATREON_TOOLS array in `src/index.ts`
4. Write tests in `src/tools/handlers/__tests__/{toolName}.test.ts`

**New Free Content Source:**
1. Create source file: `src/sources/free/{sourceName}.ts`
2. Extend RssPatternSource<T>: define feedUrl, topicKeywords, qualitySignals
3. Register in `src/config/sources.ts` AVAILABLE_SOURCES array
4. Add to `src/utils/source-registry.ts` SOURCE_CLASSES map
5. Update search keywords in `src/config/swift-keywords.ts` if needed

**New Utility Function:**
- Generic utilities: `src/utils/{utility}.ts`
- Search/indexing: `src/utils/search.ts` (SearchIndex class)
- Caching: `src/utils/cache.ts` (FileCache class) or `src/utils/intent-cache.ts`
- Response helpers: `src/utils/response-helpers.ts`

**CLI Command:**
1. Create file: `src/cli/{command}.ts`
2. Add npm script to package.json: `"command": "node build/cli/{command}.js"`
3. Import in `src/index.ts` or create standalone entry

**Tests:**
- Unit tests: Colocated in `src/{dir}/__tests__/{file}.test.ts`
- Integration tests: `src/integration/__tests__/{feature}.test.ts`
- Use Vitest: `npm run test` runs all, `npm run test -- {pattern}` filters
- Test client in `src/integration/test-client.ts` for MCP protocol testing

## Special Directories

**src/sources/**
- Purpose: Content source implementations
- Generated: No
- Committed: Yes
- Pattern: Each source is a class extending RssPatternSource (free) or standalone (premium)
- New sources added as new files, registered in config and source-registry

**build/**
- Purpose: Compiled JavaScript (output of TypeScript compilation)
- Generated: Yes (`npm run build`)
- Committed: No (.gitignore excludes)
- Used by: npm run scripts, bin entry point, deployed package
- Regenerate: `npm run build` or `npm run watch`

**.planning/codebase/**
- Purpose: GSD analysis documents
- Generated: Yes (by GSD agents)
- Committed: Yes (tracked in git)
- Updated: When codebase structure or architecture changes significantly

**node_modules/**
- Purpose: npm dependencies (ignored from git)
- Generated: Yes (`npm install`)
- Committed: No

## Build and Output Structure

**Source Layout:**
```
src/
├── index.ts
├── cli/
├── config/
├── sources/
├── tools/
└── utils/
```

**Build Output (TypeScript → JavaScript):**
```
build/
├── index.js              (from src/index.ts)
├── cli/
│   ├── setup.js
│   ├── auth.js
│   └── source-manager.js
├── config/
├── sources/
├── tools/
└── utils/
```

**Root package.json bin:**
```json
{
  "bin": {
    "swift-patterns-mcp": "build/index.js"
  }
}
```

This means `npx swift-patterns-mcp` runs `build/index.js` (the compiled MCP server).

---

*Structure analysis: 2026-01-29*
