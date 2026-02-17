# Testing Patterns

**Analysis Date:** 2026-02-17

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config file: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect` API (similar to Jest)

**Run Commands:**
```bash
npm test                    # Run all tests (src/__tests__, src/cli/__tests__, etc.)
npm run test:coverage       # Run with coverage report (v8 provider)
npm run test:integration    # Run integration tests separately
npm run test:e2e            # Run end-to-end tests
npm run test:patreon        # Run Patreon-specific e2e tests
npm run test:load           # Run load tests
npm run bench               # Run benchmarks
```

## Test File Organization

**Location:**
- Co-located with source: `__tests__` directory alongside modules
- Pattern: `src/module/__tests__/`, `src/tools/__tests__/`, `src/sources/free/__tests__/`
- Separate integration tests: `src/integration/__tests__/` (marked with `slow/` subdirectory for slow tests)

**Naming:**
- Test files: `{moduleName}.test.ts`
- Examples: `cache.test.ts`, `handlers.test.ts`, `sundell.test.ts`, `patreon-oauth.test.ts`

**Structure:**
```
src/
├── __tests__/
│   └── fixtures/           # Shared test data and fixtures
├── utils/__tests__/
│   ├── cache.test.ts
│   ├── search.test.ts
│   └── ...
├── tools/__tests__/
│   └── registry.test.ts
└── tools/handlers/__tests__/
    ├── handlers.test.ts
    ├── getPatreonPatterns.test.ts
    └── harness.ts          # Test helper utilities
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ClassName or Feature', () => {
  let instance: TypeName;

  beforeEach(() => {
    // Setup
    instance = new TypeName();
  });

  afterEach(async () => {
    // Teardown
    await instance.cleanup();
  });

  describe('Logical Sub-Feature', () => {
    it('should do X when Y', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

**Example from cache.test.ts (lines 28-82):**
```typescript
describe('FileCache', () => {
  let cache: FileCache;

  beforeEach(() => {
    cache = new FileCache(uniqueNamespace(), 50);
  });

  afterEach(async () => {
    await cache.clear();
  });

  // ─── get / set basics ───

  describe('get/set basics', () => {
    it('should return null for non-existent key', async () => {
      const result = await cache.get('missing');
      expect(result).toBeNull();
    });
    // ... more tests
  });
});
```

**Patterns:**
- Setup: create instances in `beforeEach`, assign to local `let` variables
- Teardown: cleanup resources in `afterEach` (call `.clear()`, reset mocks)
- Async operations: use `async` keyword in test functions, `await` async code
- Comment separators: ASCII dividers to group related test sections (`// ─── section name ───`)

## Mocking

**Framework:** Vitest's `vi` module (similar to Jest)

**Patterns:**

1. **Module mocking (vi.mock):**
   ```typescript
   vi.mock('../../../sources/free/sundell.js', () => ({
     default: class SundellSourceMock {
       searchPatterns = vi.fn().mockResolvedValue(FREE_SOURCE_PATTERNS.sundell);
     },
   }));
   ```
   - Hoisted mocks defined before imports (top of file)
   - Return default export or named exports as needed

2. **Spy creation (vi.spyOn):**
   ```typescript
   const logSpy = vi.spyOn(console, 'log');
   // Later: logSpy.mock.calls to inspect calls
   ```

3. **Function mocks (vi.fn):**
   ```typescript
   const mockFetch = vi.hoisted(() => vi.fn());
   vi.mock('../utils/fetch.js', () => ({
     fetch: mockFetch,
   }));
   ```
   - `vi.hoisted()` ensures mock is defined before imports
   - Use `.mockResolvedValue()` for async functions
   - Use `.mockReturnValue()` for sync functions

4. **Mock reset:**
   ```typescript
   beforeEach(() => {
     mockFn.mockReset();
     // or vi.clearAllMocks() for all mocks
   });
   ```

**Example from handlers.test.ts (lines 12-52):**
```typescript
vi.mock('../../../sources/free/sundell.js', () => ({
  default: class SundellSourceMock {
    searchPatterns = vi.fn().mockResolvedValue(FREE_SOURCE_PATTERNS.sundell);
  },
}));

// ... more source mocks ...

vi.mock('../../../config/sources.js', () => ({
  default: class SourceManagerMock {
    getSemanticRecallConfig = vi.fn().mockReturnValue({
      enabled: false,
      minLexicalScore: 0.35,
      minRelevanceScore: 70,
    });
    getMemvidConfig = vi.fn().mockReturnValue({
      enabled: false,
      autoStore: false,
      useEmbeddings: false,
      embeddingModel: 'bge-small',
    });
  },
}));
```

**What to Mock:**
- External dependencies: HTTP clients, file system (in integration tests), databases
- Expensive operations: network requests, file I/O (cache operations)
- Other modules: sources, handlers, configuration managers
- Time-sensitive operations: timers, dates (use `vi.useFakeTimers()`)

**What NOT to Mock:**
- Utility functions: pure functions like validation, formatting
- Core business logic: functions being tested
- Standard library: fs/promises, path (mock indirectly by controlling test data)

**Example: Real timer vs fake timer (cache.test.ts lines 64-81):**
```typescript
it('should return null after TTL expires', async () => {
  vi.useFakeTimers();
  try {
    await cache.set('ttl-key', 'value', 1); // 1 second TTL

    // Still valid immediately
    const before = await cache.get('ttl-key');
    expect(before).toBe('value');

    // Advance past TTL
    vi.advanceTimersByTime(2000);

    const after = await cache.get('ttl-key');
    expect(after).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
```

## Fixtures and Factories

**Test Data:**
- Shared fixtures in `src/__tests__/fixtures/` (e.g., `patterns.js`, `tool-context.js`)
- Source-specific fixtures in module directories: `src/sources/premium/__tests__/` may define test data inline
- Helper functions for generating test data (seen in `cache.test.ts` lines 10-21):
  ```typescript
  function uniqueNamespace(): string {
    namespaceCounter += 1;
    return `cache-test-${Date.now()}-${namespaceCounter}`;
  }

  function toCacheFilename(key: string): string {
    if (key.length > 100) {
      return `${'x'.repeat(32)}.json`;
    }
    return `${key.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
  }
  ```

**Location:**
- Shared fixtures: `src/__tests__/fixtures/`
- Module-specific: `src/{module}/__tests__/harness.ts` or inline
- Factory functions: `createHandlerContext()`, `createToolContext()` in harness files

**Example from harness.ts (lines 10-12):**
```typescript
export function createHandlerContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return createToolContext(overrides);
}
```

## Coverage

**Requirements:** Minimum thresholds enforced
- Statements: 30%
- Branches: 25%
- Functions: 30%
- Lines: 30%

**View Coverage:**
```bash
npm run test:coverage      # Generate and view coverage report
# Output: text + HTML report in coverage/ directory
```

**Report Format:** v8 provider generates text and HTML reports

**Excluded from coverage:**
- Test files: `**/__tests__/**`, `**/*.test.ts`, `**/*.spec.ts`
- Type definitions: `**/*.d.ts`
- Integration tests: `src/integration/**`
- Fixtures: `**/fixtures/**`
- Build output: `build/**`, `dist/**`

## Test Types

**Unit Tests:**
- Scope: individual functions and classes
- Approach: mock dependencies, test behavior in isolation
- Examples: `cache.test.ts`, `search.test.ts`, `validation` tests in handlers
- Location: alongside source in `__tests__/` directories

**Integration Tests:**
- Scope: multiple modules working together
- Approach: real dependencies, minimal mocking
- Examples: `src/integration/__tests__/cache-behavior.test.ts`, `mcp-client.test.ts`
- Marked as slow: `src/integration/__tests__/slow/` directory
- Run separately: `npm run test:integration`

**E2E Tests:**
- Scope: full system end-to-end
- Tools: Playwright (included in dependencies)
- Examples: `scripts/test-e2e.ts` (run via `npm run test:e2e`)
- Patreon tests: `scripts/test-patreon-e2e.ts` (run via `npm run test:patreon`)

## Common Patterns

**Async Testing:**
```typescript
// Use async/await with await in test
it('should fetch and cache data', async () => {
  const result = await cache.getOrFetch('key', async () => {
    return 'data';
  });
  expect(result).toBe('data');
});

// Or Promise.all for concurrent operations
it('should deduplicate concurrent fetches', async () => {
  const promises = Array.from({ length: 5 }, () =>
    cache.getOrFetch('dedup-key', fetcher)
  );
  const results = await Promise.all(promises);
  expect(results).toEqual(Array(5).fill('deduped'));
});
```

**Error Testing:**
```typescript
// Assert thrown errors
it('should throw on invalid config', async () => {
  await expect(setupInvalidConfig()).rejects.toThrow('Invalid');
});

// Assert error responses in handlers
it('should return error when topic is missing', async () => {
  const result = await getSwiftPatternHandler({}, context);
  expect(result.content[0].text).toContain('Missing required argument');
  expect(result.isError).toBe(true);
});

// Assert error messages
it('returns null for corrupt JSON cache file', async () => {
  const cachePath = path.join(getCacheDir(namespace), toCacheFilename('corrupt-key'));
  await fsp.writeFile(cachePath, '{not-valid-json');

  await expect(cache.get('corrupt-key')).resolves.toBeNull();
});
```

**Deterministic Testing:**
- ESLint rule forbids `Math.random()` in test files (tools tests)
- ESLint rule forbids `crypto.randomUUID()` in test files (tools tests)
- Use fixtures or predictable namespaces instead:
  ```typescript
  // Good: deterministic namespace
  const namespace = `test-${Date.now()}-${index}`;

  // Bad: would fail ESLint in tools tests
  // const id = Math.random().toString();
  ```

**State Management in Tests:**
```typescript
describe('FileCache', () => {
  let cache: FileCache;

  beforeEach(() => {
    cache = new FileCache(uniqueNamespace(), 50);
  });

  afterEach(async () => {
    await cache.clear();  // Cleanup between tests
  });

  // Each test gets fresh instance
});
```

## Configuration

**Excluded from test runs:**
- `**/node_modules/**`
- `**/build/**`
- `**/dist/**`
- `**/.opencode/**`
- `**/.claude/**`

**Setup file:** `vitest.setup.ts`
- Environment config loading: `import 'dotenv/config'`
- Conditional mocking: `keytar` mocked in CI environment
- Example:
  ```typescript
  if (process.env.CI) {
    vi.mock('keytar', () => ({
      default: {
        getPassword: vi.fn().mockResolvedValue(null),
        setPassword: vi.fn().mockResolvedValue(undefined),
        deletePassword: vi.fn().mockResolvedValue(true),
      },
    }));
  }
  ```

---

*Testing analysis: 2026-02-17*
