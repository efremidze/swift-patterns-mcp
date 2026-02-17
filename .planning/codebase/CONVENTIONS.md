# Coding Conventions

**Analysis Date:** 2026-02-17

## Naming Patterns

**Files:**
- Source files: `camelCase.ts` (e.g., `getSwiftPattern.ts`, `cache.ts`, `response-helpers.ts`)
- Class files: `camelCase.ts` with PascalCase class names (e.g., `FileCache` in `cache.ts`, `SundellSource` in `sundell.ts`)
- Test files: `{name}.test.ts` or `{name}.spec.ts` (e.g., `cache.test.ts`, `handlers.test.ts`)
- Test directories: `__tests__` placed alongside or within source directories
- Config files: `camelCase.ts` or `kebab-case.ts` (e.g., `eslint.config.js`, `vitest.config.ts`)

**Functions:**
- Exported functions: `camelCase` with descriptive verb-first naming
  - Examples: `validateRequiredString()`, `getSwiftPatternHandler()`, `formatMarkdownDocument()`, `createErrorResponse()`
- Handler functions: suffix with `Handler` (e.g., `getSwiftPatternHandler`, `searchSwiftContentHandler`)
- Type guard functions: prefix with `is` (e.g., `isValidationError()`, `isExpired()`)
- Helper/utility functions: verb-noun format (e.g., `createTextResponse()`, `formatMarkdownSections()`, `getCacheKey()`)
- Private methods: same as public functions, prefixed with underscore (e.g., `_startPeriodicCleanup()`, `_ensureCacheDir()`)

**Variables:**
- Local variables: `camelCase` (e.g., `cacheDir`, `memoryHits`, `normalizedTopic`)
- Constants (file-level): `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TTL`, `CLEANUP_INTERVAL_MS`, `HYBRID_VARIANT_LIMIT`)
- Object properties: `camelCase` (e.g., `data`, `timestamp`, `ttl`)
- Unused parameters: prefix with underscore to suppress linting (e.g., `_url`, `_name`)

**Types:**
- Interfaces: `PascalCase`, often suffixed with intent (e.g., `ToolContext`, `CacheEntry<T>`, `MarkdownSection`)
- Type aliases: `PascalCase` (e.g., `FreeSourceName`, `IntentKey`)
- Union types: `Type1 | Type2` format
- Discriminated unions: use literal string types for narrowing
- Generic type parameters: single capital letters (e.g., `<T>`) or descriptive names (e.g., `<Pattern>`)

## Code Style

**Formatting:**
- Prettier configuration: not explicitly configured in project root (relies on defaults)
- Line length: follows default settings
- Indentation: 2 spaces (TypeScript/JavaScript standard)
- Semicolons: required
- Quotes: single quotes preferred in code (seen in `vitest` config and imports)

**Linting:**
- Tool: ESLint with TypeScript support (`eslint`, `typescript-eslint`)
- Config file: `eslint.config.js`
- Strict TypeScript: enabled (`strict: true` in `tsconfig.json`)
- Key rules enforced:
  - `@typescript-eslint/no-unused-vars`: warn for unused variables (underscore prefix exempts params/vars)
  - `@typescript-eslint/no-explicit-any`: off (allows `any` type when needed)
  - `@typescript-eslint/no-require-imports`: warn
  - `no-var`: warn (prefer `const`/`let`)
  - Focused tests (`describe.only`, `it.only`, `test.only`): error - not allowed in committed code
  - Random values in tests: error - use deterministic fixtures instead of `Math.random()` or `crypto.randomUUID()`

**Async Handling:**
- Use `async/await` syntax throughout
- Error handling in async code: try/catch blocks (see `cache.ts` line 84-97, `cache.ts` line 188-207)
- Fire-and-forget promises acceptable with `.catch(() => {})` when expected (e.g., `clearExpired().catch(() => {})`)

## Import Organization

**Order:**
1. Built-in Node.js modules (`fs`, `path`, `crypto`, `http`)
2. Third-party packages (`vitest`, `express`, utilities)
3. Local relative imports (`./` paths)

**Path Aliases:**
- Relative imports use explicit paths with `.js` file extension required (TypeScript ESM)
- Examples: `import { getSourceNames } from '../../utils/source-registry.js'`
- Root-relative imports: none detected (avoid `@/` aliases in this project)

**Style rules:**
- One import per line within destructuring
- Multi-line imports: aligned vertically
- Unused imports: not allowed (ESLint warns)
- Type imports: use `import type { ... }` syntax (seen throughout, e.g., `import type { ToolHandler } from '../types.js'`)

