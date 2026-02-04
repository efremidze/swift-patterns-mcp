// src/sources/free/sundell.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import SundellSource from '../sundell.js';

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
}));

const rssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <guid>1</guid>
      <title>How to test Swift code</title>
      <link>https://example.com/1</link>
      <pubDate>2026-01-01</pubDate>
      <description><![CDATA[<p>Some content <code>let x = 1</code></p>]]></description>
    </item>
    <item>
      <guid>2</guid>
      <title>SwiftUI Patterns</title>
      <link>https://example.com/2</link>
      <pubDate>2026-01-02</pubDate>
      <description><![CDATA[<p>SwiftUI <pre>struct ContentView: View {}</pre></p>]]></description>
    </item>
  </channel>
</rss>`;

describe('SundellSource', () => {
  let source: SundellSource;

  beforeEach(() => {
    mockFetchTextConditional.mockReset();
    mockFetchTextConditional.mockResolvedValue({
      data: rssXml,
      httpMeta: {},
      notModified: false,
    });
    source = new SundellSource();
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
    expect(patterns[0].relevanceScore).toBeGreaterThanOrEqual(65);
    expect(patterns[1].relevanceScore).toBeGreaterThanOrEqual(66);
  });

  it('searchPatterns returns relevant results', async () => {
    const results = await source.searchPatterns('swiftui');
    expect(results[0].title).toMatch(/swiftui/i);
    expect(results[0].topics).toContain('swiftui');
  });
});
