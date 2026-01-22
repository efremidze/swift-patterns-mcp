// src/tools/handlers/handlers.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSwiftPatternHandler } from './getSwiftPattern.js';
import { searchSwiftContentHandler } from './searchSwiftContent.js';
import { listContentSourcesHandler } from './listContentSources.js';
import { enableSourceHandler } from './enableSource.js';
import type { ToolContext } from '../types.js';

// Test fixtures - known patterns with specific properties for testing
const MOCK_PATTERNS = {
  sundell: [
    {
      id: 'sundell-1',
      title: 'Advanced SwiftUI Patterns',
      url: 'https://swiftbysundell.com/swiftui',
      excerpt: 'Learn advanced SwiftUI patterns for production apps',
      content: 'Full content about SwiftUI state management and views',
      topics: ['swiftui', 'architecture'],
      relevanceScore: 85,
      hasCode: true,
      publishDate: '2024-01-15T00:00:00Z',
    },
    {
      id: 'sundell-2',
      title: 'Basic Swift Tips',
      url: 'https://swiftbysundell.com/tips',
      excerpt: 'Simple tips for Swift developers',
      content: 'Basic content without code examples',
      topics: ['swift'],
      relevanceScore: 55, // Below default minQuality of 60
      hasCode: false,
      publishDate: '2024-01-10T00:00:00Z',
    },
  ],
  vanderlee: [
    {
      id: 'vanderlee-1',
      title: 'iOS Performance Optimization',
      url: 'https://avanderlee.com/performance',
      excerpt: 'Optimize your iOS app performance',
      content: 'Detailed performance optimization techniques',
      topics: ['performance', 'optimization'],
      relevanceScore: 78,
      hasCode: true,
      publishDate: '2024-01-12T00:00:00Z',
    },
    {
      id: 'vanderlee-2',
      title: 'Debugging Tips',
      url: 'https://avanderlee.com/debugging',
      excerpt: 'Debug your iOS apps effectively',
      content: 'Debugging techniques without code',
      topics: ['debugging'],
      relevanceScore: 65,
      hasCode: false,
      publishDate: '2024-01-08T00:00:00Z',
    },
  ],
  nilcoalescing: [
    {
      id: 'nilcoalescing-1',
      title: 'SwiftUI Navigation Deep Dive',
      url: 'https://nilcoalescing.com/navigation',
      excerpt: 'Master SwiftUI navigation patterns',
      content: 'Navigation code examples and patterns',
      topics: ['swiftui', 'navigation'],
      relevanceScore: 72,
      hasCode: true,
      publishDate: '2024-01-14T00:00:00Z',
    },
  ],
  pointfree: [
    {
      id: 'pointfree-1',
      title: 'Composable Architecture Case Study',
      url: 'https://github.com/pointfreeco/pointfreeco/blob/main/Sources/Models/Episodes/0001-functions.md',
      excerpt: 'Build apps with TCA',
      content: 'TCA reducer and store patterns',
      topics: ['architecture', 'tca'],
      relevanceScore: 90,
      hasCode: true,
      publishDate: '2024-01-16T00:00:00Z',
    },
  ],
};

// Mock sources to return our test fixtures
vi.mock('../../sources/free/sundell.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    searchPatterns: vi.fn().mockResolvedValue(MOCK_PATTERNS.sundell),
  })),
}));

vi.mock('../../sources/free/vanderlee.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    searchPatterns: vi.fn().mockResolvedValue(MOCK_PATTERNS.vanderlee),
  })),
}));

vi.mock('../../sources/free/nilcoalescing.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    searchPatterns: vi.fn().mockResolvedValue(MOCK_PATTERNS.nilcoalescing),
  })),
}));

vi.mock('../../sources/free/pointfree.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    searchPatterns: vi.fn().mockResolvedValue(MOCK_PATTERNS.pointfree),
  })),
}));

// Mock SourceManager to ensure semantic recall is disabled in tests
vi.mock('../../config/sources.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    getSemanticRecallConfig: vi.fn().mockReturnValue({
      enabled: false,
      minLexicalScore: 0.35,
      minRelevanceScore: 70,
    }),
    isSemanticRecallEnabled: vi.fn().mockReturnValue(false),
  })),
}));

