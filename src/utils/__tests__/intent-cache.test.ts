// src/utils/intent-cache.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { IntentCache, IntentKey } from '../intent-cache.js';

describe('IntentCache', () => {
  let cache: IntentCache;

  beforeEach(async () => {
    // Use test-specific namespace to avoid cache pollution from build/ tests
    cache = new IntentCache(50, `test-${Date.now()}-${Math.random()}`);
    await cache.clear();
  });

  // normalizeQuery tests removed — covered by src/utils/__tests__/search-terms.test.ts

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

  // get/set tests removed — covered by src/integration/__tests__/cache-behavior.test.ts
  // getOrFetch tests removed — covered by src/integration/__tests__/cache-behavior.test.ts
  // stats tests removed — covered by src/integration/__tests__/cache-behavior.test.ts
});
