# Coding Conventions

**Analysis Date:** 2026-01-29

## Naming Patterns

**Files:**
- Handlers use verb-noun pattern: `getSwiftPattern.ts`, `searchSwiftContent.ts`, `listContentSources.ts`, `enableSource.ts`
- Utility files use descriptive names: `cache.ts`, `logger.ts`, `search.ts`, `response-helpers.ts`
- Source implementations use domain names: `sundell.ts`, `vanderlee.ts`, `patreon.ts`, `youtube.ts`
- Test files co-located with source using `__tests__` directory: `src/utils/__tests__/cache.test.ts`

**Functions:**
- Handlers exported as const with camelCase: `export const getSwiftPatternHandler`
- Exported helper functions use camelCase: `searchMultipleSources()`, `formatTopicPatterns()`, `createTextResponse()`
- Private functions also camelCase: `trySemanticRecall()`, `recordError()`, `clearError()`
- Async functions clearly async: `async function`, `Promise<T>` return types

**Variables:**
- Constants use SCREAMING_SNAKE_CASE: `DEFAULT_TTL`, `DEFAULT_MAX_MEMORY_ENTRIES`, `CLEANUP_INTERVAL_MS`, `SEMANTIC_TIMEOUT_MS`
- Module-level singletons use lowercase: `const handlers = new Map()`
- Cache entries/typed objects use descriptive names: `memEntry`, `cacheData`, `intentKey`, `semanticResults`

**Types:**
- Interfaces for external contracts and APIs: `ToolContext`, `ToolResponse`, `ToolHandler`, `PatreonPattern`
- PascalCase for type names: `ToolHandler`, `PatreonPattern`, `CreatorInfo`, `FileCache`
- Interfaces for internal structures: `SemanticRecallOptions`, `CacheEntry<T>`, `YouTubeStatus`
- Type aliases use `Type` suffix when appropriate: `IntentKey`, `StorableCachedSearchResult`

## Code Style

**Formatting:**
- Prettier automatically applied (no config file present, uses defaults)
- Default Prettier settings: 80 character line width (observed from code)
- Semicolons enforced
- Single quotes not strictly enforced in configs (mixed usage)
- Trailing commas in multiline structures

**Linting:**
- ESLint with TypeScript support via `@eslint/js` and `typescript-eslint`
- Config: `eslint.config.js` (flat config format, ES modules)
- Unused variable warning: `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"` (prefix with `_` to ignore)
- Explicit any is allowed: `@typescript-eslint/no-explicit-any: "off"`
- Warn on require imports: `@typescript-eslint/no-require-imports: "warn"`
- Warn on unused expressions and `var` declarations
- Focus on catching actual issues rather than strict style enforcement

## Import Organization

**Order:**
1. Built-in Node modules: `import fs from 'fs'`, `import path from 'path'`
2. External packages: `import pino from 'pino'`, `import { Server } from "@modelcontextprotocol/sdk/server/index.js"`
3. Type imports from project: `import type { ToolHandler } from '../types.js'`
4. Value imports from project: `import SourceManager from '../../config/sources.js'`
5. Relative imports further in path

**Path Aliases:**
- No path aliases configured; all imports use relative paths with explicit `.js` extensions for ES module compatibility
- Pattern: `'../../utils/cache.js'`, `'./registry.js'` (always include `.js`)

**Example Import Block:**
```typescript
// src/tools/handlers/getSwiftPattern.ts
import type { ToolHandler } from '../types.js';
import { getSourceNames, searchMultipleSources, type FreeSourceName } from '../../utils/source-registry.js';
import { formatTopicPatterns, COMMON_FORMAT_OPTIONS, detectCodeIntent } from '../../utils/pattern-formatter.js';
import { createTextResponse } from '../../utils/response-helpers.js';
import { intentCache, type IntentKey, type StorableCachedSearchResult } from '../../utils/intent-cache.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import { getMemvidMemory } from '../../utils/memvid-memory.js';
import SourceManager from '../../config/sources.js';
import logger from '../../utils/logger.js';
```

## Error Handling

**Patterns:**
- Use `logError()` utility for consistent error logging: `logError('ContextName', error, { details })`
- Type-safe error message extraction: `toErrorMessage(error: unknown): string` converts any error to string
- Best-effort error recovery with fallback returns: `catch { return [] }` instead of rethrowing
- Error responses use `createErrorResponseFromError()` helper for MCP tool responses
- Errors logged with structured context and optional details for debugging

