// src/sources/free/nilcoalescing.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import NilCoalescingSource from '../nilcoalescing.js';

const parseURLMock = vi.hoisted(() => vi.fn());

vi.mock('rss-parser', () => {
  return {
    default: class Parser {
      async parseURL(_url: string) {
        return parseURLMock(_url);
      }
    },
  };
});

vi.mock('../../../utils/cache.js', () => ({
  rssCache: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  },
}));

describe('NilCoalescingSource', () => {
  let source: NilCoalescingSource;

  const feedItems = [
    {
      guid: '1',
      title: 'SwiftUI Navigation Patterns',
      link: 'https://example.com/1',
      pubDate: '2026-01-01',
      contentSnippet: 'Navigation and layout tips for SwiftUI',
      content: '<p>Some content <code>NavigationStack</code></p>',
    },
    {
      guid: '2',
      title: 'Snapshot Testing in Swift',
      link: 'https://example.com/2',
      pubDate: '2026-01-02',
      contentSnippet: 'Snapshot testing for UIKit and SwiftUI',
      content: '<p>Testing <pre>assertSnapshot()</pre></p>',
    },
  ];

  beforeEach(() => {
    parseURLMock.mockReset();
    parseURLMock.mockResolvedValue({ items: feedItems });
    source = new NilCoalescingSource();
  });

  it('fetches and parses patterns', async () => {
    const patterns = await source.fetchPatterns();
    expect(patterns).toHaveLength(2);
    expect(patterns[0].title).toBe('SwiftUI Navigation Patterns');
    expect(patterns[0].topics).toContain('swiftui');
    expect(patterns[1].topics).toContain('testing');
    expect(patterns[0].hasCode).toBe(true);
    expect(patterns[1].hasCode).toBe(true);
  });

  it('calculates relevance score', async () => {
    const patterns = await source.fetchPatterns();
    expect(patterns[0].relevanceScore).toBeGreaterThanOrEqual(66);
    expect(patterns[1].relevanceScore).toBeGreaterThanOrEqual(66);
  });

  it('searchPatterns returns relevant results', async () => {
    const results = await source.searchPatterns('snapshot');
    expect(results[0].title).toMatch(/snapshot/i);
    expect(results[0].topics).toContain('testing');
  });

  it('returns [] when parser throws', async () => {
    parseURLMock.mockRejectedValueOnce(new Error('feed timeout'));

    await expect(source.fetchPatterns()).resolves.toEqual([]);
  });

  it('returns [] when feed has no items', async () => {
    parseURLMock.mockResolvedValueOnce({ items: [] });

    await expect(source.fetchPatterns()).resolves.toEqual([]);
  });

  it('gracefully handles malformed feed entries', async () => {
    parseURLMock.mockResolvedValueOnce({
      items: [
        {
          guid: 'bad',
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
});
