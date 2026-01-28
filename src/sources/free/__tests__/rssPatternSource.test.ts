// src/sources/free/rssPatternSource.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RssPatternSource, BasePattern } from '../rssPatternSource.js';

// Mock dependencies
vi.mock('../../../utils/cache.js', () => ({
  rssCache: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  },
  articleCache: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  },
}));

vi.mock('rss-parser', () => {
  return {
    default: class Parser {
      async parseURL(_url: string) {
        return {
          items: [
            {
              guid: '1',
              title: 'How to test Swift code',
              link: 'https://example.com/1',
              pubDate: '2026-01-01',
              contentSnippet: 'A guide to testing in Swift',
              content: '<p>Some content <code>let x = 1</code></p>',
            },
            {
              guid: '2',
              title: 'SwiftUI Patterns',
              link: 'https://example.com/2',
              pubDate: '2026-01-02',
              contentSnippet: 'SwiftUI best practices',
              content: '<p>SwiftUI <pre>struct ContentView: View {}</pre></p>',
            },
          ],
        };
      }
    },
  };
});

// Minimal options for testing
const testTopicKeywords = {
  'testing': ['test'],
  'swiftui': ['swiftui'],
};
const testQualitySignals = {
  'how to': 5,
  'swiftui': 6,
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TestPattern extends BasePattern {}

class TestSource extends RssPatternSource<TestPattern> {
  constructor() {
    super({
      feedUrl: 'https://test.com/feed',
      cacheKey: 'test-patterns',
      topicKeywords: testTopicKeywords,
      qualitySignals: testQualitySignals,
    });
  }
}

describe('RssPatternSource', () => {
  let source: TestSource;
  beforeEach(() => {
    source = new TestSource();
  });

  it('fetches and parses patterns', async () => {
    const patterns = await source.fetchPatterns();
    expect(patterns).toHaveLength(2);
    expect(patterns[0].title).toBe('How to test Swift code');
    expect(patterns[0].topics).toContain('testing');
    expect(patterns[1].topics).toContain('swiftui');
    expect(patterns[0].hasCode).toBe(true);
    expect(patterns[1].hasCode).toBe(true);
  });

  it('calculates relevance score', async () => {
    const patterns = await source.fetchPatterns();
    // First pattern: 'how to' + 'test' + code
    expect(patterns[0].relevanceScore).toBeGreaterThanOrEqual(65);
    // Second pattern: 'swiftui' + code
    expect(patterns[1].relevanceScore).toBeGreaterThanOrEqual(66);
  });

  it('searchPatterns returns relevant results', async () => {
    const results = await source.searchPatterns('swiftui');
    expect(results[0].title).toMatch(/swiftui/i);
    expect(results[0].topics).toContain('swiftui');
  });
});
