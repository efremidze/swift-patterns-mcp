# Codebase Structure

**Analysis Date:** 2026-02-17

## Directory Layout

```
swift-mcp/
├── src/                    # TypeScript source (ES modules, compiled to build/)
│   ├── index.ts            # Entry point - CLI router + server startup
│   ├── server.ts           # MCP server implementation
│   ├── cli/                # CLI commands and interactive setup
│   ├── tools/              # Tool handlers and registry
│   ├── sources/            # Pattern sources (free + premium)
│   ├── config/             # Configuration and source definitions
│   ├── utils/              # Shared utilities (caching, search, formatting)
│   └── integration/        # Integration tests
├── build/                  # Compiled JavaScript output (generated)
├── scripts/                # Development scripts and E2E test runners
├── docs/                   # Documentation
├── .planning/              # GSD planning files and logs
├── coverage/               # Test coverage reports (generated)
├── package.json            # Dependencies and build scripts
├── tsconfig.json           # TypeScript configuration
└── eslint.config.js        # Linting rules
```

## Directory Purposes

**src/:**
- Purpose: All source TypeScript code
- Contains: Handlers, sources, utilities, configuration, CLI
- Compiled to: `build/` directory

**src/index.ts:**
- Purpose: Binary entry point for `swift-patterns-mcp` command
- Contains: Environment loading, CLI routing logic, server startup
- Key files: References `src/cli/router.ts` and `src/server.ts`

**src/server.ts:**
- Purpose: MCP server initialization and protocol implementation
- Contains: Server setup, ListTools and CallTool handlers, source manager instantiation
- Key export: `startServer()` function

**src/cli/:**
- Purpose: Interactive CLI commands and setup wizards
- Contains: Command handlers for `sources`, `patreon`, `setup`
- Key files:
  - `router.ts`: Routes CLI subcommands and detects interactive wizard
  - `setup.ts`: Interactive onboarding wizard
  - `patreon.ts`: Patreon authentication and credential management
  - `sources.ts`: List and manage content sources
  - `setup-utils.ts`: Shared UI helpers for prompts

**src/tools/:**
- Purpose: Tool definitions and handler implementations
- Contains: Handler functions, tool registration, validation logic
- Key files:
  - `index.ts`: Barrel export that registers all handlers on import
  - `registry.ts`: Handler registry and tool list generation
  - `registration.ts`: Tool definitions (CORE_TOOLS, PATREON_TOOLS) and `getToolList()`
  - `types.ts`: ToolHandler, ToolContext, ToolResponse, PatreonPattern interfaces
  - `validation.ts`: Input validation helpers
  - `handlers/`: Individual tool implementation files

**src/tools/handlers/:**
- Purpose: Implementation of each MCP tool
- Contains: 6 tool handlers + cached search utility
- Key files:
  - `getSwiftPattern.ts`: Search free sources with topic and quality filters; implements hybrid ranking
  - `searchSwiftContent.ts`: Unified search across all enabled sources with semantic/memvid supplementation
  - `listContentSources.ts`: List all sources and their status
  - `enableSource.ts`: Enable/disable sources
  - `setupPatreon.ts`: Patreon setup and status checking
  - `getPatreonPatterns.ts`: Search Patreon creator content
  - `cached-search.ts`: Intent-based caching wrapper for search results

**src/sources/:**
- Purpose: Pattern source implementations
- Contains: Free (RSS) and premium (API) sources
- Key files:
  - `free/rssPatternSource.ts`: Base class for RSS-based sources with caching and search
  - `free/sundell.ts`: Swift by Sundell RSS source
  - `free/vanderlee.ts`: Antoine van der Lee RSS source
  - `free/nilcoalescing.ts`: Nil Coalescing RSS source
  - `free/pointfree.ts`: Point-Free RSS source with special content extraction
  - `premium/patreon.ts`: Main Patreon integration (conditional import)
  - `premium/patreon-oauth.ts`: OAuth flow and token management
  - `premium/patreon-dl.ts`: Content downloading and processing
  - `premium/youtube.ts`: YouTube API integration for creator video content

