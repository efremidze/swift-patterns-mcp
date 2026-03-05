import { describe, it, expect, vi } from 'vitest';
import { createSearchSwiftContentHandler, type SearchSwiftContentDependencies } from '../searchSwiftContent.js';
import type { ToolContext, PatreonSourceInstance, PatreonPattern } from '../../types.js';
import type { BasePattern } from '../../../sources/free/rssPatternSource.js';

function pattern(id: string, relevanceScore: number, hasCode = true, url?: string): BasePattern {
  return {
    id,
    title: id,
    url: url ?? `https://example.com/${id}`,
    publishDate: '2026-01-01T00:00:00Z',
    excerpt: `${id} excerpt`,
    content: `${id} content`,
    topics: ['swiftui'],
    relevanceScore,
    hasCode,
  };
}

function patreonPattern(id: string, relevanceScore: number, hasCode = true, url?: string): PatreonPattern {
  return {
    ...pattern(id, relevanceScore, hasCode, url),
    creator: 'Kavsoft',
  };
}

function buildContext(options: {
  patreonEnabled?: boolean;
  semanticEnabled?: boolean;
  semanticMinLexicalScore?: number;
  semanticMinRelevanceScore?: number;
  memvidEnabled?: boolean;
  useEmbeddings?: boolean;
  patreonSource?: ToolContext['patreonSource'];
} = {}): ToolContext {
  const {
    patreonEnabled = false,
    semanticEnabled = false,
    semanticMinLexicalScore = 0.35,
    semanticMinRelevanceScore = 70,
    memvidEnabled = false,
    useEmbeddings = false,
    patreonSource = null,
  } = options;

  return {
    sourceManager: {
      getEnabledSources: () => {
        const base = [{ id: 'sundell' }, { id: 'vanderlee' }, { id: 'nilcoalescing' }, { id: 'pointfree' }];
        return patreonEnabled ? [...base, { id: 'patreon' }] : base;
      },
      getSemanticRecallConfig: () => ({
        enabled: semanticEnabled,
        minLexicalScore: semanticMinLexicalScore,
        minRelevanceScore: semanticMinRelevanceScore,
      }),
      getMemvidConfig: () => ({
        enabled: memvidEnabled,
        autoStore: false,
        useEmbeddings,
        embeddingModel: 'bge-small',
      }),
    } as unknown as ToolContext['sourceManager'],
    patreonSource,
  };
}

function buildDeps(overrides: Partial<SearchSwiftContentDependencies> = {}): SearchSwiftContentDependencies {
  const asTextResponse = (text: string) => ({ content: [{ type: 'text', text }] });

  return {
    searchMultipleSources: vi.fn(async () => []),
    getSourceNames: vi.fn(() => ['sundell', 'vanderlee', 'nilcoalescing', 'pointfree']),
    fetchAllPatterns: vi.fn(async () => []),
    cachedSearch: vi.fn(async ({ fetcher }) => ({ results: await fetcher(), wasCacheHit: false })),
    createSemanticIndex: vi.fn(() => ({
      index: vi.fn(async () => {}),
      search: vi.fn(async () => []),
    })),
    getMemvidMemory: vi.fn(() => ({
      search: vi.fn(async () => []),
    })),
    formatSearchPatterns: vi.fn((results: BasePattern[], query: string) => `${query}|${results.map(r => r.id).join(',')}`) as unknown as SearchSwiftContentDependencies['formatSearchPatterns'],
    detectCodeIntent: vi.fn(() => false),
    createMarkdownResponse: vi.fn((title: string, ...sections: Array<string | undefined>) => {
      const body = sections.filter((section): section is string => Boolean(section && section.trim())).join('\n\n');
      return asTextResponse(`# ${title}${body ? `\n\n${body}` : ''}`);
    }) as unknown as SearchSwiftContentDependencies['createMarkdownResponse'],
    createTextResponse: vi.fn((text: string) => asTextResponse(text)) as unknown as SearchSwiftContentDependencies['createTextResponse'],
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
    },
    semanticTimeoutMs: 5_000,
    patreonUnifiedTimeoutMs: 5_000,
    ...overrides,
  };
}

