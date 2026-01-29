// src/utils/__tests__/source-registry-dedup.test.ts
// Tests for in-flight request deduplication in source-registry

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSource,
  getAllFreeSources,
  fetchAllPatterns,
  searchMultipleSources,
  type FreeSourceName,
} from '../source-registry.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';

const mockPattern: BasePattern = {
  id: 'dedup-1',
  title: 'Dedup Test',
  url: 'https://example.com',
  publishDate: '2024-01-01',
  excerpt: 'test',
  content: 'test content',
  topics: ['swift'],
  relevanceScore: 80,
  hasCode: true,
};

describe('request deduplication', () => {
  beforeEach(() => {
    // Spy on all source instances with delayed responses to create a dedup window
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('dedupFetch via fetchAllPatterns', () => {
    it('should deduplicate concurrent fetchAllPatterns calls', async () => {
      const [r1, r2] = await Promise.all([
        fetchAllPatterns(),
        fetchAllPatterns(),
      ]);

      // Both should return results
      expect(r1.length).toBeGreaterThan(0);
      expect(r2.length).toBeGreaterThan(0);

      // Each source's fetchPatterns should have been called exactly once
      const sources = getAllFreeSources();
      sources.forEach(source => {
        expect(source.fetchPatterns).toHaveBeenCalledTimes(1);
      });
    });

    it('should allow a new fetch after the first completes', async () => {
      await fetchAllPatterns();
      await fetchAllPatterns();

      // Sequential: each source should be called twice
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

      // First call — sundell fails but others succeed
      const r1 = await fetchAllPatterns();
      // sundell's failure is swallowed by Promise.allSettled
      expect(r1.length).toBeGreaterThan(0);

      // Second call — sundell should retry (inflight cleared after rejection)
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

      // Each source's searchPatterns should have been called once
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

      // Each source should have been called twice (once per query)
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

      // Sequential: each source called twice
      const sources = getAllFreeSources();
      sources.forEach(source => {
        expect(source.searchPatterns).toHaveBeenCalledTimes(2);
      });
    });
  });
});
