# Testing Patterns

**Analysis Date:** 2026-01-16

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: Default configuration (no vitest.config.ts)

**Assertion Library:**
- Vitest built-in expect
- Matchers: `toBe`, `toEqual`, `toHaveLength`, `toContain`, `toMatch`, `toBeGreaterThanOrEqual`

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

**Naming:**
- `{module-name}.test.ts` for all tests
- No distinction between unit/integration in filename

**Structure:**
```
src/
  sources/
    free/
      rssPatternSource.ts
      rssPatternSource.test.ts    # Co-located
      sundell.ts
      sundell.test.ts             # Co-located
      vanderlee.ts
      vanderlee.test.ts           # Co-located
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Stub globals
vi.stubGlobal('fetch', async () => ({
  ok: true,
  text: async () => '<html>...</html>',
}));
```

**What to Mock:**
- External HTTP requests (`rss-parser`, `fetch`)
- Cache layer (`../../utils/cache.js`)
- File system operations (not currently tested)

**What NOT to Mock:**
- Internal pure functions (swift-analysis utilities)
- Simple transformations

## Fixtures and Factories

**Test Data:**
```typescript
// Inline factory in test file
const testTopicKeywords = {
  'swiftui': ['swiftui', 'view'],
  'testing': ['test'],
};

const testQualitySignals = {
  'tutorial': 5,
  'swiftui': 6,
};

// Mock RSS items inline
const mockItems = [
  {
    title: 'How to test Swift code',
    link: 'https://example.com/test',
    contentSnippet: 'A guide to testing in Swift',
    pubDate: '2025-01-15',
  },
];
```

**Location:**
- Factory functions inline in test file
- No shared fixtures directory
- Mock data co-located with tests

## Coverage

**Requirements:**
- No enforced coverage target
- Coverage tracked for awareness only

**Configuration:**
- Vitest coverage via c8 (built-in, not configured)
- No `npm run test:coverage` script defined

## Test Types

**Unit Tests:**
- Test single class/module in isolation
- Mock all external dependencies
- Current tests: RSS source classes only

**Integration Tests:**
- Not currently implemented

**E2E Tests:**
- Not currently implemented

## Common Patterns

**Async Testing:**
```typescript
it('should fetch patterns', async () => {
  const patterns = await source.fetchPatterns();
  expect(patterns).toHaveLength(2);
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

## Current Test Coverage

**Tested Modules:**
- `src/sources/free/rssPatternSource.ts` - 3 tests
- `src/sources/free/sundell.ts` - 3 tests
- `src/sources/free/vanderlee.ts` - 3 tests

**Untested Modules:**
- `src/index.ts` (MCP server)
- `src/cli/*` (CLI commands)
- `src/config/*` (Configuration)
- `src/sources/premium/*` (Patreon, YouTube)
- `src/utils/*` (Cache, search, analysis, paths)
- `src/tools/*` (Cookie extraction)

**Total:** 9 tests across 3 files

---

*Testing analysis: 2026-01-16*
*Update when test patterns change*