**src/config/:**
- Purpose: Application configuration and source definitions
- Contains: Source registry, configuration schema, creator database
- Key files:
  - `sources.ts`: SourceManager class (enables/disables sources, persists config), AVAILABLE_SOURCES list, config schema with zod
  - `creators.ts`: Database of known Swift/iOS creators with metadata
  - `swift-keywords.ts`: Swift-related keywords for topic detection

**src/utils/:**
- Purpose: Shared utilities across handlers and sources
- Contains: Caching, search, analysis, formatting, HTTP, logging
- Key files (by function):
  - **Caching**: `cache.ts` (in-memory + file-based with TTL), `intent-cache.ts` (query result caching)
  - **Search**: `search.ts` (MiniSearch wrapper with term weighting), `source-registry.ts` (singleton source instances, deduplication)
  - **Analysis**: `swift-analysis.ts` (topic detection, code detection, relevance scoring), `query-analysis.ts` (query tokenization, overlap scoring)
  - **Formatting**: `pattern-formatter.ts` (markdown/text output formatting), `response-helpers.ts` (MCP response builders)
  - **Semantic**: `semantic-recall.ts` (embedding model and similarity search)
  - **Memory**: `memvid-memory.ts` (persistent cross-session pattern storage)
  - **HTTP**: `http.ts` (fetch with headers), `fetch.ts` (fetch wrapper)
  - **Other**: `logger.ts` (pino configuration), `paths.ts` (config directory), `errors.ts` (error utils)

**src/__tests__/:**
- Purpose: Test fixtures and shared test setup
- Contains: Mock patterns, test harnesses
- Key files:
  - `fixtures/patterns.ts`: Mock pattern data for all sources

**src/tools/handlers/__tests__/:**
- Purpose: Tests for tool handlers
- Contains: Mocked sources, handler invocation tests
- Key files:
  - `handlers.test.ts`: Tests for core handlers (getSwiftPattern, search, list, enable)
  - `getPatreonPatterns.test.ts`: Tests for Patreon handler
  - `harness.ts`: Helper to create mock ToolContext

**src/config/__tests__/:**
- Purpose: Tests for configuration and source management
- Contains: SourceManager behavior tests

**src/sources/free/__tests__/ and src/sources/premium/__tests__/:**
- Purpose: Tests for individual source implementations
- Contains: Source-specific fetch and search tests

**src/utils/__tests__/:**
- Purpose: Tests for utilities
- Contains: Cache, search, analysis, registry tests

**src/integration/__tests__/:**
- Purpose: Integration tests
- Contains: E2E MCP client tests, slow tests (actual source fetches), cache behavior tests

**build/:**
- Purpose: Generated compiled JavaScript
- Contains: Output of `tsc` compilation
- Auto-generated: Never commit changes, regenerate with `npm run build`

**scripts/:**
- Purpose: Development and testing utilities
- Contains: Load testing, benchmarking, E2E test runners, query testing scripts

**docs/:**
- Purpose: User-facing documentation
- Contains: Architecture diagrams, integration guides, development setup

## Key File Locations

**Entry Points:**
- `src/index.ts`: Binary entry point (shebang at top, no imports)
- `src/server.ts`: MCP server startup function
- `src/cli/router.ts`: CLI command routing decision logic

**Configuration:**
- `src/config/sources.ts`: Source definitions and SourceManager
- `.env.example`: Required environment variables template
- `~/.config/swift-patterns-mcp/config.json`: Runtime config location (created by SourceManager)

**Core Logic:**
- `src/tools/handlers/*.ts`: All 6 tools implemented here
- `src/utils/source-registry.ts`: Source instantiation and deduplication
- `src/utils/cache.ts`: Multi-level caching strategy

**Testing:**
- `src/__tests__/fixtures/patterns.ts`: Test pattern data
- `src/tools/handlers/__tests__/harness.ts`: Test context factory
- `src/integration/__tests__/*.test.ts`: E2E tests

