# Testing Patterns

**Analysis Date:** 2026-01-29

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: `vitest.config.ts`
- Fast, ESM-native test runner for TypeScript/Node projects

**Assertion Library:**
- Vitest built-in assertions: `expect()`
- No separate assertion library configured

**Run Commands:**
```bash
npm run test                    # Run all tests once
npm test                        # Alias for above
npm run pretest && npm test     # Build then test
npm run watch                   # Watch mode not configured, use npx vitest --watch
```

**Configuration:** `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
- Co-located with source: `src/utils/__tests__/cache.test.ts` next to `src/utils/cache.ts`
- Pattern: Source at `src/[dir]/filename.ts`, tests at `src/[dir]/__tests__/filename.test.ts`
- Integration tests in `src/integration/__tests__/`
- Handler tests in `src/tools/handlers/__tests__/`

**Naming:**
- Test files use `.test.ts` suffix: `cache.test.ts`, `handlers.test.ts`
- Alternative `.spec.ts` also supported but not used in codebase
- Directory prefix indicates test type: `__tests__` (standard co-located pattern)

**Structure:**
```
src/
├── utils/
│   ├── cache.ts
│   └── __tests__/
│       ├── cache.test.ts
│       ├── search.test.ts
│       └── semantic-recall.test.ts
├── tools/
│   ├── handlers/
│   │   ├── getSwiftPattern.ts
│   │   └── __tests__/
│   │       └── handlers.test.ts
└── integration/
    └── __tests__/
        ├── mcp-client.test.ts
        └── response-quality.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// src/tools/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest';