// Create mock SourceManager
function createMockSourceManager() {
  const sources = [
    { id: 'sundell', name: 'Swift by Sundell', type: 'free', requiresAuth: false, isEnabled: true, isConfigured: true, description: 'Swift articles' },
    { id: 'vanderlee', name: 'Antoine van der Lee', type: 'free', requiresAuth: false, isEnabled: true, isConfigured: true, description: 'iOS tips' },
    { id: 'nilcoalescing', name: 'Nil Coalescing', type: 'free', requiresAuth: false, isEnabled: true, isConfigured: true, description: 'SwiftUI tips' },
    { id: 'pointfree', name: 'Point-Free', type: 'free', requiresAuth: false, isEnabled: true, isConfigured: true, description: 'Open source patterns' },
    { id: 'patreon', name: 'Patreon', type: 'premium', requiresAuth: true, isEnabled: false, isConfigured: false, description: 'Premium content' },
  ];

  return {
    getAllSources: vi.fn().mockReturnValue(sources),
    getSource: vi.fn((id: string) => sources.find(s => s.id === id)),
    isSourceConfigured: vi.fn((id: string) => {
      const source = sources.find(s => s.id === id);
      return source?.isConfigured ?? false;
    }),
    enableSource: vi.fn(),
    disableSource: vi.fn(),
    getEnabledSources: vi.fn().mockReturnValue(sources.filter(s => s.isEnabled)),
  };
}

describe('getSwiftPatternHandler', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = {
      sourceManager: createMockSourceManager() as any,
      patreonSource: null,
    };
  });

  it('should return error when topic is missing', async () => {
    const result = await getSwiftPatternHandler({}, context);

    expect(result.content[0].text).toContain('Missing required argument');
    expect(result.content[0].text).toContain('topic');
  });

  it('should return patterns matching the topic', async () => {
    const result = await getSwiftPatternHandler({ topic: 'swiftui' }, context);
    const text = result.content[0].text;

    // Should include SwiftUI-related patterns
    expect(text).toContain('Advanced SwiftUI Patterns');
    expect(text).toContain('SwiftUI Navigation Deep Dive');
  });

  it('should filter out patterns below minQuality threshold', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'swift',
      minQuality: 70,
    }, context);
    const text = result.content[0].text;

    // sundell-1 (85), vanderlee-1 (78), nilcoalescing-1 (72), pointfree-1 (90) should be included
    expect(text).toContain('Advanced SwiftUI Patterns'); // score 85
    expect(text).toContain('iOS Performance Optimization'); // score 78

    // sundell-2 (55) and vanderlee-2 (65) should be EXCLUDED
    expect(text).not.toContain('Basic Swift Tips'); // score 55
    expect(text).not.toContain('Debugging Tips'); // score 65
  });

  it('should use default minQuality of 60 when not specified', async () => {
    const result = await getSwiftPatternHandler({ topic: 'swift' }, context);
    const text = result.content[0].text;

    // sundell-2 has score 55, below default minQuality of 60
    expect(text).not.toContain('Basic Swift Tips');

    // vanderlee-2 has score 65, above default minQuality of 60
    expect(text).toContain('Debugging Tips');
  });

  it('should filter by specific source when provided', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'swift',
      source: 'sundell',
    }, context);
    const text = result.content[0].text;

    // Should only contain sundell patterns
    expect(text).toContain('Advanced SwiftUI Patterns');

    // Should NOT contain patterns from other sources
    expect(text).not.toContain('iOS Performance Optimization'); // vanderlee
    expect(text).not.toContain('SwiftUI Navigation Deep Dive'); // nilcoalescing
    expect(text).not.toContain('Composable Architecture'); // pointfree
  });

  it('should sort results by relevance score (highest first)', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'swift',
      minQuality: 0, // Include all
    }, context);
    const text = result.content[0].text;

    // pointfree-1 (90) should appear before sundell-1 (85)
    const pointfreeIndex = text.indexOf('Composable Architecture');
    const sundellIndex = text.indexOf('Advanced SwiftUI Patterns');

    expect(pointfreeIndex).toBeLessThan(sundellIndex);
  });

  it('should include quality scores in output', async () => {
    const result = await getSwiftPatternHandler({ topic: 'swiftui' }, context);
    const text = result.content[0].text;

    // Should show quality scores
    expect(text).toMatch(/Quality.*\d+\/100/i);
  });

  it('should include source attribution in output', async () => {
    const result = await getSwiftPatternHandler({ topic: 'swiftui' }, context);
    const text = result.content[0].text;

    expect(text).toMatch(/Source.*:/i);
  });

  it('should include clickable URLs in output', async () => {
    const result = await getSwiftPatternHandler({ topic: 'swiftui' }, context);
    const text = result.content[0].text;

    // Should have markdown links
    expect(text).toMatch(/\[.+\]\(https?:\/\/.+\)/);
  });

  it('should return helpful message when no patterns found', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'nonexistent_topic',
      minQuality: 100, // Filter out everything
    }, context);
    const text = result.content[0].text;

    expect(text).toContain('No patterns found');
    expect(text).toMatch(/[Tt]ry/); // Should suggest trying something else
  });
});

