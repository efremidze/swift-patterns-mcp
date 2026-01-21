# Testing Patterns

**Analysis Date:** 2026-01-20

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: Default configuration (no vitest.config.ts needed)

**Assertion Library:**
- Vitest built-in expect
- Matchers: `toBe`, `toEqual`, `toHaveLength`, `toContain`, `toMatch`, `toBeGreaterThanOrEqual`, `toBeLessThanOrEqual`, `toMatchObject`

**Run Commands:**
```bash
npm test                              # Run all tests (vitest run)
npm test -- --watch                   # Watch mode
npm test -- path/to/file.test.ts     # Single file
```

## Test File Organization

**Location:**
- Co-located with source files using `.test.ts` suffix
- No separate `tests/` or `__tests__/` directory
- Integration tests in `src/integration/`

**Naming:**
- `{module-name}.test.ts` for unit tests
- No distinction between unit/integration in filename
- Integration tests named by concern: `response-quality.test.ts`, `mcp-client.test.ts`

**Structure:**
```
src/
  tools/
    handlers.test.ts           # Handler unit tests
    registry.test.ts           # Registry tests
  config/
    sources.test.ts            # SourceManager tests
  sources/
    free/
      rssPatternSource.test.ts # Base class tests
      sundell.test.ts          # Source tests
      vanderlee.test.ts        # Source tests
      pointfree.test.ts        # Source tests
  utils/
    search.test.ts             # Search index tests
    swift-analysis.test.ts     # Analysis tests
  integration/
    mcp-client.test.ts         # MCP client tests
    response-quality.test.ts   # Response validation
    test-client.ts             # Test utilities
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks at top level before describe
vi.mock('rss-parser', () => ({
  default: class Parser {
    async parseURL() { return { items: [...] }; }
  },
}));

vi.mock('../../utils/cache.js', () => ({
  rssCache: { get: vi.fn(), set: vi.fn() }
}));

describe('ModuleName', () => {
  let instance: Type;

  beforeEach(() => {
    instance = new Type(options);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle valid input', async () => {
    // arrange
    const input = createTestInput();

    // act
    const result = await instance.method(input);

    // assert
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Expected Title');
  });

  it('should handle error case', async () => {
    expect(() => instance.method(null)).toThrow();
  });
});
```

**Patterns:**
- `beforeEach` for per-test setup (fresh instances)
- `afterEach` to restore mocks: `vi.restoreAllMocks()`
- Async/await for async operations
- Implicit arrange/act/assert (not always commented)
- One assertion focus per test, but multiple expects OK

## Mocking

**Framework:**
- Vitest built-in mocking (`vi`)
- Module mocking via `vi.mock()` at file top

**Patterns:**
```typescript
// Mock entire module
vi.mock('rss-parser', () => ({
  default: class Parser {
    async parseURL(url: string) {
      return {
        items: [
          { title: 'Test Title', link: 'https://test.com', contentSnippet: 'Content' }
        ]
      };
    }
  },
}));

// Mock specific exports
vi.mock('../../utils/cache.js', () => ({
  rssCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  }
}));

// Mock source modules
vi.mock('../../sources/free/sundell.js', () => ({
  default: class MockSundellSource {
    async fetchPatterns() { return MOCK_PATTERNS.sundell; }
    async searchPatterns(query: string) { return MOCK_PATTERNS.sundell.filter(p => p.title.includes(query)); }
  }
}));

// Stub globals
vi.stubGlobal('fetch', async () => ({
  ok: true,
  text: async () => '<html>...</html>',
}));
```

**What to Mock:**
- External HTTP requests (`rss-parser`, `fetch`)
- Cache layer (`../../utils/cache.js`)
- Source implementations in handler tests
- File system operations (when tested)

**What NOT to Mock:**
- Internal pure functions (swift-analysis utilities)
- Simple transformations
- Types and interfaces

## Fixtures and Factories

