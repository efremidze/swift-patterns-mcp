// src/sources/free/sundell.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import SundellSource from '../sundell.js';

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

vi.mock('../../../utils/cache.js', () => ({
  rssCache: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  },
}));

describe('SundellSource', () => {
  let source: SundellSource;
  beforeEach(() => {
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
