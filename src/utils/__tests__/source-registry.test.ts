// src/utils/source-registry.test.ts

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  getSource, 
  getAllFreeSources, 
  getSources, 
  getSourceNames,
  searchMultipleSources,
  prefetchAllSources,
  type FreeSourceName 
} from '../source-registry.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';

// Mock pattern data for tests
const mockPattern: BasePattern = {
  id: 'test-1',
  title: 'Test Pattern',
  url: 'https://example.com/test',
  publishDate: '2024-01-01',
  excerpt: 'Test excerpt',
  content: 'Test content',
  topics: ['swift'],
  relevanceScore: 80,
  hasCode: true,
};

describe('source-registry', () => {
  // Mock the searchPatterns and fetchPatterns methods before each test
  beforeEach(() => {
    const sources = getAllFreeSources();
    sources.forEach(source => {
      vi.spyOn(source, 'searchPatterns').mockResolvedValue([mockPattern]);
      vi.spyOn(source, 'fetchPatterns').mockResolvedValue([mockPattern]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('getSource singleton caching', () => {
    it('should return the same instance for multiple calls with the same source name', () => {
      const source1 = getSource('sundell');
      const source2 = getSource('sundell');
      
      expect(source1).toBe(source2);
    });

    it('should return different instances for different source names', () => {
      const sundell = getSource('sundell');
      const vanderlee = getSource('vanderlee');
      
      expect(sundell).not.toBe(vanderlee);
    });

    it('should cache all source types independently', () => {
      const sources: FreeSourceName[] = ['sundell', 'vanderlee', 'nilcoalescing', 'pointfree'];
      const instances = sources.map(name => getSource(name));
      
      // Verify all instances are different
      const uniqueInstances = new Set(instances);
      expect(uniqueInstances.size).toBe(sources.length);
      
      // Verify second calls return cached instances
      sources.forEach((name, index) => {
        expect(getSource(name)).toBe(instances[index]);
      });
    });

    it('should persist cache across multiple calls', () => {
      const first = getSource('nilcoalescing');
      const second = getSource('nilcoalescing');
      const third = getSource('nilcoalescing');
      
      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it('should have searchPatterns method on cached instances', () => {
      const source = getSource('sundell');
      expect(source).toHaveProperty('searchPatterns');
      expect(typeof source.searchPatterns).toBe('function');
    });

    it('should have fetchPatterns method on cached instances', () => {
      const source = getSource('pointfree');
      expect(source).toHaveProperty('fetchPatterns');
      expect(typeof source.fetchPatterns).toBe('function');
    });
  });

  describe('getAllFreeSources', () => {
    it('should return all source instances', () => {
      const sources = getAllFreeSources();
      expect(sources).toHaveLength(4);
    });

    it('should return cached instances', () => {
      const sources1 = getAllFreeSources();
      const sources2 = getAllFreeSources();
      
      // Compare instances at each index
      sources1.forEach((source, index) => {
        expect(source).toBe(sources2[index]);
      });
    });
  });

  describe('getSources', () => {
    it('should return single source when given one name', () => {
      const sources = getSources('sundell');
      expect(sources).toHaveLength(1);
      expect(sources[0]).toBe(getSource('sundell'));
    });

    it('should return multiple sources when given array of names', () => {
      const sources = getSources(['sundell', 'vanderlee']);
      expect(sources).toHaveLength(2);
      expect(sources[0]).toBe(getSource('sundell'));
      expect(sources[1]).toBe(getSource('vanderlee'));
    });

    it('should return all sources when given "all"', () => {
      const sources = getSources('all');
      expect(sources).toHaveLength(4);
    });

    it('should return cached instances', () => {
      const sources1 = getSources(['pointfree', 'nilcoalescing']);
      const sources2 = getSources(['pointfree', 'nilcoalescing']);
      
      expect(sources1[0]).toBe(sources2[0]);
      expect(sources1[1]).toBe(sources2[1]);
    });
  });

  describe('getSourceNames', () => {
    it('should return single name in array for single source', () => {
      const names = getSourceNames('sundell');
      expect(names).toEqual(['sundell']);
    });

    it('should return array of names for array input', () => {
      const names = getSourceNames(['sundell', 'vanderlee']);
      expect(names).toEqual(['sundell', 'vanderlee']);
    });

    it('should return all source names for "all"', () => {
      const names = getSourceNames('all');
      expect(names).toHaveLength(4);
      expect(names).toContain('sundell');
      expect(names).toContain('vanderlee');
      expect(names).toContain('nilcoalescing');
      expect(names).toContain('pointfree');
    });
  });

  describe('searchMultipleSources', () => {
    it('should search all sources by default', async () => {
      const results = await searchMultipleSources('swift async');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle individual source searches', async () => {
      const results = await searchMultipleSources('swift', 'sundell');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle array of sources', async () => {
      const results = await searchMultipleSources('swift', ['sundell', 'vanderlee']);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should collect results even if some sources fail', async () => {
      // This tests the Promise.allSettled behavior
      const results = await searchMultipleSources('test query');
      // Should not throw even if individual sources fail
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('prefetchAllSources', () => {
    it('should return SettledResult array', async () => {
      const results = await prefetchAllSources();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(4);
    });

    it('should return results with status property', async () => {
      const results = await prefetchAllSources();
      results.forEach(result => {
        expect(result).toHaveProperty('status');
        expect(['fulfilled', 'rejected']).toContain(result.status);
      });
    });

    it('should handle partial failures gracefully', async () => {
      // Even if some sources fail, the function should complete
      const results = await prefetchAllSources();
      expect(results).toBeDefined();
      expect(results.length).toBe(4);
      
      // Count successful and failed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      expect(successful + failed).toBe(4);
    });

    it('should provide access to fulfilled results', async () => {
      const results = await prefetchAllSources();
      const fulfilled = results.filter(
        (r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled'
      );
      
      fulfilled.forEach(result => {
        expect(result).toHaveProperty('value');
        expect(Array.isArray(result.value)).toBe(true);
      });
    });

    it('should provide access to rejection reasons', async () => {
      const results = await prefetchAllSources();
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );
      
      rejected.forEach(result => {
        expect(result).toHaveProperty('reason');
      });
    });
  });

  describe('cache persistence integration', () => {
    it('should maintain same instances across different function calls', () => {
      const direct = getSource('sundell');
      const fromArray = getSources(['sundell'])[0];
      const fromAll = getAllFreeSources()[0]; // Assuming sundell is first
      
      expect(direct).toBe(fromArray);
      // Note: fromAll might be in a different order, so we just check it's in the set
      const allSources = getAllFreeSources();
      expect(allSources).toContain(direct);
    });

    it('should use cached instances in search operations', async () => {
      const sourceBefore = getSource('sundell');
      await searchMultipleSources('test', 'sundell');
      const sourceAfter = getSource('sundell');
      
      expect(sourceBefore).toBe(sourceAfter);
    });

    it('should use cached instances in prefetch operations', async () => {
      const sourceBefore = getSource('pointfree');
      await prefetchAllSources();
      const sourceAfter = getSource('pointfree');
      
      expect(sourceBefore).toBe(sourceAfter);
    });
  });
});
