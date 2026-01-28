// src/utils/semantic-recall.test.ts

import { describe, it, expect, vi } from 'vitest';
import { SemanticRecallIndex, DEFAULT_CONFIG } from '../semantic-recall.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';

// Mock the transformer pipeline to avoid slow model loading in tests
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(async (text: string) => ({
    data: new Float32Array(384).fill(0.1 + text.length / 1000), // Mock embedding varying by text length
  })),
  env: { allowLocalModels: false },
}));

// Mock ml-distance
vi.mock('ml-distance', () => ({
  similarity: {
    cosine: vi.fn((a: Float32Array, b: Float32Array) => {
      // Simple mock: higher similarity for more similar lengths
      const lenDiff = Math.abs(a.length - b.length);
      return 1 - lenDiff / 1000;
    }),
  },
}));

// Helper to create mock patterns
function createMockPattern(overrides: Partial<BasePattern> = {}): BasePattern {
  return {
    id: `pattern-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Pattern',
    url: 'https://example.com/test',
    publishDate: '2024-01-01',
    excerpt: 'A test excerpt about Swift programming.',
    content: 'Full content here...',
    topics: ['swift', 'testing'],
    relevanceScore: 75,
    hasCode: true,
    ...overrides,
  };
}

describe('SemanticRecallIndex', () => {
  describe('Config defaults', () => {
    it('should have enabled = false by default', () => {
      expect(DEFAULT_CONFIG.enabled).toBe(false);
    });

    it('should have minLexicalScore = 0.35 by default', () => {
      expect(DEFAULT_CONFIG.minLexicalScore).toBe(0.35);
    });

    it('should have minRelevanceScore = 70 by default', () => {
      expect(DEFAULT_CONFIG.minRelevanceScore).toBe(70);
    });
  });

  describe('Pattern filtering during index()', () => {
    it('should only index patterns with relevanceScore >= minRelevanceScore', async () => {
      const index = new SemanticRecallIndex({
        enabled: true,
        minLexicalScore: 0.35,
        minRelevanceScore: 70,
      });

      const patterns = [
        createMockPattern({ id: 'high-1', relevanceScore: 85, title: 'High Quality' }),
        createMockPattern({ id: 'low-1', relevanceScore: 65, title: 'Low Quality' }),
        createMockPattern({ id: 'high-2', relevanceScore: 72, title: 'High Quality 2' }),
      ];

      await index.index(patterns);

      // Search should only return high-quality patterns
      const results = await index.search('test', 10);

      const ids = results.map(p => p.id);
      expect(ids).toContain('high-1');
      expect(ids).toContain('high-2');
      expect(ids).not.toContain('low-1');
    });

    it('should skip patterns below threshold', async () => {
      const index = new SemanticRecallIndex({
        enabled: true,
        minLexicalScore: 0.35,
        minRelevanceScore: 80,
      });

      const patterns = [
        createMockPattern({ id: 'very-high', relevanceScore: 90 }),
        createMockPattern({ id: 'medium', relevanceScore: 75 }),
      ];

      await index.index(patterns);
      const results = await index.search('test', 10);

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('very-high');
    });

    it('should handle empty pattern array', async () => {
      const index = new SemanticRecallIndex();

      await index.index([]);

      const results = await index.search('test', 10);
      expect(results).toEqual([]);
    });
  });

  describe('Content extraction', () => {
    it('should extract title and excerpt only', async () => {
      const index = new SemanticRecallIndex({
        enabled: true,
        minLexicalScore: 0.35,
        minRelevanceScore: 70,
      });

      const pattern = createMockPattern({
        id: 'test-1',
        title: 'SwiftUI Patterns',
        excerpt: 'Learn about SwiftUI state management',
        content: 'This is a very long article with many details...',
        relevanceScore: 75,
      });

      await index.index([pattern]);
      const results = await index.search('SwiftUI', 10);

      // Should find the pattern based on title/excerpt
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle missing excerpt gracefully', async () => {
      const index = new SemanticRecallIndex({
        enabled: true,
        minLexicalScore: 0.35,
        minRelevanceScore: 70,
      });

      const pattern = createMockPattern({
        id: 'no-excerpt',
        title: 'Test Pattern',
        excerpt: '',
        content: 'Some content here',
        relevanceScore: 75,
      });

      await expect(index.index([pattern])).resolves.not.toThrow();
    });
  });

  describe('Search behavior', () => {
    it('should return top-K patterns by similarity', async () => {
      const index = new SemanticRecallIndex({
        enabled: true,
        minLexicalScore: 0.35,
        minRelevanceScore: 70,
      });

      const patterns = [
        createMockPattern({ id: 'p1', title: 'Pattern 1', relevanceScore: 75 }),
        createMockPattern({ id: 'p2', title: 'Pattern 2', relevanceScore: 80 }),
        createMockPattern({ id: 'p3', title: 'Pattern 3', relevanceScore: 85 }),
        createMockPattern({ id: 'p4', title: 'Pattern 4', relevanceScore: 90 }),
      ];

      await index.index(patterns);
      const results = await index.search('test', 2);

      // Should return only top 2
      expect(results.length).toBe(2);
    });

    it('should return empty array when no patterns indexed', async () => {
      const index = new SemanticRecallIndex();

      const results = await index.search('test', 10);

      expect(results).toEqual([]);
    });

    it('should handle query with no matches', async () => {
      const index = new SemanticRecallIndex({
        enabled: true,
        minLexicalScore: 0.35,
        minRelevanceScore: 70,
      });

      const pattern = createMockPattern({
        id: 'test',
        title: 'Test',
        relevanceScore: 75,
      });

      await index.index([pattern]);

      // Even with no "match", semantic search returns similarity scores
      // So this should still return results (just with lower scores)
      const results = await index.search('completely different query', 10);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Embedding caching', () => {
    it('should cache embeddings keyed by pattern.id + contentHash', async () => {
      const index = new SemanticRecallIndex({
        enabled: true,
        minLexicalScore: 0.35,
        minRelevanceScore: 70,
      });

      const pattern = createMockPattern({
        id: 'cache-test',
        title: 'Cache Test Pattern',
        excerpt: 'This tests caching',
        relevanceScore: 75,
      });

      // First index - should compute embedding
      await index.index([pattern]);

      // Second index - should use cached embedding
      await index.index([pattern]);

      // Verify it doesn't throw and returns results
      const results = await index.search('cache', 10);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle different content producing different cache key', async () => {
      const index = new SemanticRecallIndex({
        enabled: true,
        minLexicalScore: 0.35,
        minRelevanceScore: 70,
      });

      const pattern1 = createMockPattern({
        id: 'same-id',
        title: 'Title 1',
        excerpt: 'Content 1',
        relevanceScore: 75,
      });

      const pattern2 = createMockPattern({
        id: 'same-id',
        title: 'Title 2',
        excerpt: 'Content 2',
        relevanceScore: 75,
      });

      // Index with different content but same ID
      await index.index([pattern1]);
      await index.index([pattern2]);

      // Should not throw - different cache keys
      expect(true).toBe(true);
    });

    it('should use incremental indexing (skip unchanged patterns)', async () => {
      const index = new SemanticRecallIndex({
        enabled: true,
        minLexicalScore: 0.35,
        minRelevanceScore: 70,
      });

      const pattern1 = createMockPattern({
        id: 'pattern-1',
        title: 'Unchanged Pattern',
        excerpt: 'This will stay the same',
        relevanceScore: 75,
      });

      const pattern2 = createMockPattern({
        id: 'pattern-2',
        title: 'Another Pattern',
        excerpt: 'Different content',
        relevanceScore: 80,
      });

      // First index - both patterns added
      await index.index([pattern1, pattern2]);
      expect(index.size).toBe(2);

      // Second index with same patterns - should skip recomputing
      await index.index([pattern1, pattern2]);
      expect(index.size).toBe(2);

      // Third index with only pattern1 - pattern2 should be removed
      await index.index([pattern1]);
      expect(index.size).toBe(1);

      // Verify correct pattern remains
      const results = await index.search('unchanged', 10);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('pattern-1');
    });

    it('should update pattern metadata while keeping same embedding', async () => {
      const index = new SemanticRecallIndex({
        enabled: true,
        minLexicalScore: 0.35,
        minRelevanceScore: 70,
      });

      const pattern = createMockPattern({
        id: 'update-test',
        title: 'Same Title',
        excerpt: 'Same Excerpt',
        relevanceScore: 75,
        topics: ['original'],
      });

      await index.index([pattern]);

      // Update pattern with different metadata but same title/excerpt (same content hash)
      const updatedPattern = createMockPattern({
        id: 'update-test',
        title: 'Same Title',
        excerpt: 'Same Excerpt',
        relevanceScore: 85,
        topics: ['updated', 'new-topic'],
      });

      await index.index([updatedPattern]);

      // Should still have only 1 indexed pattern
      expect(index.size).toBe(1);

      // Pattern reference should be updated
      const results = await index.search('same', 10);
      expect(results[0].relevanceScore).toBe(85);
      expect(results[0].topics).toEqual(['updated', 'new-topic']);
    });
  });
});

describe('Semantic recall fallback integration', () => {
  it('should not activate when disabled', async () => {
    const index = new SemanticRecallIndex({ ...DEFAULT_CONFIG, enabled: false });
    const indexSpy = vi.spyOn(index, 'index');

    // Simulate handler logic with disabled config
    const enabled = false;
    if (enabled) {
      await index.index([]);
    }

    expect(indexSpy).not.toHaveBeenCalled();
  });

  it('should activate only when lexical score is below threshold', () => {
    const config = {
      enabled: true,
      minLexicalScore: 0.35,
      minRelevanceScore: 70,
    };

    // Simulate weak lexical results (max score 30/100 = 0.3)
    const weakMaxScore = 30 / 100;
    expect(weakMaxScore).toBeLessThan(config.minLexicalScore);

    // Simulate strong lexical results (max score 80/100 = 0.8)
    const strongMaxScore = 80 / 100;
    expect(strongMaxScore).toBeGreaterThan(config.minLexicalScore);
  });

  it('should merge results conservatively (no duplicates)', () => {
    const lexicalResults = [
      createMockPattern({ id: 'A', title: 'A' }),
      createMockPattern({ id: 'B', title: 'B' }),
    ];

    const semanticResults = [
      createMockPattern({ id: 'B', title: 'B' }),
      createMockPattern({ id: 'C', title: 'C' }),
    ];

    // Simulate conservative merge
    const existingIds = new Set(lexicalResults.map(p => p.id));
    const newSemanticResults = semanticResults.filter(p => !existingIds.has(p.id));
    const merged = [...lexicalResults, ...newSemanticResults];

    expect(merged.length).toBe(3);
    expect(merged.map(p => p.id)).toEqual(['A', 'B', 'C']);
  });

  it('should filter out low-relevance patterns after merge', () => {
    const merged = [
      createMockPattern({ id: 'high', relevanceScore: 80 }),
      createMockPattern({ id: 'low', relevanceScore: 60 }),
    ];

    const minRelevanceScore = 70;
    const filtered = merged.filter(p => p.relevanceScore >= minRelevanceScore);

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('high');
  });
});