describe('searchSwiftContentHandler', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = {
      sourceManager: createMockSourceManager() as any,
      patreonSource: null,
    };
  });

  it('should return error when query is missing', async () => {
    const result = await searchSwiftContentHandler({}, context);

    expect(result.content[0].text).toContain('Missing required argument');
    expect(result.content[0].text).toContain('query');
  });

  it('should return results from all sources', async () => {
    const result = await searchSwiftContentHandler({ query: 'swift' }, context);
    const text = result.content[0].text;

    // Should include results from multiple sources
    expect(text).toContain('Advanced SwiftUI Patterns'); // sundell
    expect(text).toContain('iOS Performance Optimization'); // vanderlee
  });

  it('should filter by requireCode when true', async () => {
    const result = await searchSwiftContentHandler({
      query: 'swift',
      requireCode: true,
    }, context);
    const text = result.content[0].text;

    // Should include patterns with code
    expect(text).toContain('Advanced SwiftUI Patterns'); // hasCode: true
    expect(text).toContain('iOS Performance Optimization'); // hasCode: true

    // Should EXCLUDE patterns without code
    expect(text).not.toContain('Basic Swift Tips'); // hasCode: false
    expect(text).not.toContain('Debugging Tips'); // hasCode: false
  });

  it('should include all patterns when requireCode is false', async () => {
    const result = await searchSwiftContentHandler({
      query: 'swift',
      requireCode: false,
    }, context);
    const text = result.content[0].text;

    // Should include patterns both with and without code
    expect(text).toContain('Advanced SwiftUI Patterns'); // hasCode: true
    expect(text).toContain('Basic Swift Tips'); // hasCode: false
  });

  it('should have search results header', async () => {
    const result = await searchSwiftContentHandler({ query: 'swift' }, context);
    const text = result.content[0].text;

    expect(text).toMatch(/# Search Results/);
  });
});

describe('listContentSourcesHandler', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = {
      sourceManager: createMockSourceManager() as any,
      patreonSource: null,
    };
  });

  it('should list all sources with categories', async () => {
    const result = await listContentSourcesHandler({}, context);
    const text = result.content[0].text;

    expect(text).toContain('Content Sources');
    expect(text).toContain('Free Sources');
    expect(text).toContain('Premium Sources');
  });

  it('should list all source names', async () => {
    const result = await listContentSourcesHandler({}, context);
    const text = result.content[0].text;

    expect(text).toContain('Swift by Sundell');
    expect(text).toContain('Antoine van der Lee');
    expect(text).toContain('Nil Coalescing');
    expect(text).toContain('Point-Free');
    expect(text).toContain('Patreon');
  });

  it('should show status indicators', async () => {
    const result = await listContentSourcesHandler({}, context);
    const text = result.content[0].text;

    // Should have status indicators (enabled/disabled/needs setup)
    expect(text).toMatch(/✅|⚙️|⬜/);
  });

  it('should show setup instructions for premium sources', async () => {
    const result = await listContentSourcesHandler({}, context);
    const text = result.content[0].text;

    expect(text).toContain('swift-patterns-mcp setup');
  });
});

describe('enableSourceHandler', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = {
      sourceManager: createMockSourceManager() as any,
      patreonSource: null,
    };
  });

  it('should return error for unknown source', async () => {
    const result = await enableSourceHandler({ source: 'unknown_source' }, context);
    const text = result.content[0].text;

    expect(text).toContain('Unknown source');
    expect(text).toContain('unknown_source');
  });

  it('should list available sources when source is unknown', async () => {
    const result = await enableSourceHandler({ source: 'invalid' }, context);
    const text = result.content[0].text;

    expect(text).toContain('Available sources');
    expect(text).toContain('sundell');
    expect(text).toContain('vanderlee');
    expect(text).toContain('nilcoalescing');
    expect(text).toContain('pointfree');
  });

  it('should require setup for unconfigured premium sources', async () => {
    const result = await enableSourceHandler({ source: 'patreon' }, context);
    const text = result.content[0].text;

    expect(text).toContain('requires setup');
    expect(text).toContain('swift-patterns-mcp setup');
    expect(text).toContain('--patreon');
  });

  it('should enable configured free sources', async () => {
    const result = await enableSourceHandler({ source: 'sundell' }, context);
    const text = result.content[0].text;

    expect(text).toContain('enabled');
    expect(text).toContain('Swift by Sundell');
    expect(context.sourceManager.enableSource).toHaveBeenCalledWith('sundell');
  });

  it('should not call enableSource for unknown sources', async () => {
    await enableSourceHandler({ source: 'unknown' }, context);

    expect(context.sourceManager.enableSource).not.toHaveBeenCalled();
  });
});