**Test Data:**
```typescript
// Inline factory in test file
const MOCK_PATTERNS = {
  sundell: [
    {
      id: 'sundell-1',
      title: 'SwiftUI Navigation',
      url: 'https://swiftbysundell.com/1',
      excerpt: 'Learn about navigation',
      topics: ['swiftui'],
      relevanceScore: 75,
      hasCode: true,
      publishDate: '2025-01-15',
    },
  ],
  vanderlee: [...],
};

// Factory for test options
const testTopicKeywords = {
  'swiftui': ['swiftui', 'view'],
  'testing': ['test'],
};

const testQualitySignals = {
  'tutorial': 5,
  'swiftui': 6,
};
```

**Location:**
- Factory functions inline in test file
- Mock data defined as constants at file top
- No shared fixtures directory
- Mock data co-located with tests

## Coverage

**Requirements:**
- No enforced coverage target
- Coverage tracked for awareness only

**Configuration:**
- Vitest coverage via c8 (built-in, not explicitly configured)
- No `npm run test:coverage` script defined

## Test Types

**Unit Tests:**
- Test single class/module in isolation
- Mock all external dependencies
- Current tests: Sources, handlers, registry, analysis utilities
- Location: `*.test.ts` co-located with source

**Integration Tests:**
- Test multiple modules together
- Mock only external boundaries
- Location: `src/integration/`
- Current tests:
  - `mcp-client.test.ts` - End-to-end MCP tool invocation
  - `response-quality.test.ts` - Response format validation

**E2E Tests:**
- Not currently implemented
- CLI tested manually

**CI Considerations:**
```typescript
// Tests marked with .skip when running in CI
const isCI = process.env.CI === 'true';
describe.skipIf(isCI)('Integration tests', () => {
  // Skipped in CI due to native dependencies (keytar)
});
```

## Common Patterns

**Async Testing:**
```typescript
it('should fetch patterns', async () => {
  const patterns = await source.fetchPatterns();
  expect(patterns).toHaveLength(2);
});
```

**Error Testing:**
```typescript
it('should return error when topic is missing', async () => {
  const result = await handler({}, mockContext);
  expect(result.content[0].text).toContain('error');
});

// Async error
it('should reject on failure', async () => {
  await expect(asyncCall()).rejects.toThrow('error message');
});
```

**Testing Computed Properties:**
```typescript
it('should calculate relevance scores', async () => {
  const patterns = await source.fetchPatterns();
  expect(patterns[0].relevanceScore).toBeGreaterThanOrEqual(0);
  expect(patterns[0].relevanceScore).toBeLessThanOrEqual(100);
});
```

**Testing Array Contents:**
```typescript
it('should detect topics', async () => {
  const patterns = await source.fetchPatterns();
  expect(patterns[0].topics).toContain('testing');
});
```

**Testing Search:**
```typescript
it('should filter by query', async () => {
  const results = await source.searchPatterns('swift');
  expect(results.length).toBeLessThanOrEqual(patterns.length);
  results.forEach(r => {
    expect(r.title.toLowerCase() + r.content.toLowerCase()).toMatch(/swift/i);
  });
});
```

**Testing Response Format:**
```typescript
it('should return helpful message when no patterns found', async () => {
  const result = await handler({ topic: 'nonexistent' }, mockContext);
  expect(result.content[0].text).toContain('No patterns found');
});
```

## Current Test Coverage

**Tested Modules:**
- `src/tools/handlers.test.ts` - Handler tests with mock sources
- `src/tools/registry.test.ts` - Registry functionality
- `src/config/sources.test.ts` - SourceManager tests
- `src/sources/free/rssPatternSource.test.ts` - Base class tests
- `src/sources/free/sundell.test.ts` - Sundell source tests
- `src/sources/free/vanderlee.test.ts` - VanderLee source tests
- `src/sources/free/pointfree.test.ts` - PointFree source tests
- `src/utils/search.test.ts` - Search index tests
- `src/utils/swift-analysis.test.ts` - Analysis function tests
- `src/integration/response-quality.test.ts` - Response validation
- `src/integration/mcp-client.test.ts` - MCP client tests

**Test Isolation:**
- Tests use `vi.mock()` to isolate dependencies
- `beforeEach` hooks for fresh state
- No shared mutable state between tests

---

*Testing analysis: 2026-01-20*
*Update when test patterns change*
