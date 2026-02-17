// src/tools/handlers/handlers.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSwiftPatternHandler } from '../getSwiftPattern.js';
import { searchSwiftContentHandler } from '../searchSwiftContent.js';
import { listContentSourcesHandler } from '../listContentSources.js';
import { enableSourceHandler } from '../enableSource.js';
import type { ToolContext } from '../../types.js';
import { FREE_SOURCE_PATTERNS } from '../../../__tests__/fixtures/patterns.js';
import { createHandlerContext } from './harness.js';

// Mock sources to return our test fixtures
vi.mock('../../../sources/free/sundell.js', () => ({
  default: class SundellSourceMock {
    searchPatterns = vi.fn().mockResolvedValue(FREE_SOURCE_PATTERNS.sundell);
  },
}));

vi.mock('../../../sources/free/vanderlee.js', () => ({
  default: class VanderLeeSourceMock {
    searchPatterns = vi.fn().mockResolvedValue(FREE_SOURCE_PATTERNS.vanderlee);
  },
}));

vi.mock('../../../sources/free/nilcoalescing.js', () => ({
  default: class NilCoalescingSourceMock {
    searchPatterns = vi.fn().mockResolvedValue(FREE_SOURCE_PATTERNS.nilcoalescing);
  },
}));

vi.mock('../../../sources/free/pointfree.js', () => ({
  default: class PointFreeSourceMock {
    searchPatterns = vi.fn().mockResolvedValue(FREE_SOURCE_PATTERNS.pointfree);
  },
}));

// Mock SourceManager to ensure semantic recall is disabled in tests
vi.mock('../../../config/sources.js', () => ({
  default: class SourceManagerMock {
    getSemanticRecallConfig = vi.fn().mockReturnValue({
      enabled: false,
      minLexicalScore: 0.35,
      minRelevanceScore: 70,
    });
    getMemvidConfig = vi.fn().mockReturnValue({
      enabled: false,
      autoStore: false,
      useEmbeddings: false,
      embeddingModel: 'bge-small',
    });
  },
}));

describe('getSwiftPatternHandler', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = createHandlerContext();
  });

  it('should return error when topic is missing', async () => {
    const result = await getSwiftPatternHandler({}, context);

    expect(result.content[0].text).toContain('Missing required argument');
    expect(result.content[0].text).toContain('topic');
  });

  it('should return patterns matching the topic', async () => {
    const result = await getSwiftPatternHandler({ topic: 'swiftui' }, context);
    const text = result.content[0].text;

    // Should include pattern sections with markdown headers
    const sectionCount = (text.match(/^## /gm) || []).length;
    expect(sectionCount).toBeGreaterThanOrEqual(1);
    // Response should reference the topic
    expect(text.toLowerCase()).toContain('swiftui');
  });

  it('should filter out patterns below minQuality threshold', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'swift',
      minQuality: 70,
    }, context);
    const text = result.content[0].text;

    // All displayed quality scores should be >= threshold
    const qualityMatches = text.matchAll(/Quality.*?(\d+)\/100/gi);
    const scores = Array.from(qualityMatches, m => parseInt(m[1], 10));
    expect(scores.length).toBeGreaterThanOrEqual(1);
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(70);
    }

    // Patterns below threshold should not appear
    const belowThreshold = Object.values(FREE_SOURCE_PATTERNS).flat()
      .filter(p => p.relevanceScore < 70);
    for (const p of belowThreshold) {
      expect(text).not.toContain(p.title);
    }
  });

  it('should use default minQuality of 65 when not specified', async () => {
    const result = await getSwiftPatternHandler({ topic: 'swift' }, context);
    const text = result.content[0].text;

    // Patterns below default minQuality (65) should be excluded
    const belowDefault = Object.values(FREE_SOURCE_PATTERNS).flat()
      .filter(p => p.relevanceScore < 65);
    for (const p of belowDefault) {
      expect(text).not.toContain(p.title);
    }

    // Should report found count and show truncation message
    expect(text).toMatch(/Found \d+ results?/);
    expect(text).toMatch(/Showing top \d+ of \d+ results/);
  });

  it('should filter by specific source when provided', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'swift',
      source: 'sundell',
    }, context);
    const text = result.content[0].text;

    // Should contain sundell source attribution
    expect(text.toLowerCase()).toContain('sundell');

    // Should NOT contain patterns from other sources (check their unique URLs)
    for (const [source, patterns] of Object.entries(FREE_SOURCE_PATTERNS)) {
      if (source === 'sundell') continue;
      for (const p of patterns) {
        expect(text).not.toContain(p.url);
      }
    }
  });

  it('should return helpful error when source is a Patreon creator', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'animations',
      source: 'kavsoft',
    }, context);
    const text = result.content[0].text;

    expect(text).toContain('Kavsoft');
    expect(text).toContain('Patreon creator');
    expect(text).toContain('get_patreon_patterns');
    expect(text).toContain('animations');
  });

  it('should match Patreon creator names case-insensitively', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'layouts',
      source: 'Kavsoft',
    }, context);
    const text = result.content[0].text;

    expect(text).toContain('Patreon creator');
    expect(text).toContain('get_patreon_patterns');
  });

  it('should return error listing all sources for completely unknown source', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'swift',
      source: 'nonexistent',
    }, context);
    const text = result.content[0].text;

    expect(text).toContain("isn't a recognized source");
    expect(text).toContain('sundell');
    expect(text).toContain('kavsoft');
    expect(text).toContain('get_swift_pattern');
    expect(text).toContain('get_patreon_patterns');
  });

  it('should avoid generic matches for long specific queries and suggest broader search', async () => {
    const result = await getSwiftPatternHandler({
      topic: 'dynamic island animation',
      minQuality: 70,
    }, context);
    const text = result.content[0].text;

    expect(text).toContain('No patterns found');
    expect(text).toContain('search_swift_content({ query: "dynamic island animation" })');
    expect(text).not.toContain('Composable Architecture Case Study');
  });

  it('should return results with quality scores above minQuality', async () => {
    const minQuality = 50;
    const result = await getSwiftPatternHandler({
      topic: 'swift',
      minQuality,
    }, context);
    const text = result.content[0].text;

    const qualityMatches = text.matchAll(/Quality.*?(\d+)\/100/gi);
    const scores = Array.from(qualityMatches, m => parseInt(m[1], 10));
    expect(scores.length).toBeGreaterThanOrEqual(2);

    // All scores should meet the minQuality threshold
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(minQuality);
    }
    // Note: display order is by composite rank score (relevance + query overlap
    // + code/exact-match boosts), not raw quality score
  });

  // Format validation tests (quality scores, source attribution, URLs, sorting,
  // empty results) removed — covered by src/integration/__tests__/response-quality.test.ts
});

