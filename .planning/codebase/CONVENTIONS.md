# Coding Conventions

**Analysis Date:** 2026-02-07

## Naming Patterns

**Files:**
- PascalCase for source classes: `SundellSource`, `PatreonSource`, `VanderLeeSource`
- camelCase for utility/handler files: `cache.ts`, `logger.ts`, `search.ts`, `response-helpers.ts`
- camelCase for handler functions: `getSwiftPattern.ts`, `searchSwiftContent.ts`, `enableSource.ts`
- Test files placed in `__tests__` subdirectories with `.test.ts` suffix: `cache.test.ts`, `registry.test.ts`

**Functions:**
- camelCase for all functions and methods: `getSwiftPatternHandler`, `searchPatterns`, `createTextResponse`
- Prefixed utility functions for clear intent: `createErrorResponse`, `toErrorMessage`, `logError`
- Handler functions follow naming convention: `[verb][Noun]Handler`: `getSwiftPatternHandler`, `searchSwiftContentHandler`
- Internal/private functions use leading underscore or are simply unexported

**Variables:**
- camelCase for all variables: `topic`, `minQuality`, `wantsCode`, `sourceManager`
- SCREAMING_SNAKE_CASE for constants: `DEFAULT_TTL`, `DEFAULT_MAX_MEMORY_ENTRIES`, `CLEANUP_INTERVAL_MS`
- Descriptive names for caches and registries: `memoryCache`, `inFlightFetches`, `sourceInstanceCache`

**Types:**
- PascalCase for interfaces and types: `ToolHandler`, `ToolContext`, `CacheEntry`, `FreeSource`, `IntentKey`
- Union types with descriptive names: `FreeSourceName = 'sundell' | 'vanderlee' | 'nilcoalescing' | 'pointfree'`
- Generic type parameters use single uppercase letters or descriptive names: `<T>`, `<SearchableDocument>`

## Code Style

**Formatting:**
- ESLint with TypeScript strict mode enabled
- 2-space indentation (standard TypeScript)
- Imported via `@eslint/js` and `typescript-eslint` packages
- ecmaVersion: 2020, Node globals enabled

**Linting:**
- TypeScript compiler set to strict mode: `"strict": true`
- Module resolution: Node16
- Target: ES2022
- Unused variables with leading underscore are ignored: `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"`
- `@typescript-eslint/no-explicit-any` is OFF (permissive)
- No require imports warned at `warn` level
- Prefer spread operators and avoid `var` declarations

**ESLint Rules:**
- `no-unused-vars`: warn (allows `_prefixed` names)
- `no-explicit-any`: off
- `no-require-imports`: warn
- `no-unused-expressions`: warn
- `no-var`: warn
- `prefer-spread`: warn

## Import Organization

**Order:**
1. Node.js built-in modules: `import fs from 'fs'`, `import path from 'path'`
2. Third-party dependencies: `import pino from 'pino'`, `import QuickLRU from 'quick-lru'`
3. Internal absolute paths with `.js` extension: `import { FileCache } from '../cache.js'`
4. Type imports grouped together: `import type { ToolHandler } from '../types.js'`

**Path Aliases:**
- No path aliases configured; uses relative imports with explicit `.js` extensions for ES module compatibility
- Example: `import { getHandler, ToolContext } from './tools/index.js'`
- Always reference with `.js` extension for compiled output

## Error Handling

**Patterns:**
- Centralized error utilities in `src/utils/errors.ts`:
  - `isError()`: Type guard checking `instanceof Error`
  - `toErrorMessage()`: Safely extracts error message from unknown values
  - `logError()`: Structured error logging with context

**Try-catch usage:**
- Silent catches with no operation are common for non-critical operations:
  ```typescript
  try {
    await fsp.writeFile(cachePath, JSON.stringify(entry));
  } catch {
    // Cache write failed, continue without caching
  }
  ```
- Error context logged via `logger.error()` from pino

**Async error propagation:**
- Promise rejections in background operations use `.catch(() => {})` pattern:
  ```typescript
  this.clearExpired().catch(() => {});
  ```

## Logging

**Framework:** Pino (`pino`)

**Configuration:**
- Initialized in `src/utils/logger.ts`
- Base service name: `'swift-patterns-mcp'`
- Log level controlled by `LOG_LEVEL` env var (default: `'info'`)

**Patterns:**
- Use named logger instance: `import logger from './logger.js'`
- Standard pino methods: `logger.info()`, `logger.error()`, `logger.warn()`
- Error logging includes structured context:
  ```typescript
  logger.error({ context, ...details, err: error }, message)
  ```
- Info messages with object context:
  ```typescript
  logger.info('Patreon auto-enabled (credentials detected)')
  ```

## Comments

**When to Comment:**
- JSDoc comments on exported functions and types
- Inline comments for complex algorithms or non-obvious logic
- Section dividers using ASCII art for visual organization:
  ```typescript
  // ─── get / set basics ───
  // ─── memory vs file cache ───
  ```

**JSDoc/TSDoc:**
- Used extensively for public APIs
- Document parameters, return types, and purpose
- Example from `src/utils/errors.ts`:
  ```typescript
  /**
   * Safely extracts an error message from any thrown value.
   * Returns error.message if Error, String(error) otherwise.
   */
  export function toErrorMessage(error: unknown): string
  ```

## Function Design

**Size:** Functions are focused and typically under 50 lines; longer logic broken into helpers

**Parameters:**
- Accept specific parameters, avoid large options objects in most cases
- Use type inference where appropriate: `args?.topic as string`
- Generic types for reusable utilities: `async get<T>(key: string): Promise<T | null>`

**Return Values:**
- Explicit return types in function signatures
- Nullable returns use `| null`: `Promise<T | null>`
- Union types for multiple possible returns: `Promise<BasePattern[]>`
- Response objects standardized via helpers: `createTextResponse()`, `createErrorResponse()`

## Module Design

**Exports:**
- Named exports for most utilities and handlers
- Default exports for class-based modules: `export default FileCache`, `export default SundellSource`
- Type exports use `export type`: `export type FreeSourceName`

**Barrel Files:**
- Minimal barrel file in `src/tools/index.ts` re-exports key types and getters
- Used for cleaner imports: `import { getHandler, ToolContext } from './tools/index.js'`

## Async Patterns

**Promise handling:**
- Use `async/await` consistently for readability
- `Promise.allSettled()` for multiple independent async operations that may fail:
  ```typescript
  const results = await Promise.allSettled(
    names.map(name => dedupSearch(name, getSource(name), query))
  );
  ```
- Deduplication of concurrent identical fetches via `InflightDeduper` pattern

**Fire-and-forget:**
- Background operations use `.catch(() => {})` for silent error suppression:
  ```typescript
  fsp.unlink(cachePath).catch(() => {});
  ```

---

*Convention analysis: 2026-02-07*