## Naming Conventions

**Files:**
- Handlers: `camelCase.ts` (e.g., `getSwiftPattern.ts`, `searchSwiftContent.ts`)
- Sources: `kebab-case.ts` or `camelCase.ts` (e.g., `patreon-oauth.ts`, `RssPatternSource.ts`)
- Utilities: `kebab-case.ts` (e.g., `source-registry.ts`, `response-helpers.ts`)
- Tests: File name + `.test.ts` or `.spec.ts` (e.g., `handlers.test.ts`)

**Directories:**
- Grouped by feature: `tools/`, `sources/`, `utils/`, `config/`
- Test directories: `__tests__/` (Vitest convention) alongside source
- Subdirectories: `handlers/` (tool implementations), `free/` / `premium/` (source types)

**Functions and Classes:**
- Handlers: PascalCase ending with `Handler` (e.g., `getSwiftPatternHandler`)
- Sources: PascalCase (e.g., `RssPatternSource`, `PatreonSource`)
- Utilities: camelCase (e.g., `searchMultipleSources`, `formatSearchPatterns`)
- Interfaces: PascalCase, often prefixed with I or suffixed with "Interface" or descriptive name (e.g., `ToolResponse`, `BasePattern`)

## Where to Add New Code

**New Tool:**
1. Implement handler in `src/tools/handlers/[toolName].ts`
2. Export handler function with type `ToolHandler`
3. Register in `src/tools/index.ts` via `registerHandler()`
4. Add tool definition to `CORE_TOOLS` or `PATREON_TOOLS` in `src/tools/registration.ts`
5. Add tests in `src/tools/handlers/__tests__/[toolName].test.ts`

**New Source (Free):**
1. Create `src/sources/free/[sourceName].ts` extending `RssPatternSource`
2. Define feed URL and topic keywords in constructor
3. Add source definition to `AVAILABLE_SOURCES` in `src/config/sources.ts`
4. Export default instance of source class
5. Add entry to `SOURCE_CLASSES` in `src/utils/source-registry.ts`
6. Add tests in `src/sources/free/__tests__/[sourceName].test.ts`

**New Source (Premium):**
1. Create `src/sources/premium/[sourceName].ts` implementing `PatreonSourceInstance` interface
2. Handle authentication via environment variables or credential storage
3. Implement `fetchPatterns()` and `searchPatterns()` methods
4. Add source definition to `AVAILABLE_SOURCES` in `src/config/sources.ts`
5. Import conditionally in `src/server.ts` (like Patreon)
6. Add tests in `src/sources/premium/__tests__/[sourceName].test.ts`

**New Utility:**
1. Create `src/utils/[utilName].ts`
2. Export functions/classes
3. Add unit tests in `src/utils/__tests__/[utilName].test.ts`
4. Import where needed

**New CLI Command:**
1. Create `src/cli/[commandName].ts`
2. Implement command logic (use `src/cli/setup-utils.ts` for UI)
3. Add to `CLI_COMMANDS` map in `src/cli/router.ts`
4. Add tests in `src/cli/__tests__/[commandName].test.ts`

## Special Directories

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (run `npm install`)
- Committed: No (in .gitignore)

**build/:**
- Purpose: Compiled JavaScript output
- Generated: Yes (run `npm run build`)
- Committed: No (in .gitignore)

**coverage/:**
- Purpose: Test coverage reports
- Generated: Yes (run `npm run test:coverage`)
- Committed: No (in .gitignore)

**.planning/:**
- Purpose: GSD orchestrator planning documents and logs
- Generated: Yes (by GSD tools)
- Committed: Yes (tracked for context)

**.env:**
- Purpose: Environment variables (secrets)
- Generated: No (manual setup)
- Committed: No (in .gitignore)
- See: `.env.example` for template

**dist/ or build/:**
- Purpose: Compiled output for distribution
- Output of: `npm run build` (TypeScript → JavaScript)
- Location specified in: `tsconfig.json` outDir

---

*Structure analysis: 2026-02-17*
