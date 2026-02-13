// src/utils/source-registry.test.ts

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getSource,
  getAllFreeSources,
  getSourceNames,
  searchMultipleSources,
  prefetchAllSources,
  fetchAllPatterns,
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

    it('should expose search and fetch methods on instances', () => {
      const source = getSource('sundell');
      expect(typeof source.searchPatterns).toBe('function');
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
    it('should search all sources by default and combine results', async () => {
      const query = 'swift async';
      const results = await searchMultipleSources(query);

      expect(results).toHaveLength(4);
      const sources = getAllFreeSources();
      sources.forEach(source => {
        expect(source.searchPatterns).toHaveBeenCalledWith(query);
      });
    });

    it('should only search selected source', async () => {
      const results = await searchMultipleSources('swift', 'sundell');
      expect(results).toEqual([mockPattern]);

      const sundell = getSource('sundell');
      const vanderlee = getSource('vanderlee');
      const nilcoalescing = getSource('nilcoalescing');
      const pointfree = getSource('pointfree');

      expect(sundell.searchPatterns).toHaveBeenCalledTimes(1);
      expect(vanderlee.searchPatterns).not.toHaveBeenCalled();
      expect(nilcoalescing.searchPatterns).not.toHaveBeenCalled();
      expect(pointfree.searchPatterns).not.toHaveBeenCalled();
    });

    it('should collect results even if some sources fail', async () => {
      const failing = getSource('sundell');
      vi.mocked(failing.searchPatterns).mockRejectedValueOnce(new Error('network error'));

      const results = await searchMultipleSources('test query');
      expect(results).toHaveLength(3);
    });
  });

  describe('prefetchAllSources', () => {
    it('should prefetch all sources and return settled results', async () => {
      const results = await prefetchAllSources();

      expect(results).toHaveLength(4);
      const sources = getAllFreeSources();
      sources.forEach(source => {
        expect(source.fetchPatterns).toHaveBeenCalledTimes(1);
      });

      results.forEach(result => {
        expect(result).toHaveProperty('status');
        expect(['fulfilled', 'rejected']).toContain(result.status);
      });
    });

    it('should handle partial failures gracefully', async () => {
      const failing = getSource('sundell');
      vi.mocked(failing.fetchPatterns).mockRejectedValueOnce(new Error('prefetch error'));

      const results = await prefetchAllSources();

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      expect(successful + failed).toBe(4);
      expect(failed).toBe(1);
    });
  });

  // Merged from source-registry-dedup.test.ts
  describe('request deduplication', () => {
    beforeEach(() => {
      const sources = getAllFreeSources();
      sources.forEach(source => {
        vi.spyOn(source, 'fetchPatterns').mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve([mockPattern]), 50))
        );
        vi.spyOn(source, 'searchPatterns').mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve([mockPattern]), 50))
        );
      });
    });

    describe('dedupFetch via fetchAllPatterns', () => {
      it('should deduplicate concurrent fetchAllPatterns calls', async () => {
        const [r1, r2] = await Promise.all([
          fetchAllPatterns(),
          fetchAllPatterns(),
        ]);

        expect(r1.length).toBeGreaterThan(0);
        expect(r2.length).toBeGreaterThan(0);

        const sources = getAllFreeSources();
        sources.forEach(source => {
          expect(source.fetchPatterns).toHaveBeenCalledTimes(1);
        });
      });

      it('should allow a new fetch after the first completes', async () => {
        await fetchAllPatterns();
        await fetchAllPatterns();

        const sources = getAllFreeSources();
        sources.forEach(source => {
          expect(source.fetchPatterns).toHaveBeenCalledTimes(2);
        });
      });

      it('should clear inflight entry on failure so next call retries', async () => {
        const sundell = getSource('sundell');
        vi.spyOn(sundell, 'fetchPatterns')
          .mockRejectedValueOnce(new Error('network error'))
          .mockResolvedValueOnce([mockPattern]);

        const r1 = await fetchAllPatterns();
        expect(r1.length).toBeGreaterThan(0);

        const r2 = await fetchAllPatterns();
        expect(r2.length).toBeGreaterThan(0);

        expect(sundell.fetchPatterns).toHaveBeenCalledTimes(2);
      });
    });

    describe('dedupSearch via searchMultipleSources', () => {
      it('should deduplicate concurrent searches with same query', async () => {
        const [r1, r2] = await Promise.all([
          searchMultipleSources('swift'),
          searchMultipleSources('swift'),
        ]);

        expect(r1.length).toBeGreaterThan(0);
        expect(r2.length).toBeGreaterThan(0);

        const sources = getAllFreeSources();
        sources.forEach(source => {
          expect(source.searchPatterns).toHaveBeenCalledTimes(1);
        });
      });

      it('should fetch separately for different queries', async () => {
        await Promise.all([
          searchMultipleSources('swift'),
          searchMultipleSources('combine'),
        ]);

        const sources = getAllFreeSources();
        sources.forEach(source => {
          expect(source.searchPatterns).toHaveBeenCalledTimes(2);
          expect(source.searchPatterns).toHaveBeenCalledWith('swift');
          expect(source.searchPatterns).toHaveBeenCalledWith('combine');
        });
      });

      it('should allow a fresh search after the first completes', async () => {
        await searchMultipleSources('swift');
        await searchMultipleSources('swift');

        const sources = getAllFreeSources();
        sources.forEach(source => {
          expect(source.searchPatterns).toHaveBeenCalledTimes(2);
        });
      });
    });
  });
});
