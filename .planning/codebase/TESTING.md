# Testing Patterns

**Analysis Date:** 2026-02-09

## Test Framework

**Runner:**
- **Framework:** Vitest 3.2.4
- **Config:** `vitest.config.ts`
- **Setup file:** `vitest.setup.ts` (loads environment variables via dotenv)

**Assertion Library:**
- **Built-in:** Vitest uses `expect()` from its own API (compatible with Jest)
- **No additional assertion library:** Standard `expect()` assertions throughout

**Run Commands:**
```bash
npm test                 # Run all tests (vitest run)
npm run watch          # Watch mode (tsc --watch)
npm run lint           # ESLint + TypeScript check
npm run pretest        # Runs "npm run build" before tests
```

**Config Details:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**',
    ],
  },
});
```

## Test File Organization

**Location:**
- **Pattern:** Co-located in `__tests__` subdirectories adjacent to source
- **Examples:**
  - `src/utils/__tests__/cache.test.ts` (tests `src/utils/cache.ts`)
  - `src/tools/__tests__/registry.test.ts` (tests `src/tools/registry.ts`)
  - `src/tools/handlers/__tests__/handlers.test.ts` (tests multiple handlers in `src/tools/handlers/`)
  - `src/integration/__tests__/mcp-client.test.ts` (integration tests)

**Naming:**
- **Pattern:** `<module>.test.ts` (not `.spec.ts`)
- **Example:** `cache.test.ts`, `handlers.test.ts`, `getPatreonPatterns.test.ts`

**Structure:**
```
src/
├── utils/
│   ├── cache.ts
│   └── __tests__/
│       └── cache.test.ts
├── tools/
│   ├── registry.ts
│   ├── __tests__/
│   │   └── registry.test.ts
│   └── handlers/
│       ├── getSwiftPattern.ts
│       └── __tests__/
│           └── handlers.test.ts
└── integration/
    ├── test-client.ts
    └── __tests__/
        ├── mcp-client.test.ts
        └── response-quality.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// src/tools/handlers/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('getSwiftPatternHandler', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = {
      sourceManager: createMockSourceManager() as any,
      patreonSource: null,
    };
  });

  it('should return error when topic is missing', async () => {
    const result = await getSwiftPatternHandler({}, context);
    expect(result.content[0].text).toContain('Missing required argument');
  });

  it('should filter by specific source when provided', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'swift',
      source: 'sundell',
    }, context);
    expect(result.content[0].text).toContain('Advanced SwiftUI Patterns');
  });
});
```

**Patterns:**
- **Setup per test:** `beforeEach()` creates fresh context/state for isolation
- **Teardown per test:** `afterEach()` cleans up resources (file cache, timers)
- **Named test cases:** Describe expected behavior in plain English
- **Single assertion focus:** Most tests verify one behavior; complex tests have related assertions
- **Arrange-Act-Assert:** Clear separation of test setup, execution, and verification

## Mocking

**Framework:** Vitest's built-in `vi` (from `vitest` package)

**Patterns:**
```typescript
// Mock entire module
vi.mock('../../../sources/free/sundell.js', () => ({
  default: class SundellSourceMock {
    searchPatterns = vi.fn().mockResolvedValue(MOCK_PATTERNS.sundell);
  },
}));

// Mock function within test
const fetcher = vi.fn().mockResolvedValue('deduped');

// Create mock objects
const createMockSourceManager = () => ({
  getAllSources: vi.fn().mockReturnValue(sources),
  getSource: vi.fn((id: string) => sources.find(s => s.id === id)),
  getEnabledSources: vi.fn().mockReturnValue(sources.filter(s => s.isEnabled)),
});

// Verify calls
expect(context.sourceManager.enableSource).toHaveBeenCalledWith('sundell');
expect(called).toBe(true);

// Control timers
vi.useFakeTimers();
try {
  vi.advanceTimersByTime(2000);
} finally {
  vi.useRealTimers();
}
```

**What to Mock:**
- External dependencies: Source classes, file system, network calls
- Module-level imports: Import entire modules with `vi.mock()` to control behavior
- Functions that have side effects: Network fetches, file operations
- Expensive operations: Long-running searches, caching mechanisms

**What NOT to Mock:**
- Pure utility functions: `calculateRelevance()`, `detectTopics()`, string formatting
- Core business logic: Search algorithms, pattern filtering
- Test assertions themselves: Never mock what you're testing
- Standard library functions: Use real implementations (vitest handles globals)

## Fixtures and Factories

**Test Data:**
```typescript
// Mock patterns in handlers.test.ts
const MOCK_PATTERNS = {
  sundell: [
    {
      id: 'sundell-1',
      title: 'Advanced SwiftUI Patterns',
      url: 'https://swiftbysundell.com/swiftui',
      excerpt: 'Learn advanced SwiftUI patterns...',
      content: 'Full content about SwiftUI...',
      topics: ['swiftui', 'architecture'],
      relevanceScore: 85,
      hasCode: true,
      publishDate: '2024-01-15T00:00:00Z',
    },
  ],
};

// Factory functions
function createMockSourceManager() {
  return {
    getAllSources: vi.fn().mockReturnValue([
      { id: 'sundell', name: 'Swift by Sundell', type: 'free', ... },
      { id: 'patreon', name: 'Patreon', type: 'premium', ... },
    ]),
    // ... more methods
  };
}

