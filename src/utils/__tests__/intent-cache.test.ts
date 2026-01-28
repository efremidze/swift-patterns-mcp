// src/utils/intent-cache.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { IntentCache, IntentKey } from '../intent-cache.js';

describe('IntentCache', () => {
  let cache: IntentCache;

  beforeEach(() => {
    // Use test-specific namespace to avoid cache pollution from build/ tests
    cache = new IntentCache(50, `test-${Date.now()}-${Math.random()}`);
    cache.clear();
  });

  describe('normalizeQuery', () => {
    it('should lowercase queries', () => {
      expect(cache.normalizeQuery('SwiftUI Navigation')).toBe('navigation swiftui');
    });

    it('should trim whitespace', () => {
      expect(cache.normalizeQuery('  async await  ')).toBe('async await');
    });

    it('should collapse multiple spaces', () => {
      expect(cache.normalizeQuery('async   await')).toBe('async await');
    });

    it('should remove stopwords', () => {
      // "how" and "to" are stopwords, but "use" is not
      expect(cache.normalizeQuery('how to use async await')).toBe('async await use');
    });

    it('should preserve Swift technical terms', () => {
      const result = cache.normalizeQuery('swiftui combine async await');
      expect(result).toContain('swiftui');
      expect(result).toContain('combine');
      expect(result).toContain('async');
      expect(result).toContain('await');
    });

    it('should sort tokens alphabetically', () => {
      expect(cache.normalizeQuery('zeta alpha beta')).toBe('alpha beta zeta');
    });

    it('should handle hyphenated terms', () => {
      const result = cache.normalizeQuery('async-await patterns');
      expect(result).toContain('async');
      expect(result).toContain('await');
      expect(result).toContain('pattern');
    });

    it('should produce consistent output for semantically similar queries', () => {
      const q1 = cache.normalizeQuery('How to use SwiftUI navigation');
      const q2 = cache.normalizeQuery('swiftui navigation usage');
      const q3 = cache.normalizeQuery('Navigation in SwiftUI');

      // All should normalize similarly (containing same key terms)
      expect(q1).toContain('navigation');
      expect(q1).toContain('swiftui');
      expect(q2).toContain('navigation');
      expect(q2).toContain('swiftui');
      expect(q3).toContain('navigation');
      expect(q3).toContain('swiftui');
    });
  });

  describe('getSourceFingerprint', () => {
    it('should produce deterministic fingerprint for same sources', () => {
      const sources = ['sundell', 'vanderlee', 'pointfree'];
      const fp1 = cache.getSourceFingerprint(sources);
      const fp2 = cache.getSourceFingerprint(sources);

      expect(fp1).toBe(fp2);
    });

    it('should produce same fingerprint regardless of source order', () => {
      const fp1 = cache.getSourceFingerprint(['sundell', 'vanderlee']);
      const fp2 = cache.getSourceFingerprint(['vanderlee', 'sundell']);

      expect(fp1).toBe(fp2);
    });

    it('should produce different fingerprint for different sources', () => {
      const fp1 = cache.getSourceFingerprint(['sundell']);
      const fp2 = cache.getSourceFingerprint(['sundell', 'vanderlee']);

      expect(fp1).not.toBe(fp2);
    });

    it('should return 12-character fingerprint', () => {
      const fp = cache.getSourceFingerprint(['sundell', 'vanderlee']);
      expect(fp.length).toBe(12);
    });
  });

  describe('buildCacheKey', () => {
    it('should produce deterministic key for same intent', () => {
      const intent: IntentKey = {
        tool: 'get_swift_pattern',
        query: 'SwiftUI Navigation',
        minQuality: 60,
        sources: ['sundell', 'vanderlee'],
      };

      const key1 = cache.buildCacheKey(intent);
      const key2 = cache.buildCacheKey(intent);

      expect(key1).toBe(key2);
    });

    it('should produce same key for different query orderings', () => {
      const intent1: IntentKey = {
        tool: 'get_swift_pattern',
        query: 'async await SwiftUI',
        minQuality: 60,
        sources: ['sundell'],
      };
      const intent2: IntentKey = {
        tool: 'get_swift_pattern',
        query: 'SwiftUI async await',
        minQuality: 60,
        sources: ['sundell'],
      };

      expect(cache.buildCacheKey(intent1)).toBe(cache.buildCacheKey(intent2));
    });

    it('should produce different key for different tools', () => {
      const base = { query: 'testing', minQuality: 60, sources: ['sundell'] };
      const key1 = cache.buildCacheKey({ ...base, tool: 'get_swift_pattern' });
      const key2 = cache.buildCacheKey({ ...base, tool: 'search_swift_content' });

      expect(key1).not.toBe(key2);
    });

    it('should produce different key for different minQuality', () => {
      const base = { tool: 'get_swift_pattern', query: 'testing', sources: ['sundell'] };
      const key1 = cache.buildCacheKey({ ...base, minQuality: 60 });
      const key2 = cache.buildCacheKey({ ...base, minQuality: 80 });

      expect(key1).not.toBe(key2);
    });

    it('should produce different key for different sources', () => {
      const base = { tool: 'get_swift_pattern', query: 'testing', minQuality: 60 };
      const key1 = cache.buildCacheKey({ ...base, sources: ['sundell'] });
      const key2 = cache.buildCacheKey({ ...base, sources: ['sundell', 'vanderlee'] });

      expect(key1).not.toBe(key2);
    });

    it('should produce different key when requireCode differs', () => {
      const base = { tool: 'search_swift_content', query: 'testing', minQuality: 60, sources: ['sundell'] };
      const key1 = cache.buildCacheKey({ ...base, requireCode: false });
      const key2 = cache.buildCacheKey({ ...base, requireCode: true });

      expect(key1).not.toBe(key2);
    });

    it('should return 64-character SHA-256 hash', () => {
      const key = cache.buildCacheKey({
        tool: 'get_swift_pattern',
        query: 'testing',
        minQuality: 60,
        sources: ['sundell'],
      });

      expect(key.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(key)).toBe(true);
    });
  });

  describe('get and set', () => {
    const testIntent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'SwiftUI navigation',
      minQuality: 60,
      sources: ['sundell', 'vanderlee'],
    };

    const testResult = {
      patternIds: ['pattern-1', 'pattern-2'],
      scores: { 'pattern-1': 95, 'pattern-2': 87 },
      totalCount: 2,
    };

    it('should return null for non-existent key', async () => {
      const result = await cache.get(testIntent);
      expect(result).toBeNull();
    });

    it('should store and retrieve cached result', async () => {
      await cache.set(testIntent, testResult);
      const retrieved = await cache.get(testIntent);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.patternIds).toEqual(testResult.patternIds);
      expect(retrieved?.scores).toEqual(testResult.scores);
      expect(retrieved?.totalCount).toBe(testResult.totalCount);
    });

    it('should include sourceFingerprint in stored result', async () => {
      await cache.set(testIntent, testResult);
      const retrieved = await cache.get(testIntent);

      expect(retrieved?.sourceFingerprint).toBe(
        cache.getSourceFingerprint(testIntent.sources)
      );
    });

    it('should include timestamp in stored result', async () => {
      const beforeSet = Date.now();
      await cache.set(testIntent, testResult);
      const afterSet = Date.now();

      const retrieved = await cache.get(testIntent);

      expect(retrieved?.timestamp).toBeGreaterThanOrEqual(beforeSet);
      expect(retrieved?.timestamp).toBeLessThanOrEqual(afterSet);
    });

    it('should return null when sources change (fingerprint mismatch)', async () => {
      await cache.set(testIntent, testResult);

      // Query with different sources
      const differentSources: IntentKey = {
        ...testIntent,
        sources: ['sundell'], // Different from original
      };

      // Should miss due to fingerprint validation
      const result = await cache.get(differentSources);
      expect(result).toBeNull();
    });
  });

  describe('getOrFetch', () => {
    const testIntent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'combine reactive',
      minQuality: 60,
      sources: ['sundell'],
    };

    it('should call fetcher on cache miss', async () => {
      let fetcherCalled = false;
      const fetcher = async () => {
        fetcherCalled = true;
        return {
          patternIds: ['p1'],
          scores: { 'p1': 90 },
          totalCount: 1,
        };
      };

      await cache.getOrFetch(testIntent, fetcher);

      expect(fetcherCalled).toBe(true);
    });

    it('should not call fetcher on cache hit', async () => {
      // Pre-populate cache
      await cache.set(testIntent, {
        patternIds: ['cached'],
        scores: { 'cached': 80 },
        totalCount: 1,
      });

      let fetcherCalled = false;
      const fetcher = async () => {
        fetcherCalled = true;
        return {
          patternIds: ['fresh'],
          scores: { 'fresh': 90 },
          totalCount: 1,
        };
      };

      const result = await cache.getOrFetch(testIntent, fetcher);

      expect(fetcherCalled).toBe(false);
      expect(result.patternIds).toEqual(['cached']);
    });

    it('should cache fetched results', async () => {
      const fetcher = async () => ({
        patternIds: ['fetched'],
        scores: { 'fetched': 85 },
        totalCount: 1,
      });

      await cache.getOrFetch(testIntent, fetcher);

      // Second call should hit cache
      const cached = await cache.get(testIntent);
      expect(cached?.patternIds).toEqual(['fetched']);
    });

    // Note: Stampede prevention (concurrent request deduplication) is tested
    // in src/integration/cache-behavior.test.ts with more comprehensive scenarios
  });

  describe('stats', () => {
    const testIntent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'testing',
      minQuality: 60,
      sources: ['sundell'],
    };

    it('should track cache hits', async () => {
      await cache.set(testIntent, {
        patternIds: ['p1'],
        scores: { 'p1': 90 },
        totalCount: 1,
      });

      await cache.get(testIntent);
      await cache.get(testIntent);

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', async () => {
      await cache.get(testIntent);
      await cache.get({ ...testIntent, query: 'different' });

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate correctly', async () => {
      await cache.set(testIntent, {
        patternIds: ['p1'],
        scores: { 'p1': 90 },
        totalCount: 1,
      });

      await cache.get(testIntent); // hit
      await cache.get({ ...testIntent, query: 'miss1' }); // miss
      await cache.get(testIntent); // hit
      await cache.get({ ...testIntent, query: 'miss2' }); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should reset stats on clear', async () => {
      await cache.get(testIntent); // miss
      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });
});