describe('searchSwiftContentHandler (isolated unit)', () => {
  it('short-circuits on cache hit without running fetch pipeline', async () => {
    const deps = buildDeps({
      cachedSearch: vi.fn(async () => ({
        results: [pattern('cached-1', 95)],
        wasCacheHit: true,
      })),
    });
    const handler = createSearchSwiftContentHandler(deps);

    const result = await handler({ query: 'swiftui' }, buildContext());
    const text = result.content[0].text;

    expect(text).toContain('swiftui|cached-1');
    expect(deps.searchMultipleSources).not.toHaveBeenCalled();
  });

  it('merges Patreon results, dedupes by url/id, and sorts by relevance', async () => {
    const free = [
      pattern('free-1', 70),
      pattern('shared', 60, true, 'https://example.com/shared'),
    ];
    const patreon = [
      patreonPattern('patreon-1', 90),
      patreonPattern('patreon-shared', 99, true, 'https://example.com/shared'),
    ];

    class PatreonSourceMock implements PatreonSourceInstance {
      async isConfigured() { return true; }
      isAvailable() { return true; }
      async fetchPatterns() { return []; }
      async searchPatterns() { return patreon; }
    }

    const deps = buildDeps({
      searchMultipleSources: vi.fn(async () => free),
    });
    const handler = createSearchSwiftContentHandler(deps);

    const result = await handler(
      { query: 'scrollview' },
      buildContext({ patreonEnabled: true, patreonSource: PatreonSourceMock as unknown as ToolContext['patreonSource'] })
    );

    expect(result.content[0].text).toContain('scrollview|patreon-1,free-1,shared');
  });

  it('applies requireCode filtering across free, Patreon, semantic, and memvid results', async () => {
    const semanticIndex = {
      index: vi.fn(async () => {}),
      search: vi.fn(async () => [pattern('sem-code', 80, true), pattern('sem-nocode', 80, false)]),
    };
    const memvid = {
      search: vi.fn(async () => [pattern('mem-code', 85, true), pattern('mem-nocode', 85, false)]),
    };
    const free = [pattern('free-code', 70, true), pattern('free-nocode', 72, false)];
    const patreon = [patreonPattern('pat-code', 90, true), patreonPattern('pat-nocode', 92, false)];

    class PatreonSourceMock implements PatreonSourceInstance {
      async isConfigured() { return true; }
      isAvailable() { return true; }
      async fetchPatterns() { return []; }
      async searchPatterns() { return patreon; }
    }

    const deps = buildDeps({
      searchMultipleSources: vi.fn(async () => free),
      createSemanticIndex: vi.fn(() => semanticIndex),
      fetchAllPatterns: vi.fn(async () => [pattern('seed', 50)]),
      getMemvidMemory: vi.fn(() => memvid),
    });
    const handler = createSearchSwiftContentHandler(deps);

    const result = await handler(
      { query: 'swift', requireCode: true },
      buildContext({
        patreonEnabled: true,
        patreonSource: PatreonSourceMock as unknown as ToolContext['patreonSource'],
        semanticEnabled: true,
        semanticMinLexicalScore: 0.95,
        semanticMinRelevanceScore: 70,
        memvidEnabled: true,
      })
    );

    expect(result.content[0].text).toContain('swift|pat-code,mem-code,sem-code,free-code');
    expect(result.content[0].text).not.toContain('nocode');
  });

  it('times out Patreon unified search and still returns free results', async () => {
    class PatreonSourceSlow implements PatreonSourceInstance {
      async isConfigured() { return true; }
      isAvailable() { return true; }
      async fetchPatterns() { return []; }
      async searchPatterns() { return new Promise<PatreonPattern[]>(() => {}); }
    }

    const deps = buildDeps({
      searchMultipleSources: vi.fn(async () => [pattern('free-1', 70)]),
      patreonUnifiedTimeoutMs: 1,
    });
    const handler = createSearchSwiftContentHandler(deps);

    const result = await handler(
      { query: 'calendar' },
      buildContext({ patreonEnabled: true, patreonSource: PatreonSourceSlow as unknown as ToolContext['patreonSource'] })
    );

    expect(result.content[0].text).toContain('calendar|free-1');
  });

  it('handles memvid errors without failing the request', async () => {
    const deps = buildDeps({
      searchMultipleSources: vi.fn(async () => [pattern('free-1', 70)]),
      getMemvidMemory: vi.fn(() => ({
        search: vi.fn(async () => {
          throw new Error('memvid down');
        }),
      })),
    });
    const handler = createSearchSwiftContentHandler(deps);

    const result = await handler(
      { query: 'swiftui' },
      buildContext({ memvidEnabled: true })
    );

    expect(result.content[0].text).toContain('swiftui|free-1');
    expect(deps.logger.warn).toHaveBeenCalled();
  });

  it('returns markdown no-results response when all pipelines return empty', async () => {
    const deps = buildDeps({
      searchMultipleSources: vi.fn(async () => []),
    });
    const handler = createSearchSwiftContentHandler(deps);

    const result = await handler({ query: 'nonexistent' }, buildContext());
    const text = result.content[0].text;

    expect(text).toContain('# Search Results: "nonexistent"');
    expect(text).toContain('No results found');
  });
});
