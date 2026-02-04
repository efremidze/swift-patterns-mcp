// src/sources/free/vanderlee.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import VanderLeeSource from '../vanderlee.js';

const mockFetchTextConditional = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/http.js', () => ({
  buildHeaders: (ua: string) => ({ 'User-Agent': ua }),
  fetchTextConditional: (...args: unknown[]) => mockFetchTextConditional(...args),
}));

vi.mock('../../../utils/cache.js', () => ({
  rssCache: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
    getExpiredEntry: vi.fn(async () => null),
    refreshTtl: vi.fn(async () => undefined),
  },
  articleCache: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
    getExpiredEntry: vi.fn(async () => null),
    refreshTtl: vi.fn(async () => undefined),
  },
}));

const rssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <guid>1</guid>
      <title>Debugging with Xcode</title>
      <link>https://example.com/1</link>
      <pubDate>2026-01-01</pubDate>
      <description><![CDATA[<p>Debugging <code>let x = 1</code></p>]]></description>
    </item>
    <item>
      <guid>2</guid>
      <title>SwiftUI Performance</title>
      <link>https://example.com/2</link>
      <pubDate>2026-01-02</pubDate>
      <description><![CDATA[<p>SwiftUI <pre>struct ContentView: View {}</pre></p>]]></description>
    </item>
  </channel>
</rss>`;

describe('VanderLeeSource', () => {
  let source: VanderLeeSource;
  beforeEach(() => {
    mockFetchTextConditional.mockReset();
    mockFetchTextConditional.mockImplementation((url: string) => {
      // RSS feed fetch
      if (url.includes('avanderlee.com/feed') || url.includes('test.com/feed')) {
        return Promise.resolve({
          data: rssXml,
          httpMeta: {},
          notModified: false,
        });
      }
      // Article fetches
      return Promise.resolve({
        data: '<div class="post-content">Full article <code>let y = 2</code></div><div></div>',
        httpMeta: {},
        notModified: false,
      });
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
});
