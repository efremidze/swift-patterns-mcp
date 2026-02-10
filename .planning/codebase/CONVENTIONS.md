# Coding Conventions

**Analysis Date:** 2026-02-09

## Naming Patterns

**Files:**
- **kebab-case for multi-word file names:** `patreon-oauth.ts`, `swift-analysis.ts`, `rssPatternSource.ts`
- **Single-word files or compound nouns without hyphens:** `logger.ts`, `cache.ts`, `search.ts`, `errors.ts`
- **Handler files:** Prefer descriptive names like `getSwiftPattern.ts`, `searchSwiftContent.ts`, `listContentSources.ts`
- **Test files:** Use `.test.ts` suffix, located adjacent to source with `__tests__` directory pattern or co-located
  - Example: `src/utils/__tests__/cache.test.ts` or `src/tools/__tests__/registry.test.ts`

**Functions:**
- **camelCase for all functions:** `fetchPatterns()`, `calculateRelevance()`, `createTextResponse()`, `detectTopics()`
- **Descriptive verb-first naming:** `hasCodeContent()`, `isTokenExpired()`, `extractCodeSnippets()`, `truncateAtSentence()`
- **Handler functions:** Suffixed with `Handler` in exports: `getSwiftPatternHandler`, `searchSwiftContentHandler`, `listContentSourcesHandler`
- **Predicate functions:** Prefixed with `is`, `has`, or `can`: `isCookieConfigured()`, `hasCodeContent()`, `isSourceConfigured()`

**Variables:**
- **camelCase throughout:** `topicKeywords`, `qualitySignals`, `minQuality`, `wasCacheHit`, `cachedSearch`
- **Constants in UPPER_SNAKE_CASE:** `CORE_TOOLS`, `PATREON_TOOLS`, `FREE_SOURCE_NAMES`, `COMMON_FORMAT_OPTIONS`, `CLI_COMMANDS`, `SERVER_FLAGS`
- **Temporary/loop variables:** Single letters acceptable in narrow scopes: `r`, `p`, `s` in `.map()` and `.filter()` chains
- **Boolean variables:** Start with question-form words: `isEnabled`, `hasCode`, `wasCacheHit`, `shouldRunInteractiveWizard`, `forceServerMode`

**Types:**
- **PascalCase for all types, interfaces, classes:** `ToolHandler`, `ToolContext`, `BasePattern`, `PatreonPattern`, `SourceManager`, `FileCache`
- **Type predicates as questions:** `interface SearchableDocument`, `interface ToolResponse`, `interface PatreonSourceInstance`
- **Generic type parameters:** Single capital letters preferred: `T`, `K`, `V` in class definitions like `RssPatternSource<T extends BasePattern>`

**Exports:**
- **Classes exported as default:** `export default SundellSource;`, `export default logger;`
- **Functions exported as named exports:** `export function getHandler(name: string)`, `export function formatMarkdownSections()`
- **Interfaces/types exported by name:** `export interface BasePattern`, `export type SourceType = 'free' | 'premium'`
- **Barrel files:** `src/tools/index.ts` re-exports handlers for convenience

## Code Style

**Formatting:**
- **Tool:** ESLint with TypeScript support (eslint.config.js)
- **Prettier:** Not configured; manual formatting expected
- **Indentation:** 2 spaces (inferred from codebase)
- **Line length:** No strict limit observed; code naturally flows
- **Semicolons:** Always present (required by TypeScript/ESLint)

**Linting:**
- **Tool:** ESLint with `typescript-eslint` (v9.39.2)
- **Config:** `eslint.config.js`
- **Key rules enforced:**
  - `@typescript-eslint/no-unused-vars`: Warn on unused variables (underscore prefix `_` suppresses warning)
  - `@typescript-eslint/no-explicit-any`: Off (flexible for integration scenarios)
  - `@typescript-eslint/no-require-imports`: Warn (prefer ES modules)
  - `@typescript-eslint/no-unused-expressions`: Warn
  - `no-var`: Warn (prefer `const`/`let`)
  - `prefer-spread`: Warn
- **Ignored directories:** `build/**`, `node_modules/**`, `.claude/**`, `dist/**`

## Import Organization

**Order:**
1. Third-party library imports: `import pino from 'pino'`, `import MiniSearch from 'minisearch'`
2. Internal type imports: `import type { ToolHandler } from '../types.js'`, `import type { BasePattern }`
3. Internal value imports: `import SourceManager from '../config/sources.js'`, `import logger from '../utils/logger.js'`
4. Relative imports with `.js` extension required (ES modules)

**Path Aliases:**
- No path aliases configured. All imports use relative paths with explicit `.js` extensions
- Example: `import { getSource } from '../../utils/source-registry.js'` (not `@utils/source-registry`)

**File extensions:**
- **All imports include `.js` extension** (TypeScript compiled to JavaScript; extension required at runtime)
- Example: `import type { ToolHandler } from './types.js'` not `import type { ToolHandler } from './types'`

## Error Handling

