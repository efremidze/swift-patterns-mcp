# Testing Patterns

**Analysis Date:** 2026-02-07

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in expect() API

**Run Commands:**
```bash
npm test                 # Run all tests with vitest run
npm run build && npm test  # Ensure build before tests
```

**Setup:**
- `vitest.setup.ts` loads environment variables via `dotenv/config` before tests run
- This ensures `process.env` is populated for all tests

## Test File Organization

**Location:**
- Co-located in `__tests__` subdirectories alongside source code
- Pattern: `src/[module]/__tests__/[name].test.ts`

**Naming:**
- Test files use `.test.ts` suffix: `cache.test.ts`, `registry.test.ts`
- Match the module they test: `cache.ts` → `cache.test.ts`

**Structure:**
```
src/
├── utils/
│   ├── cache.ts
│   └── __tests__/
│       └── cache.test.ts
├── tools/
│   ├── handlers/
│   │   ├── getSwiftPattern.ts
│   │   └── __tests__/
│   │       └── handlers.test.ts
│   └── __tests__/
│       └── registry.test.ts
└── sources/
    └── free/
        ├── sundell.ts
        └── __tests__/
            └── sundell.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('FeatureName', () => {
  // Optional setup
  beforeEach(() => {
    // Reset state
  });

  afterEach(async () => {
    // Cleanup
  });

  describe('specific behavior', () => {
    it('should do something specific', () => {
      expect(result).toBe(expected);
    });
  });
});
```

**Patterns:**
- Top-level `describe()` wraps entire test suite
- Nested `describe()` for organizing related tests by behavior
- Flat structure within describe blocks with simple comments when no grouping needed
- Comments use ASCII dividers for visual organization:
  ```typescript
  // ─── get / set basics ───
  describe('get/set basics', () => { /* tests */ });

  // ─── memory vs file cache ───
  describe('memory vs file cache', () => { /* tests */ });
  ```

**Setup/Teardown:**
- `beforeEach()`: Initialize fresh test state (e.g., new FileCache instance)
- `afterEach()`: Async cleanup operations (e.g., `await cache.clear()`)
- Module-level constants for test data (e.g., `MOCK_PATTERNS`, `testDocs`)

## Mocking

**Framework:** Vitest `vi` module

**Patterns:**

1. **Module mocking with `vi.mock()`:**
```typescript
vi.mock('rss-parser', () => {
  return {
    default: class Parser {
      async parseURL(_url: string) {
        return {
          items: [
            { guid: '1', title: 'Test', link: 'https://example.com/1' }
          ]
        };
      }
    }
  };
});
```

2. **Function mocking with `vi.fn()`:**
```typescript
vi.mock('../cache.js', () => ({
  rssCache: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  },
}));
```

3. **Spy and track calls:**
```typescript
let called = false;
const fetcher = async () => {
  called = true;
  return 42;
};

const result = await cache.getOrFetch('fetch-key', fetcher);
expect(called).toBe(true);
```

**What to Mock:**
- External dependencies (RSS parsers, HTTP clients, file I/O)
- Cross-module dependencies when testing in isolation
- Network requests and APIs

**What NOT to Mock:**
- Core cache functionality (test real cache behavior)
- In-memory data structures when testing the implementation
- Module-level exported functions (import fresh when testing state isolation)

## Fixtures and Factories

**Test Data:**
```typescript
const testDocs: SearchableDocument[] = [
  {
    id: 'doc1',
    title: 'Building async SwiftUI apps',
    content: 'Learn how to use async/await with SwiftUI views',
    topics: ['swiftui', 'concurrency'],
  },
  // ... more test documents
];

const MOCK_PATTERNS = {
  sundell: [
    {
      id: 'sundell-1',
      title: 'Advanced SwiftUI Patterns',
      url: 'https://swiftbysundell.com/swiftui',
      excerpt: 'Learn advanced SwiftUI patterns',
      content: 'Full content...',
      topics: ['swiftui', 'architecture'],
      relevanceScore: 85,
      hasCode: true,
      publishDate: '2024-01-15T00:00:00Z',
    },
  ],
};
```

**Location:**
- Test data defined at module level (top of test file) as constants
- Reused across multiple test cases within that file
- Named with UPPER_CASE or camelCase descriptively: `MOCK_PATTERNS`, `testDocs`, `uniqueNamespace()`

**Helpers:**
```typescript
function uniqueNamespace(): string {
  return `cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

## Coverage

**Requirements:** Not enforced

**View Coverage:**
- Coverage reports not configured (vitest omits coverage config)
- Run with `vitest` for standard execution

## Test Types