**Example from getSwiftPattern.ts (lines 3-20):**
```typescript
import type { ToolHandler } from '../types.js';
import { FREE_SOURCE_NAMES, getSourceNames, searchMultipleSources, type FreeSourceName } from '../../utils/source-registry.js';
import { formatTopicPatterns, COMMON_FORMAT_OPTIONS, detectCodeIntent } from '../../utils/pattern-formatter.js';
import { createMarkdownResponse, createTextResponse } from '../../utils/response-helpers.js';
import type { IntentKey } from '../../utils/intent-cache.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import { CREATORS } from '../../config/creators.js';
import { validateRequiredString, validateOptionalString, validateOptionalNumber, isValidationError } from '../validation.js';
import { cachedSearch } from './cached-search.js';
```

## Error Handling

**Pattern: Validation-First Return**
- Tool handlers validate arguments using `validateRequired*()` and `validateOptional*()` functions
- Validation functions return either the value or a `ToolResponse` error
- Check results with `isValidationError()` type guard before proceeding
- Pattern (from `getSwiftPattern.ts` lines 125-130):
  ```typescript
  const topic = validateRequiredString(args, 'topic');
  if (isValidationError(topic)) return topic;
  const sourceValidated = validateOptionalString(args, 'source');
  if (isValidationError(sourceValidated)) return sourceValidated;
  ```

**Response Errors:**
- Use `createErrorResponse(message)` for string messages
- Use `createErrorResponseFromError(error)` for caught exceptions
- Use `createTextResponse()` for validation hints and user guidance
- Prefix error messages with "Error:" when using `createErrorResponse()`

**Async Errors:**
- Catch errors in async operations and return gracefully
- Don't let exceptions bubble in tool handlers—wrap in try/catch and return error response
- Suppress errors with `.catch(() => {})` only for fire-and-forget operations (e.g., background cleanup)
- Use `Promise.allSettled()` for parallel operations that may fail individually

**Example from cache.ts (lines 98-103):**
```typescript
} catch {
  // Cache read failed (file doesn't exist or is corrupted), return null
}
this.misses += 1;
return null;
```

## Logging

**Framework:** `console` or `pino` (pino is a dependency, but most code uses console)

**Patterns:**
- Minimal logging in library code
- Structured logging not enforced
- Use console for stdout/stderr
- Spies in tests: `vi.spyOn(console, 'log')` to verify logging

## Comments

**When to Comment:**
- JSDoc comments on public functions and classes
- Inline comments for non-obvious logic or workarounds
- Section separators: decorative ASCII lines for logical grouping (e.g., `// ─── get/set basics ───` in test files)
- Comments above test sections to describe intent

**JSDoc/TSDoc:**
- Used sparingly; focus on parameters, return types, and complex logic
- Example from `validation.ts` (lines 6-8):
  ```typescript
  /**
   * Validate a required string argument
   * @returns Trimmed string value or ToolResponse error
   */
  ```

## Function Design

**Size:** No strict limits, but prefer focused functions (utilities typically 10-50 lines)

**Parameters:**
- Single object parameter for options/config (e.g., `constructor(namespace: string, maxMemoryEntries: number)`)
- Required positional parameters before optional ones
- Destructure object parameters in many utilities

**Return Values:**
- Tool handlers always return `ToolResponse` (synchronous or via Promise)
- Utility functions return specific types with TypeScript generics
- Methods often return `Promise<T>` for async operations
- Type-safe error returns: validation functions return `ErrorType | SuccessType` union

**Example from validation.ts (lines 10-21):**
```typescript
export function validateRequiredString(
  args: Record<string, unknown>,
  name: string,
  usageHint?: string
): string | ToolResponse {
  const value = args?.[name];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  const msg = `Missing required argument: ${name}`;
  return createTextResponse(usageHint ? `${msg}\n\n${usageHint}` : msg);
}
```

## Module Design

**Exports:**
- Named exports for utilities: `export function`, `export class`, `export const`
- Default export for class modules: `export default ClassName` (seen in source modules like `sundell.ts`)
- Type exports: `export type { TypeName }`
- Re-export common patterns: barrel files index commonly used types and functions

**Example from cache.ts (line 237-238):**
```typescript
// Shared cache instances
export const rssCache = new FileCache('rss');
export const articleCache = new FileCache('articles');
```

**Barrel Files:**
- Used in `src/tools/`, `src/utils/`, and other directories
- Index file exports key functions and types for convenience
- Example: `src/tools/index.ts` re-exports all tool registrations

---

*Convention analysis: 2026-02-17*