**Example Error Handling:**
```typescript
// src/sources/premium/youtube.ts
try {
  // operation
} catch (error) {
  recordError(toErrorMessage(error));
  logError('YouTube', error, { channelId });
}

// src/tools/handlers/searchSwiftContent.ts
async function trySemanticRecallInner(options: SemanticRecallOptions): Promise<BasePattern[]> {
  try {
    // semantic recall logic
  } catch {
    // Semantic recall is best-effort; return empty on any failure
    return [];
  }
}
```

## Logging

**Framework:** Pino (`pino` v9.5.0)

**Configuration:**
- Configured in `src/utils/logger.ts`
- Log level from `LOG_LEVEL` env var or default `info`
- Service name: `swift-patterns-mcp`

**Patterns:**
- Use `logger.info()`, `logger.warn()`, `logger.error()` with structured payloads
- Include error objects: `logger.error({ err: error }, message)`
- Fire-and-forget warning logs: `.catch(err => { logger.warn({ err }, 'message') })`
- Always use `logError(context, error, details?)` helper for consistency

**Example Logging:**
```typescript
logger.warn({ err }, 'Failed to store patterns in memvid');
logger.error({ ...payload, err: error }, message);
logger.info({ service: 'swift-patterns-mcp' }, 'Startup');
```

## Comments

**When to Comment:**
- Complex algorithms or unintuitive logic get explanatory comments
- Intent clarification for error handling: `// Semantic recall is best-effort; return empty on any failure`
- State management explanations: `// Cache hit - use cached patterns`
- Business logic reasoning: `// Filter by quality`, `// Sort by relevance`
- Line-level comments for non-obvious transformations
- Avoid commenting obvious code (e.g., variable assignments)

**JSDoc/TSDoc:**
- Used for public exported functions and complex interfaces
- Document function purpose, parameters, return type:
  ```typescript
  /**
   * Register a tool handler by name
   */
  export function registerHandler(name: string, handler: ToolHandler): void
  ```
- Type definitions include purpose comments:
  ```typescript
  /**
   * Context passed to tool handlers
   */
  export interface ToolContext { }
  ```
- Utility functions document behavior:
  ```typescript
  /**
   * Safely extracts an error message from any thrown value.
   */
  export function toErrorMessage(error: unknown): string
  ```

## Function Design

**Size:**
- Most functions 10-50 lines for readability
- Handler functions 50-100 lines acceptable when implementing complete tool logic
- Complex multi-step operations broken into helper functions
- Example: `getSwiftPatternHandler` is 101 lines implementing full pattern fetching, caching, and memvid integration

**Parameters:**
- Handlers use destructured args pattern: `(args: Record<string, unknown>, context: ToolContext)`
- Type-safe casting in handler: `const topic = args?.topic as string`
- Options objects for multiple parameters: `interface SemanticRecallOptions { ... }`
- Optional context passed in second parameter instead of globally

**Return Values:**
- Handlers return typed `ToolResponse`: `{ content: [{ type: string; text: string }], isError?: boolean }`
- Async operations return `Promise<T>` with clear type
- Cache operations return `T | null` for miss detection
- Search/fetch operations return arrays: `Promise<BasePattern[]>`

## Module Design

**Exports:**
- Each file exports one primary thing (class, function, constant set)
- Handler files export single `Handler` const: `export const getSwiftPatternHandler: ToolHandler`
- Utility files export multiple functions: `export function get...`, `export function set...`
- Registry file exports named functions not default: `export function registerHandler()`, `export function getHandler()`

**Barrel Files:**
- Minimal barrel file usage
- Main entry: `src/index.ts` imports and registers all tools
- Tools directory has `src/tools/index.js` for re-exports to make imports cleaner

**Example Module:**
```typescript
// src/utils/response-helpers.ts
export function createTextResponse(text: string): ToolResponse { }
export function createErrorResponseFromError(error: unknown): ToolResponse { }

// src/tools/registry.ts
export function registerHandler(name: string, handler: ToolHandler): void { }
export function getHandler(name: string): ToolHandler | undefined { }
export function hasHandler(name: string): boolean { }
```

---

*Convention analysis: 2026-01-29*