function uniqueNamespace(): string {
  return `cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

**Location:**
- Test fixtures defined at top of test file or in shared test utility
- Factory functions in same test file, exported for reuse across test suites
- No separate fixtures directory; data is inline for clarity

## Coverage

**Requirements:** Not enforced (no coverage threshold configured)

**View Coverage:**
```bash
# Vitest supports coverage but not configured
# To enable: npm install -D @vitest/coverage-v8
# Then: vitest --coverage
```

**Current approach:**
- Coverage measured informally through test suite size (70+ test files)
- Focus on critical paths: handlers, caching, search logic
- Integration tests validate end-to-end flows

## Test Types

**Unit Tests:**
- **Scope:** Individual functions and classes in isolation
- **Examples:** `src/utils/__tests__/cache.test.ts`, `src/utils/__tests__/search.test.ts`
- **Approach:**
  - Mock external dependencies (file system, network)
  - Test function inputs and outputs
  - Verify edge cases (null, empty, large inputs)
  - Test error handling paths

**Integration Tests:**
- **Scope:** Multiple components working together
- **Examples:** `src/integration/__tests__/mcp-client.test.ts`, `src/tools/handlers/__tests__/handlers.test.ts`
- **Approach:**
  - Mock sources but test handler logic against real source interfaces
  - Verify tool context flows correctly through handlers
  - Test response formatting end-to-end
  - Skip in CI environments when native dependencies are problematic

**E2E Tests:**
- **Framework:** Not structured as separate E2E suite
- **Approach:** `src/integration/__tests__/mcp-client.test.ts` spawns actual MCP server subprocess
- **Conditional execution:** Skipped in CI (`const describeIntegration = isCI ? describe.skip : describe`)
- **Example:**
  ```typescript
  describeIntegration('MCP Server Integration', () => {
    let client: MCPTestClient;
    beforeAll(async () => {
      client = new MCPTestClient();
      await client.start(); // Spawns server process
    }, 10000);
  });
  ```

## Common Patterns

**Async Testing:**
```typescript
// Using async/await in test function
it('should call fetcher on cache miss', async () => {
  let called = false;
  const result = await cache.getOrFetch('fetch-key', async () => {
    called = true;
    return 42;
  });
  expect(called).toBe(true);
  expect(result).toBe(42);
});

// Testing with fake timers
vi.useFakeTimers();
try {
  await cache.set('ttl-key', 'value', 1); // 1 second TTL
  const before = await cache.get('ttl-key');
  expect(before).toBe('value');

  vi.advanceTimersByTime(2000);
  const after = await cache.get('ttl-key');
  expect(after).toBeNull();
} finally {
  vi.useRealTimers();
}
```

**Error Testing:**
```typescript
// Catch and verify error message
it('should return error when topic is missing', async () => {
  const result = await getSwiftPatternHandler({}, context);
  expect(result.content[0].text).toContain('Missing required argument');
  expect(result.content[0].text).toContain('topic');
});

// Mock error responses
vi.mock('../sources', () => ({
  SundellSource: class {
    searchPatterns = vi.fn().mockRejectedValue(new Error('Network error'));
  },
}));

// Verify graceful degradation
it('should return empty on fetch error', async () => {
  const patterns = await source.fetchPatterns();
  expect(patterns).toEqual([]);
});
```

**Test Data Deduplication:**
```typescript
// Reuse mock patterns across multiple describe blocks
const MOCK_PATTERNS = { /* shared data */ };

describe('handler1', () => {
  it('uses MOCK_PATTERNS', () => {
    // MOCK_PATTERNS accessible here
  });
});

describe('handler2', () => {
  it('also uses MOCK_PATTERNS', () => {
    // MOCK_PATTERNS accessible here
  });
});
```

**Concurrency Tests:**
```typescript
// Test deduplication of concurrent identical fetches
it('should deduplicate concurrent identical fetches', async () => {
  let fetchCount = 0;
  const fetcher = async () => {
    fetchCount++;
    await new Promise(r => setTimeout(r, 50));
    return 'deduped';
  };

  const promises = Array.from({ length: 5 }, () =>
    cache.getOrFetch('dedup-key', fetcher)
  );

  const results = await Promise.all(promises);

  expect(fetchCount).toBe(1); // Called once despite 5 concurrent requests
  results.forEach(r => expect(r).toBe('deduped'));
});
```

## Test Execution Strategy

**Test Run Approach:**
- **Single run:** `npm test` compiles and runs all tests
- **Watch mode:** `npm run watch` recompiles on file changes (tests still require manual `npm test`)
- **Pre-test build:** `npm run pretest` ensures `npm run build` runs before tests

**Isolation:**
- Fresh test context per test via `beforeEach()`
- Unique namespaces for file-based tests: `uniqueNamespace()` generates timestamp-based keys
- Module state reset between tests via fresh imports when needed: `await import('../registry.js')`

**Timeout Configuration:**
- Default: 5 seconds per test
- Extended for integration tests: `it('...', async () => {...}, 60000)` or `beforeAll(async () => {...}, 10000)`
- Used for MCP server startup and first-run operations

---

*Testing analysis: 2026-02-09*