describe('Tool Registry', () => {
  it('should register and retrieve handlers', async () => {
    const { registerHandler, getHandler } = await import('../registry.js');

    const mockHandler = async () => ({ content: [{ type: 'text', text: 'test' }] });
    registerHandler('test_tool', mockHandler);

    const retrieved = getHandler('test_tool');
    expect(retrieved).toBe(mockHandler);
  });
});
```

**Patterns:**
- Top-level `describe()` for test suite: `describe('Tool Registry', () => { })`
- Nested `describe()` for grouping related tests: `describe('get/set basics', () => { })`
- Individual tests with `it()`: `it('should register and retrieve handlers', async () => { })`
- Clear test names describing expected behavior

**Setup and Teardown:**
- `beforeEach()` for test initialization: `beforeEach(() => { cache = new FileCache(...) })`
- `afterEach()` for cleanup: `afterEach(async () => { await cache.clear() })`
- `beforeAll()` for expensive setup (integration tests): `beforeAll(async () => { client.start() })`
- `afterAll()` for resource cleanup: `afterAll(async () => { client.stop() })`

**Example Full Test Suite:**
```typescript
// src/utils/__tests__/cache.test.ts
describe('FileCache', () => {
  let cache: FileCache;

  beforeEach(() => {
    cache = new FileCache(uniqueNamespace(), 50);
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe('get/set basics', () => {
    it('should return null for non-existent key', async () => {
      const result = await cache.get('missing');
      expect(result).toBeNull();
    });

    it('should store and retrieve a string value', async () => {
      await cache.set('key1', 'hello');
      const result = await cache.get<string>('key1');
      expect(result).toBe('hello');
    });
  });
});
```

## Mocking

**Framework:** Vitest's `vi` module

**Patterns:**
```typescript
// Mock entire modules
vi.mock('../../../sources/free/sundell.js', () => ({
  default: class SundellSourceMock {
    searchPatterns = vi.fn().mockResolvedValue(MOCK_PATTERNS.sundell);
  },
}));

// Mock with spies
const mockHandler = async () => ({ content: [{ type: 'text', text: 'test' }] });
registerHandler('test_tool', mockHandler);

// Fake timers for async/time-based tests
vi.useFakeTimers();
try {
  await cache.set('ttl-key', 'value', 1); // 1 second TTL
  vi.advanceTimersByTime(2000);
  const after = await cache.get('ttl-key');
  expect(after).toBeNull();
} finally {
  vi.useRealTimers();
}
```

**What to Mock:**
- External API calls and HTTP requests
- File system operations (use actual FileCache in tests though)
- Time-dependent behavior (fake timers)
- Source implementations (return known test fixtures)

**What NOT to Mock:**
- Core utility functions being tested
- Cache implementation (test real FileCache behavior)
- Response helpers and formatters
- Error handling utilities

## Fixtures and Factories

**Test Data:**
```typescript
// src/tools/handlers/__tests__/handlers.test.ts
const MOCK_PATTERNS = {
  sundell: [
    {
      id: 'sundell-1',
      title: 'Advanced SwiftUI Patterns',
      url: 'https://swiftbysundell.com/swiftui',
      excerpt: 'Learn advanced SwiftUI patterns for production apps',
      content: 'Full content about SwiftUI state management and views',
      topics: ['swiftui', 'architecture'],
      relevanceScore: 85,
      hasCode: true,
      publishDate: '2024-01-15T00:00:00Z',
    },
    // ... more patterns
  ],
  vanderlee: [ /* ... */ ],
};

// Helper function to generate unique test namespaces
function uniqueNamespace(): string {
  return `cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

**Location:**
- Test fixtures defined at top of test file or in test suite
- Constants for reusable mock data: `MOCK_PATTERNS`, test configuration
- Helper functions for setup: `uniqueNamespace()` for cache isolation
- No separate fixtures directory; fixtures inline to keep tests self-contained

## Coverage

**Requirements:** None enforced

**View Coverage:**
- No coverage reporting configured
- Run tests: `npm test` (no coverage output)
- To add coverage: Would need `@vitest/coverage-v8` or similar package

## Test Types

**Unit Tests:**
- Scope: Individual functions and classes in isolation
- Approach: Mock dependencies, test single responsibility
- Examples: `cache.test.ts` tests FileCache get/set/clear in isolation with mocked filesystem
- Location: `src/[module]/__tests__/[module].test.ts`
- Pattern: Test public interface with known inputs and outputs

**Integration Tests:**
- Scope: Multiple components working together (handlers + sources + caching)
- Approach: Use real implementations, test full workflows
- Examples: `handlers.test.ts` tests handlers with mocked sources, `response-quality.test.ts`
- Location: `src/tools/handlers/__tests__/` or `src/integration/__tests__/`
- Pattern: Test tool handlers with real SourceManager and mocked external sources

**E2E Tests:**
- Framework: None formally, but MCP client integration test in `src/integration/__tests__/mcp-client.test.ts`
- Scope: Full server lifecycle and protocol compliance
- Approach: Start actual MCP server, call tools via protocol, verify responses
- Skip condition: `describe.skip` when `isCI` is true (native dependency: keytar)
- Pattern: Test handshake, tool listing, tool invocation

**Example E2E Test:**
```typescript
// src/integration/__tests__/mcp-client.test.ts
const describeIntegration = isCI ? describe.skip : describe;

describeIntegration('MCP Server Integration', () => {
  let client: MCPTestClient;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.start();
  }, 10000);

  afterAll(async () => {
    await client.stop();
  });

  it('should initialize with correct protocol version', async () => {
    const response = await client.initialize();
    expect(response.result).toBeDefined();
  });
});
```

## Common Patterns

**Async Testing:**
```typescript
// Mark test as async
it('should return cached value without calling fetcher', async () => {
  await cache.set('pre-cached', 'existing');

  let called = false;
  const result = await cache.getOrFetch('pre-cached', async () => {
    called = true;
    return 'new';
  });

  expect(called).toBe(false);
  expect(result).toBe('existing');
});

// Promise.all for concurrent tests
const promises = Array.from({ length: 5 }, () =>
  cache.getOrFetch('dedup-key', fetcher)
);
const results = await Promise.all(promises);
```

**Error Testing:**
```typescript
// Test error handling by catching and asserting
try {
  // operation that might throw
  expect(result).toBe(expected);
} finally {
  vi.useRealTimers();
}

// For best-effort patterns (no throw), test fallback behavior
async function trySemanticRecallInner(options: SemanticRecallOptions): Promise<BasePattern[]> {
  try {
    // logic
  } catch {
    // Semantic recall is best-effort; return empty on any failure
    return [];
  }
}
// Test: expect empty array on error
```

**Parametric Testing:**
```typescript
// Not explicitly used in codebase, but vitest supports it:
// Could do: it.each(testCases)('test $name', ({ input, expected }) => { })

// Instead, codebase uses multiple it() blocks:
it('should fetch separately for different keys', async () => {
  let fetchCount = 0;
  const fetcher = (id: string) => async () => {
    fetchCount++;
    return id;
  };

  const [a, b] = await Promise.all([
    cache.getOrFetch('key-a', fetcher('a')),
    cache.getOrFetch('key-b', fetcher('b')),
  ]);

  expect(fetchCount).toBe(2);
  expect(a).toBe('a');
  expect(b).toBe('b');
});
```

**Mocking Time:**
```typescript
import { vi } from 'vitest';

it('should return null after TTL expires', async () => {
  vi.useFakeTimers();
  try {
    await cache.set('ttl-key', 'value', 1); // 1 second TTL

    const before = await cache.get('ttl-key');
    expect(before).toBe('value');

    // Advance time past expiry
    vi.advanceTimersByTime(2000);

    const after = await cache.get('ttl-key');
    expect(after).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
```

## Manual Testing

### Query Tester (`scripts/test-query.ts`)

Interactive CLI for probing any MCP tool with any query. Starts the MCP server as a subprocess, calls tools via JSON-RPC, and prints results.

```bash
# Search all tools with a query
npx tsx scripts/test-query.ts "Apple Books Hero Effect"

# Target a specific tool
npx tsx scripts/test-query.ts "SwiftUI navigation" --tool get_swift_pattern

# Filter results
npx tsx scripts/test-query.ts "async await" --code --min-quality 70 --source sundell

# Patreon-only (via MCP)
npx tsx scripts/test-query.ts "Hero Effect" --patreon

# Bypass MCP, call PatreonSource directly (faster, shows raw patterns)
npx tsx scripts/test-query.ts "LoopingScrollView" --direct --limit 10

# Raw JSON output for debugging
npx tsx scripts/test-query.ts "testing" --tool search_swift_content --json

# List available tools (verifies Patreon auto-registration)
npx tsx scripts/test-query.ts --tools
```

**Options:**

| Flag | Description |
|------|-------------|
| `--tool <name>` | Call a specific tool (`get_swift_pattern`, `search_swift_content`, `get_patreon_patterns`) |
| `--code` | Only return results with code examples |
| `--min-quality <n>` | Minimum quality score (default: 0) |
| `--source <id>` | Specific free source (`sundell`, `vanderlee`, `nilcoalescing`, `pointfree`) |
| `--patreon` | Query Patreon source only (via MCP tool) |
| `--direct` | Bypass MCP server, call `PatreonSource` directly |
| `--limit <n>` | Max results to display (default: 5) |
| `--json` | Output raw JSON response |
| `--tools` | Just list available tools |

### Patreon E2E (`scripts/test-patreon-e2e.ts`)

End-to-end verification of the Patreon premium source integration.

```bash
npm run test:patreon
# or
npx tsx scripts/test-patreon-e2e.ts
```

**Prerequisites:**
- `YOUTUBE_API_KEY` env var (or in `.env`)
- `PATREON_CLIENT_ID` env var
- `PATREON_CLIENT_SECRET` env var
- Downloaded content in `~/.swift-patterns-mcp/patreon-content/` (for offline tests)

**What it tests:**
1. Configuration — env vars, creators registry
2. Local content scanning — downloaded post indexing, zip extraction
3. YouTube discovery — channel video fetching, Patreon link extraction
4. PatreonSource operations — `searchPatterns()`, `fetchPatterns()`
5. End-to-end — full flow from query to Swift code

### Patreon Integration Tests

```bash
npm test -- src/sources/premium/__tests__/patreon-integration.test.ts
```

Skipped on CI (`SKIP_PATREON_TESTS=1` or `CI=true`). Requires all Patreon env vars. Tests the same areas as the E2E script but within the Vitest framework with assertions.

---

*Testing analysis: 2026-01-30*
