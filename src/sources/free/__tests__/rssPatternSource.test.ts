// src/sources/free/rssPatternSource.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RssPatternSource, BasePattern } from '../rssPatternSource.js';

const parseURLMock = vi.hoisted(() => vi.fn());
const fetchTextMock = vi.hoisted(() => vi.fn());

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
        return parseURLMock(_url);
      }
    },
  };
});

vi.mock('../../../utils/http.js', () => ({
  buildHeaders: vi.fn((_ua: string, _token?: string) => ({ 'User-Agent': 'test' })),
  fetchText: (...args: unknown[]) => fetchTextMock(...args),
}));

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

class ArticleTestSource extends RssPatternSource<TestPattern> {
  constructor() {
    super({
      feedUrl: 'https://test.com/feed',
      cacheKey: 'test-patterns-article',
      topicKeywords: testTopicKeywords,
      qualitySignals: testQualitySignals,
      fetchFullArticle: true,
      extractContentFn: (html) => html,
    });
  }
}

describe('RssPatternSource', () => {
  let source: TestSource;

  const feedItems = [
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
  ];

  beforeEach(() => {
    parseURLMock.mockReset();
    fetchTextMock.mockReset();
    parseURLMock.mockResolvedValue({ items: feedItems });
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

  it('returns [] when parser throws', async () => {
    parseURLMock.mockRejectedValueOnce(new Error('feed unavailable'));

    await expect(source.fetchPatterns()).resolves.toEqual([]);
  });

  it('handles malformed entries with missing fields', async () => {
    parseURLMock.mockResolvedValueOnce({
      items: [
        {
          guid: undefined,
          title: undefined,
          link: undefined,
          pubDate: undefined,
          contentSnippet: undefined,
          content: undefined,
        },
      ],
    });

    const patterns = await source.fetchPatterns();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].title).toBe('');
    expect(patterns[0].url).toBe('');
    expect(patterns[0].content).toBe('');
  });

  it('returns [] for empty feeds', async () => {
    parseURLMock.mockResolvedValueOnce({ items: [] });

    await expect(source.fetchPatterns()).resolves.toEqual([]);
  });

  it('falls back to RSS snippets when full article fetch fails', async () => {
    const articleSource = new ArticleTestSource();
    parseURLMock.mockResolvedValueOnce({
      items: [
        {
          guid: '3',
          title: 'Fallback Case',
          link: 'https://example.com/fallback',
          pubDate: '2026-01-03',
          contentSnippet: 'rss fallback snippet',
          content: 'rss fallback body',
        },
      ],
    });
    fetchTextMock.mockRejectedValueOnce(new Error('article request failed'));

    const patterns = await articleSource.fetchPatterns();

    expect(patterns).toHaveLength(1);
    expect(patterns[0].content).toBe('rss fallback body');
    expect(patterns[0].excerpt).toBe('rss fallback snippet');
  });
});
