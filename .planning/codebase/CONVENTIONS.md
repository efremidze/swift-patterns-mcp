# Coding Conventions

**Analysis Date:** 2026-01-16

## Naming Patterns

**Files:**
- camelCase for standard modules: `rssPatternSource.ts`, `swiftAnalysis.ts`
- kebab-case for multi-word: `source-manager.ts`, `patreon-oauth.ts`
- Test files: `*.test.ts` co-located with source
- CLI files: Shebang `#!/usr/bin/env node` at top

**Functions:**
- camelCase for all functions: `fetchPatterns()`, `detectTopics()`, `calculateRelevance()`
- No special prefix for async functions
- Handler/action verbs: `enable`, `disable`, `list`, `reset`
- Boolean checkers: `hasCodeContent()`, `isExpired()`, `isSourceConfigured()`

**Variables:**
- camelCase for variables: `topicKeywords`, `qualitySignals`, `cacheKey`
- UPPER_SNAKE_CASE for constants: `DEFAULT_TTL`, `STOPWORDS`, `PATREON_API`
- No underscore prefix for private members (use TypeScript `private`)

**Types:**
- PascalCase for interfaces: `BasePattern`, `ContentSource`, `SearchResult`
- PascalCase for types: `SourceAction`, `CacheEntry`
- No I prefix for interfaces: `BasePattern` not `IBasePattern`
- Pattern suffix for content models: `SundellPattern`, `PatreonPattern`

## Code Style

**Formatting:**
- 2-space indentation (consistent across all files)
- Semicolons required at end of statements
- Double quotes for strings: `"value"`
- Trailing commas in multi-line constructs
- Line length: ~100-120 characters (implicit)

**Linting:**
- ESLint with `eslint.config.js` (flat config format)
- TypeScript ESLint plugin for type-aware rules
- `@typescript-eslint/no-unused-vars` intentionally disabled
- Lint command: `npm run lint` (runs `tsc --noEmit`)

## Import Organization

**Order:**
1. Side-effect imports: `import 'dotenv/config'`
2. External packages: `import { Server } from "@modelcontextprotocol/sdk/..."`
3. Local modules by layer: config → sources → utils
4. Type imports: `import type { ... }` (when applicable)

**Grouping:**
- No blank lines between import groups (single block)
- Alphabetical within groups not enforced

**Path Style:**
- Explicit `.js` extensions for local imports: `import X from "./module.js"`
- Required for Node16 module resolution

## Error Handling

**Patterns:**
- Graceful degradation: Return empty arrays on non-critical failures
- Silent catch for cache operations: Continue without error surfacing
- User-facing errors: Log and exit with `process.exit(1)` in CLI

**Error Types:**
- Throw on critical failures: Auth errors, missing required config
- Return empty/null on recoverable failures: API timeouts, cache misses
- Log context before throwing: `console.error('Context:', details)`

**Example Pattern:**
```typescript
try {
  return await fetchData();
} catch {
  console.error('Fetch failed');
  return [];  // Graceful degradation
}
```

## Logging

**Framework:**
- console.log for normal output
- console.error for errors
- No structured logging library

**Patterns:**
- CLI uses emoji for status: `✅`, `❌`, `⚠️`, `🔄`
- Section dividers in CLI output: `━━━━━━━━━━━━━━━━`
- No logging in utility functions (pure functions)

## Comments

**When to Comment:**
- JSDoc for public API functions with `@param`, `@returns`
- Inline comments for complex logic or non-obvious behavior
- Section dividers for logical groupings in large files

**JSDoc Style:**
```typescript
/**
 * Detect topics from text based on keyword matching
 * @param text The text to analyze
 * @param keywords Map of topic names to keyword arrays
 * @returns Array of detected topic names
 */
export function detectTopics(text: string, keywords: Record<string, string[]>): string[] {
```

**Section Dividers:**
```typescript
// ============================================================================
// FREE SOURCES - Always available, no authentication
// ============================================================================
```

**TODO Format:**
- Simple: `// TODO: description`
- Not used extensively in current codebase

## Function Design

**Size:**
- No hard limit, but functions tend to be focused
- Large functions exist in `src/index.ts` (tool handlers)

**Parameters:**
- Destructuring for object params: `({ id, name }: Props)`
- Options objects for 3+ params (not consistently applied)

**Return Values:**
- Explicit returns, especially for async functions
- Return early for error cases
- Return empty arrays/null for recoverable failures

## Module Design

**Exports:**
- Default exports for class-based modules: `export default SundellSource`
- Named exports for utility functions: `export function detectTopics(...)`
- Mixed when needed: Default class + named types

**Class Pattern:**
```typescript
export default class SourceName extends BaseClass {
  constructor(options?: Options) { ... }
  async fetchPatterns(): Promise<Pattern[]> { ... }
}
```

**Module Pattern:**
```typescript
// Pure functions, no state
export function utilityFunction(input: T): R { ... }
export function anotherFunction(input: T): R { ... }
```

**Barrel Files:**
- Not used (no index.ts barrel exports)
- Direct imports preferred: `from "./module.js"`

---

*Convention analysis: 2026-01-16*
*Update when patterns change*
