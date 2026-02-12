// src/sources/free/vanderlee.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import VanderLeeSource from '../vanderlee.js';

const mockFetch = vi.hoisted(() => vi.fn());
const parseURLMock = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/fetch.js', () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
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

describe('VanderLeeSource', () => {
  let source: VanderLeeSource;

  const feedItems = [
    {
      guid: '1',
      title: 'Debugging with Xcode',
      link: 'https://example.com/1',
      pubDate: '2026-01-01',
      contentSnippet: 'Debugging tips',
      content: '<p>Debugging <code>let x = 1</code></p>',
    },
    {
      guid: '2',
      title: 'SwiftUI Performance',
      link: 'https://example.com/2',
      pubDate: '2026-01-02',
      contentSnippet: 'SwiftUI performance best practices',
      content: '<p>SwiftUI <pre>struct ContentView: View {}</pre></p>',
    },
  ];

  beforeEach(() => {
    mockFetch.mockReset();
    parseURLMock.mockReset();
    parseURLMock.mockResolvedValue({ items: feedItems });
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '<div class="post-content">Full article <code>let y = 2</code></div><div></div>',
    });
    source = new VanderLeeSource();
  });

  it('fetches and parses patterns with full article', async () => {
    const patterns = await source.fetchPatterns();
    expect(patterns).toHaveLength(2);
    expect(patterns[0].title).toBe('Debugging with Xcode');
    expect(patterns[0].topics).toContain('debugging');
    expect(patterns[1].topics).toContain('swiftui');
    expect(patterns[0].hasCode).toBe(true);
    expect(patterns[1].hasCode).toBe(true);
    expect(patterns[0].content).toMatch(/Full article/);
  });

  it('calculates relevance score', async () => {
    const patterns = await source.fetchPatterns();
    expect(patterns[0].relevanceScore).toBeGreaterThanOrEqual(67);
    expect(patterns[1].relevanceScore).toBeGreaterThanOrEqual(74);
  });

  it('searchPatterns returns relevant results', async () => {
    const results = await source.searchPatterns('swiftui');
    expect(results[0].title).toMatch(/swiftui/i);
    expect(results[0].topics).toContain('swiftui');
  });

  it('returns [] when parser fails', async () => {
    parseURLMock.mockRejectedValueOnce(new Error('rss parse failed'));

    await expect(source.fetchPatterns()).resolves.toEqual([]);
  });

  it('falls back to RSS content when article request is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'server error',
    });

    const patterns = await source.fetchPatterns();

    expect(patterns).toHaveLength(2);
    expect(patterns[0].content).toContain('Debugging');
    expect(patterns[0].content).not.toContain('server error');
  });

  it('handles malformed feed entries without throwing', async () => {
    parseURLMock.mockResolvedValueOnce({
      items: [
        {
          guid: 'broken',
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
    expect(patterns[0].content).toBe('');
    expect(patterns[0].topics).toEqual([]);
  });

  it('returns [] for empty feed results', async () => {
    parseURLMock.mockResolvedValueOnce({ items: [] });

    await expect(source.fetchPatterns()).resolves.toEqual([]);
  });
});
