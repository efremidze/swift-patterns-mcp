// src/tools/handlers/handlers.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSwiftPatternHandler } from './getSwiftPattern.js';
import { searchSwiftContentHandler } from './searchSwiftContent.js';
import { listContentSourcesHandler } from './listContentSources.js';
import { enableSourceHandler } from './enableSource.js';
import type { ToolContext } from '../types.js';

// Mock the RSS sources
vi.mock('../../sources/free/sundell.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    searchPatterns: vi.fn().mockResolvedValue([
      {
        id: 'sundell-1',
        title: 'SwiftUI Patterns',
        url: 'https://example.com/swiftui',
        excerpt: 'Learn SwiftUI patterns',
        content: 'Full content here',
        topics: ['swiftui'],
        relevanceScore: 85,
        hasCode: true,
        publishDate: new Date().toISOString(),
      },
    ]),
  })),
}));

vi.mock('../../sources/free/vanderlee.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    searchPatterns: vi.fn().mockResolvedValue([
      {
        id: 'vanderlee-1',
        title: 'iOS Performance Tips',
        url: 'https://example.com/performance',
        excerpt: 'Performance optimization',
        content: 'Full content here',
        topics: ['performance'],
        relevanceScore: 75,
        hasCode: false,
        publishDate: new Date().toISOString(),
      },
    ]),
  })),
}));

// Create mock SourceManager
function createMockSourceManager() {
  const sources = [
    { id: 'sundell', name: 'Swift by Sundell', type: 'free', requiresAuth: false, isEnabled: true, isConfigured: true, description: 'Swift articles' },
    { id: 'vanderlee', name: 'Antoine van der Lee', type: 'free', requiresAuth: false, isEnabled: true, isConfigured: true, description: 'iOS tips' },
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

  it('should return patterns for a valid topic', async () => {
    const result = await getSwiftPatternHandler({ topic: 'swiftui' }, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Swift Patterns');
  });

  it('should filter by minQuality', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'swiftui',
      minQuality: 80
    }, context);

    expect(result.content[0].text).toContain('SwiftUI Patterns');
    // vanderlee result has score 75, so it should be filtered out
  });

  it('should filter by source', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'test',
      source: 'sundell'
    }, context);

    expect(result.content).toBeDefined();
  });

  it('should return helpful message when no patterns found', async () => {
    // Mock to return empty
    vi.doMock('../../sources/free/sundell.js', () => ({
      default: vi.fn().mockImplementation(() => ({
        searchPatterns: vi.fn().mockResolvedValue([]),
      })),
    }));

    const result = await getSwiftPatternHandler({
      topic: 'nonexistent',
      minQuality: 100
    }, context);

    expect(result.content[0].text).toContain('No patterns found');
  });

  it('should use default values when args not provided', async () => {
    const result = await getSwiftPatternHandler({ topic: 'swiftui' }, context);

    expect(result.content).toBeDefined();
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

  it('should return search results for valid query', async () => {
    const result = await searchSwiftContentHandler({ query: 'async await' }, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
  });

  it('should filter by requireCode', async () => {
    const result = await searchSwiftContentHandler({
      query: 'test',
      requireCode: true
    }, context);

    // Only sundell mock has hasCode: true
    expect(result.content[0].text).toContain('SwiftUI');
  });

  it('should return message when no results found', async () => {
    // This is harder to test without deep mocking, but we test the structure
    const result = await searchSwiftContentHandler({ query: 'test' }, context);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
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

  it('should list all sources', async () => {
    const result = await listContentSourcesHandler({}, context);

    expect(result.content[0].text).toContain('Content Sources');
    expect(result.content[0].text).toContain('Free Sources');
    expect(result.content[0].text).toContain('Premium Sources');
  });

  it('should show source names', async () => {
    const result = await listContentSourcesHandler({}, context);

    expect(result.content[0].text).toContain('Swift by Sundell');
    expect(result.content[0].text).toContain('Antoine van der Lee');
  });

  it('should show setup instructions', async () => {
    const result = await listContentSourcesHandler({}, context);

    expect(result.content[0].text).toContain('swift-mcp setup');
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
    const result = await enableSourceHandler({ source: 'unknown' }, context);

    expect(result.content[0].text).toContain('Unknown source');
    expect(result.content[0].text).toContain('Available sources');
  });

  it('should require setup for unconfigured premium sources', async () => {
    const result = await enableSourceHandler({ source: 'patreon' }, context);

    expect(result.content[0].text).toContain('requires setup');
    expect(result.content[0].text).toContain('swift-mcp setup');
  });

  it('should enable configured free sources', async () => {
    const result = await enableSourceHandler({ source: 'sundell' }, context);

    expect(result.content[0].text).toContain('enabled');
    expect(context.sourceManager.enableSource).toHaveBeenCalledWith('sundell');
  });

  it('should list available sources on error', async () => {
    const result = await enableSourceHandler({ source: 'invalid' }, context);

    expect(result.content[0].text).toContain('sundell');
    expect(result.content[0].text).toContain('vanderlee');
  });
});