**Unit Tests:**
- Scope: Individual functions and classes
- Approach: Mock external dependencies, test behavior in isolation
- Examples: `cache.test.ts`, `search.test.ts`, `registry.test.ts`
- Location: `src/[module]/__tests__/[name].test.ts`

**Integration Tests:**
- Scope: Multiple modules working together (e.g., source registry with handlers)
- Approach: Test MCP protocol handshake, tool invocation, real data flow
- Framework: Uses `MCPTestClient` from `src/integration/test-client.ts`
- Conditional skipping on CI: `const describeIntegration = isCI ? describe.skip : describe`
- Examples: `src/integration/__tests__/mcp-client.test.ts`, `src/integration/__tests__/response-quality.test.ts`
- Longer timeouts: `it('...', async () => {...}, 60000)` for slow operations

**E2E Tests:**
- Framework: Not used
- Alternative: Patreon integration test at `src/sources/premium/__tests__/patreon-integration.test.ts`
- Manual E2E script: `npm run test:patreon` (runs `scripts/test-patreon-e2e.ts`)

## Async Testing

**Pattern:**
```typescript
it('should return null after TTL expires', async () => {
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
});
```

**Time control:**
- `vi.useFakeTimers()`: Switch to fake timers for controlled time advancement
- `vi.advanceTimersByTime(ms)`: Move time forward by specified milliseconds
- `vi.useRealTimers()`: Restore real timers in finally block
- Essential for testing TTL expiration and time-dependent behavior

**Promise handling:**
- Tests use `await` for async operations
- `Promise.all()` for parallel test setup
- `Promise.allSettled()` used in source code, tests verify both fulfilled and rejected results

## Error Testing

**Pattern:**
```typescript
it('should handle cache write failures gracefully', async () => {
  // Arrange
  const mockWriteFile = vi.spyOn(fsp, 'writeFile').mockRejectedValueOnce(
    new Error('ENOSPC: disk full')
  );

  // Act
  await cache.set('error-key', 'data');

  // Assert
  expect(mockWriteFile).toHaveBeenCalled();
  // Cache operation continues despite write failure
  const result = await cache.get('error-key');
  expect(result).toBe('data'); // Still in memory
});
```

**Error scenarios tested:**
- Cache read failures (file corruption, missing file)
- Write failures (permission denied, disk full)
- Async operation failures in Promise.allSettled
- Unknown tools and invalid parameters in handler tests

**Assertion patterns:**
- `expect(error).toContain('message')`: Check error message text
- `expect(called).toBe(true/false)`: Verify error was caught
- `expect(result).toBeNull()`: Verify fallback behavior
- `expect(results).toHaveLength(n)`: Verify result count after filtering/cleanup

## Integration Test Examples

**MCP Protocol Tests:**
```typescript
describe('Protocol Handshake', () => {
  it('should initialize with correct protocol version', async () => {
    const response = await client.initialize();

    expect(response.error).toBeUndefined();
    const result = response.result as { protocolVersion: string };
    expect(result.protocolVersion).toBe('2024-11-05');
  });

  it('should list available tools', async () => {
    const response = await client.listTools();

    const result = response.result as { tools: Array<{ name: string }> };
    expect(result.tools.length).toBeGreaterThanOrEqual(4);
    expect(result.tools.map(t => t.name)).toContain('get_swift_pattern');
  });
});
```

**Tool Invocation Tests:**
```typescript
it('should call get_swift_pattern with topic', async () => {
  const response = await client.callTool('get_swift_pattern', {
    topic: 'swiftui',
    minQuality: 70,
  });

  expect(response.error).toBeUndefined();
  const result = response.result as { content: Array<{ type: string; text: string }> };
  expect(result.content[0].text.length).toBeGreaterThan(0);
}, 60000); // 60 second timeout for real network operations
```

**CI/CD Considerations:**
- Integration tests skipped on CI due to native dependency issues (keytar)
- `isCI` detection via environment: `const isCI = process.env.CI === 'true'`
- Example: `const describeIntegration = isCI ? describe.skip : describe`

## Common Test Assertion Patterns

**Type assertions in tests:**
```typescript
const result = response.result as { content: Array<{ type: string; text: string }> };
expect(result.content).toBeDefined();
expect(result.content[0].type).toBe('text');
```

**Array and collection assertions:**
```typescript
expect(patterns).toHaveLength(2);
expect(results.some(r => r.item.id === 'doc1')).toBe(true);
expect(toolNames).toContain('get_swift_pattern');
```

**Score and numeric assertions:**
```typescript
expect(patterns[0].relevanceScore).toBeGreaterThanOrEqual(65);
expect(fetchCount).toBe(1);
expect(allResults.length).toBeGreaterThanOrEqual(filteredResults.length);
```

---

*Testing analysis: 2026-02-07*