**Patterns:**
- **Utility function approach:** `src/utils/errors.ts` provides `logError()` and `toErrorMessage()`
  ```typescript
  function isError(value: unknown): value is Error {
    return value instanceof Error;
  }
  export function toErrorMessage(error: unknown): string {
    return isError(error) ? error.message : String(error);
  }
  ```
- **Error responses:** `createErrorResponse()`, `createErrorResponseFromError()` in `src/utils/response-helpers.ts`
- **Logging on error:** Use `logError(context, error, details)` with structured logging via pino
  - Example: `logError('RSS Pattern Source', error, { feedUrl: this.options.feedUrl })`
- **Graceful degradation:** Try-catch blocks return empty arrays or defaults
  - Example in `src/sources/free/rssPatternSource.ts`: catch errors, log, return `[]`
- **No throw statements in handlers:** Tools return error responses instead of throwing

## Logging

**Framework:** `pino` (structured JSON logger)

**Setup:** `src/utils/logger.ts`
```typescript
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'swift-patterns-mcp' },
});
```

**Patterns:**
- Use `logger.info()`, `logger.warn()`, `logger.error()` explicitly
- Pass structured data as first argument: `logger.info({ key: value }, message)`
- Pass Error objects to log stack traces: `logger.error({ err: error }, message)`
- **Example from main:**
  ```typescript
  logger.info('Patreon auto-enabled (credentials detected)');
  logger.warn({ err: error }, "Failed to prefetch sources");
  logger.error({ err: error }, "Fatal error");
  ```

## Comments

**When to Comment:**
- **JSDoc for public APIs:** Function parameters, return types, and complex logic
  - Used in `src/utils/errors.ts`: `/** Type guard to check if a value is an Error instance. */`
  - Used in `src/utils/response-helpers.ts`: `/** Build markdown sections with consistent spacing. */`
- **Inline comments for non-obvious logic:** Explain why, not what
  - Example: `// Normalize search score (MiniSearch scores can vary widely) / Divide by 5 to spread scores further apart`
- **No comments for self-documenting code:** Function names and types are clear
- **Task/TODO markers:** Rarely used; code is generally complete

**JSDoc/TSDoc:**
- **Minimal but present for public exports:** Classes and handler functions have top-level comments
- **Parameter documentation:** Present in utility functions, sparse in internal handlers
- **Return type documentation:** Implicit via TypeScript types (no `@returns` annotations observed)
- **Example format:**
  ```typescript
  /**
   * Error handling utilities for consistent error logging across the codebase.
   * Uses structured logger to keep output consistent.
   */
  ```

## Function Design

**Size:**
- Functions range from 5 lines (simple getters) to 100+ lines (complex search logic)
- Average function length: 20-40 lines
- Long functions decomposed: `src/sources/free/rssPatternSource.ts` splits RSS processing into `processRssItem()` and `processArticle()`

**Parameters:**
- **Single object parameter for multiple options:** Handlers receive `args` object
  - Example: `getSwiftPatternHandler(args: Record<string, unknown>, context: ToolContext)`
- **Destructuring for options:** `const { fuzzy = 0.2, boost = {...}, minScore = 0 } = options`
- **Context/dependency injection:** Pass `ToolContext` or `SourceManager` explicitly
- **Generic type parameters:** Used for reusable components: `SearchIndex<T extends SearchableDocument>`

**Return Values:**
- **Async functions return Promises:** All handlers are `async` and return `Promise<ToolResponse>`
- **Promise composition:** Use `Promise.all()` for parallel operations, `.then().catch()` for chains
- **Optional returns:** Null-coalescing for missing values: `cached ?? []`, `error.message ?? String(error)`
- **No early returns in complex logic:** Flow control via if-else or early guards

## Module Design

**Exports:**
- **One primary export per file:** Classes default-exported, utilities named-exported
- **Mix of default and named exports:**
  - `export default SundellSource;` + `export interface SundellPattern`
  - `export function calculateRelevance()` + no default
- **Avoid exporting unused symbols:** Each export serves a purpose in downstream code

**Barrel Files:**
- **`src/tools/index.ts`:** Re-exports handlers
- **`src/config/swift-keywords.ts`:** Exports `createSourceConfig()` for sources
- **No deep nesting of barrels:** Maximum one level of barrel exports

**File organization:**
- **Separation of concerns:** Utils, sources, tools, config, CLI, integration in distinct directories
- **Co-location of tests:** `__tests__` subdirectories adjacent to source
- **No circular dependencies:** Imports flow upward (tools → handlers → utils → config)

## Type Strictness

**TypeScript Configuration:**
- **Target:** ES2022
- **Strict mode:** Enabled (`"strict": true`)
- **Lib:** ES2022
- **Module:** Node16 (ESM)
- **Strict checks active:**
  - `noImplicitAny` implied
  - `strictNullChecks` enabled
  - `strictFunctionTypes` enabled
  - All strict rules in effect

**Type Assertions:**
- **Type guards used:** `function isError(value: unknown): value is Error`
- **`as` assertions rare:** Prefer type guards or proper typing
- **Generic constraints:** `T extends BasePattern` used to ensure type safety
- **No `unknown` casts to `any`:** Patterns prefer type narrowing

---

*Convention analysis: 2026-02-09*