describe('searchSwiftContentHandler', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = createHandlerContext();
  });

  it('should return error when query is missing', async () => {
    const result = await searchSwiftContentHandler({}, context);

    expect(result.content[0].text).toContain('Missing required argument');
    expect(result.content[0].text).toContain('query');
  });

  it('should return results from all sources', async () => {
    const result = await searchSwiftContentHandler({ query: 'swift' }, context);
    const text = result.content[0].text;

    // Should include results from multiple sources (check URLs from different domains)
    const sectionCount = (text.match(/^## /gm) || []).length;
    expect(sectionCount).toBeGreaterThanOrEqual(2);
    expect(text).toMatch(/Found \d+ results?/);
  });

  it('should filter by requireCode when true', async () => {
    const result = await searchSwiftContentHandler({
      query: 'swift',
      requireCode: true,
    }, context);
    const text = result.content[0].text;

    // Patterns without code should be excluded
    const noCodePatterns = Object.values(FREE_SOURCE_PATTERNS).flat()
      .filter(p => !p.hasCode);
    for (const p of noCodePatterns) {
      expect(text).not.toContain(p.title);
    }

    // Should still have results
    const sectionCount = (text.match(/^## /gm) || []).length;
    expect(sectionCount).toBeGreaterThanOrEqual(1);
  });

  it('should include all patterns when requireCode is false', async () => {
    const result = await searchSwiftContentHandler({
      query: 'swift',
      requireCode: false,
    }, context);
    const text = result.content[0].text;

    // Total fixture count across all sources
    const totalFixtures = Object.values(FREE_SOURCE_PATTERNS).flat().length;
    expect(text).toContain(`Found ${totalFixtures} results`);
    expect(text).toMatch(/Showing top \d+ of \d+ results/);
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
    context = createHandlerContext();
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

    expect(text).toContain('swift-patterns-mcp patreon setup');
  });
});

describe('enableSourceHandler', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = createHandlerContext();
  });

  it('should return error for unknown source', async () => {
    const result = await enableSourceHandler({ source: 'unknown_source' }, context);
    const text = result.content[0].text;

    expect(text).toContain('Unknown source');
    expect(text).toContain('unknown_source');
    expect(result.isError).toBe(true);
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
    expect(text).toContain('swift-patterns-mcp patreon setup');
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
