// src/sources/free/nilcoalescing.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import NilCoalescingSource from '../nilcoalescing.js';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/fetch.js', () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

vi.mock('../../../utils/cache.js', () => ({
  rssCache: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  },
}));

const rssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <guid>1</guid>
      <title>SwiftUI Navigation Patterns</title>
      <link>https://example.com/1</link>
      <pubDate>2026-01-01</pubDate>
      <description><![CDATA[<p>Some content <code>NavigationStack</code></p>]]></description>
    </item>
    <item>
      <guid>2</guid>
      <title>Snapshot Testing in Swift</title>
      <link>https://example.com/2</link>
      <pubDate>2026-01-02</pubDate>
      <description><![CDATA[<p>Testing <pre>assertSnapshot()</pre></p>]]></description>
    </item>
  </channel>
</rss>`;

describe('NilCoalescingSource', () => {
  let source: NilCoalescingSource;

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => rssXml,
    });
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
});
