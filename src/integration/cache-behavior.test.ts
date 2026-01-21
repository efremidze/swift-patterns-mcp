// src/integration/cache-behavior.test.ts
// Integration tests for IntentCache behavior and performance metrics

import { describe, it, expect, beforeEach } from 'vitest';
import { intentCache } from '../utils/intent-cache.js';
import type { IntentKey, StorableCachedSearchResult } from '../utils/intent-cache.js';

// Test fixtures - known patterns with specific properties for testing
const MOCK_PATTERNS = [
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
    relevanceScore: 55,
    hasCode: false,
    publishDate: '2024-01-10T00:00:00Z',
  },
];

describe('IntentCache - Cache Hit/Miss Behavior', () => {
  beforeEach(() => {
    // Clear cache before each test to isolate tests
    intentCache.clear();
  });

  it('should cache miss on first call, cache hit on second identical call', async () => {
    const intent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui patterns',
      minQuality: 60,
      sources: ['sundell', 'vanderlee'],
    };

    // First call - cache miss
    const firstResult = await intentCache.get(intent);
    expect(firstResult).toBeNull();

    // Store result in cache
    const cacheData: StorableCachedSearchResult = {
      patternIds: MOCK_PATTERNS.map(p => p.id),
      scores: Object.fromEntries(MOCK_PATTERNS.map(p => [p.id, p.relevanceScore])),
      totalCount: MOCK_PATTERNS.length,
      patterns: MOCK_PATTERNS,
    };
    await intentCache.set(intent, cacheData);

    // Second call - cache hit
    const secondResult = await intentCache.get(intent);
    expect(secondResult).not.toBeNull();
    expect(secondResult?.patternIds).toEqual(MOCK_PATTERNS.map(p => p.id));
    expect(secondResult?.patterns).toEqual(MOCK_PATTERNS);
  });

  it('should cache miss when topic changes', async () => {
    const intent1: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    const intent2: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'combine',
      minQuality: 60,
      sources: ['sundell'],
    };

    // Cache first intent
    const cacheData: StorableCachedSearchResult = {
      patternIds: ['sundell-1'],
      scores: { 'sundell-1': 85 },
      totalCount: 1,
      patterns: [MOCK_PATTERNS[0]],
    };
    await intentCache.set(intent1, cacheData);

    // Different topic should miss
    const result = await intentCache.get(intent2);
    expect(result).toBeNull();
  });

  it('should cache miss when minQuality changes', async () => {
    const intent1: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    const intent2: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 70,
      sources: ['sundell'],
    };

    // Cache first intent
    const cacheData: StorableCachedSearchResult = {
      patternIds: MOCK_PATTERNS.map(p => p.id),
      scores: Object.fromEntries(MOCK_PATTERNS.map(p => [p.id, p.relevanceScore])),
      totalCount: MOCK_PATTERNS.length,
      patterns: MOCK_PATTERNS,
    };
    await intentCache.set(intent1, cacheData);

    // Different minQuality should miss
    const result = await intentCache.get(intent2);
    expect(result).toBeNull();
  });

  it('should cache miss when requireCode changes', async () => {
    const intent1: IntentKey = {
      tool: 'search_swift_content',
      query: 'async await',
      minQuality: 0,
      sources: ['sundell'],
      requireCode: false,
    };

    const intent2: IntentKey = {
      tool: 'search_swift_content',
      query: 'async await',
      minQuality: 0,
      sources: ['sundell'],
      requireCode: true,
    };

    // Cache first intent
    const cacheData: StorableCachedSearchResult = {
      patternIds: MOCK_PATTERNS.map(p => p.id),
      scores: Object.fromEntries(MOCK_PATTERNS.map(p => [p.id, p.relevanceScore])),
      totalCount: MOCK_PATTERNS.length,
      patterns: MOCK_PATTERNS,
    };
    await intentCache.set(intent1, cacheData);

    // Different requireCode should miss
    const result = await intentCache.get(intent2);
    expect(result).toBeNull();
  });

  it('should cache miss when sources change', async () => {
    const intent1: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    const intent2: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell', 'vanderlee'],
    };

    // Cache first intent
    const cacheData: StorableCachedSearchResult = {
      patternIds: ['sundell-1'],
      scores: { 'sundell-1': 85 },
      totalCount: 1,
      patterns: [MOCK_PATTERNS[0]],
    };
    await intentCache.set(intent1, cacheData);

    // Different sources should miss (source fingerprint changed)
    const result = await intentCache.get(intent2);
    expect(result).toBeNull();
  });

  it('should persist cache across multiple calls with same intent', async () => {
    const intent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell', 'vanderlee'],
    };

    // Cache the intent
    const cacheData: StorableCachedSearchResult = {
      patternIds: MOCK_PATTERNS.map(p => p.id),
      scores: Object.fromEntries(MOCK_PATTERNS.map(p => [p.id, p.relevanceScore])),
      totalCount: MOCK_PATTERNS.length,
      patterns: MOCK_PATTERNS,
    };
    await intentCache.set(intent, cacheData);

    // Multiple calls should all hit cache
    const result1 = await intentCache.get(intent);
    const result2 = await intentCache.get(intent);
    const result3 = await intentCache.get(intent);

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result3).not.toBeNull();
    expect(result1?.patternIds).toEqual(result2?.patternIds);
    expect(result2?.patternIds).toEqual(result3?.patternIds);
  });
});

describe('IntentCache - Cache Metrics', () => {
  beforeEach(() => {
    intentCache.clear();
  });

  it('should return 0/0 stats initially after clear', () => {
    const stats = intentCache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.hitRate).toBe(0);
  });

  it('should increment miss count on cache miss', async () => {
    const intent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    await intentCache.get(intent);

    const stats = intentCache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });

  it('should increment hit count on cache hit', async () => {
    const intent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    // Cache the intent
    const cacheData: StorableCachedSearchResult = {
      patternIds: ['sundell-1'],
      scores: { 'sundell-1': 85 },
      totalCount: 1,
      patterns: [MOCK_PATTERNS[0]],
    };
    await intentCache.set(intent, cacheData);

    // Hit the cache
    await intentCache.get(intent);

    const stats = intentCache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(0);
  });

  it('should calculate hit rate correctly', async () => {
    const intent1: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    const intent2: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'combine',
      minQuality: 60,
      sources: ['sundell'],
    };

    // Cache intent1
    const cacheData: StorableCachedSearchResult = {
      patternIds: ['sundell-1'],
      scores: { 'sundell-1': 85 },
      totalCount: 1,
      patterns: [MOCK_PATTERNS[0]],
    };
    await intentCache.set(intent1, cacheData);

    // 2 hits (intent1)
    await intentCache.get(intent1);
    await intentCache.get(intent1);

    // 2 misses (intent2)
    await intentCache.get(intent2);
    await intentCache.get(intent2);

    // Total: 2 hits + 2 misses = 4 requests
    // Hit rate: 2/4 = 0.5
    const stats = intentCache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(2);
    expect(stats.hitRate).toBe(0.5);
  });

  it('should reset metrics after clear', async () => {
    const intent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    // Generate some cache activity
    await intentCache.get(intent);  // miss
    const cacheData: StorableCachedSearchResult = {
      patternIds: ['sundell-1'],
      scores: { 'sundell-1': 85 },
      totalCount: 1,
    };
    await intentCache.set(intent, cacheData);
    await intentCache.get(intent);  // hit

    // Verify stats exist
    let stats = intentCache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);

    // Clear cache
    intentCache.clear();

    // Verify stats reset
    stats = intentCache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.hitRate).toBe(0);
  });

  it('should track metrics separately for different tools', async () => {
    const getPatternIntent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    const searchIntent: IntentKey = {
      tool: 'search_swift_content',
      query: 'swiftui',
      minQuality: 0,
      sources: ['sundell'],
    };

    // Cache get_swift_pattern
    const cacheData1: StorableCachedSearchResult = {
      patternIds: ['sundell-1'],
      scores: { 'sundell-1': 85 },
      totalCount: 1,
    };
    await intentCache.set(getPatternIntent, cacheData1);

    // Cache search_swift_content
    const cacheData2: StorableCachedSearchResult = {
      patternIds: ['sundell-1'],
      scores: { 'sundell-1': 85 },
      totalCount: 1,
    };
    await intentCache.set(searchIntent, cacheData2);

    // Hit both caches
    await intentCache.get(getPatternIntent);  // hit
    await intentCache.get(searchIntent);      // hit

    // Both should register as hits
    const stats = intentCache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(0);
  });
});

describe('IntentCache - Cross-Handler Cache Isolation', () => {
  beforeEach(() => {
    intentCache.clear();
  });

  it('should use separate cache keys for different tools with same query', async () => {
    const getPatternIntent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    const searchIntent: IntentKey = {
      tool: 'search_swift_content',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    // Cache get_swift_pattern
    const cacheData: StorableCachedSearchResult = {
      patternIds: ['sundell-1'],
      scores: { 'sundell-1': 85 },
      totalCount: 1,
      patterns: [MOCK_PATTERNS[0]],
    };
    await intentCache.set(getPatternIntent, cacheData);

    // search_swift_content with same query should miss (different tool)
    const result = await intentCache.get(searchIntent);
    expect(result).toBeNull();
  });

  it('should cache same query independently for different handlers', async () => {
    const getPatternIntent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    const searchIntent: IntentKey = {
      tool: 'search_swift_content',
      query: 'swiftui',
      minQuality: 0,
      sources: ['sundell'],
    };

    // Cache for both handlers
    const cacheData1: StorableCachedSearchResult = {
      patternIds: ['sundell-1'],
      scores: { 'sundell-1': 85 },
      totalCount: 1,
      patterns: [MOCK_PATTERNS[0]],
    };
    await intentCache.set(getPatternIntent, cacheData1);

    const cacheData2: StorableCachedSearchResult = {
      patternIds: ['sundell-1', 'sundell-2'],
      scores: { 'sundell-1': 85, 'sundell-2': 55 },
      totalCount: 2,
      patterns: MOCK_PATTERNS,
    };
    await intentCache.set(searchIntent, cacheData2);

    // Both should hit their respective caches
    const result1 = await intentCache.get(getPatternIntent);
    const result2 = await intentCache.get(searchIntent);

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1?.totalCount).toBe(1);
    expect(result2?.totalCount).toBe(2);
  });
});

describe('IntentCache - Stampede Prevention', () => {
  beforeEach(() => {
    intentCache.clear();
  });

  it('should deduplicate concurrent identical requests', async () => {
    const intent: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    let fetchCount = 0;
    const slowFetcher = async (): Promise<StorableCachedSearchResult> => {
      fetchCount++;
      // Simulate slow fetch (50ms delay)
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        patternIds: ['sundell-1'],
        scores: { 'sundell-1': 85 },
        totalCount: 1,
        patterns: [MOCK_PATTERNS[0]],
      };
    };

    // Make 5 concurrent requests
    const promises = [
      intentCache.getOrFetch(intent, slowFetcher),
      intentCache.getOrFetch(intent, slowFetcher),
      intentCache.getOrFetch(intent, slowFetcher),
      intentCache.getOrFetch(intent, slowFetcher),
      intentCache.getOrFetch(intent, slowFetcher),
    ];

    const results = await Promise.all(promises);

    // Should only fetch once (stampede prevention)
    expect(fetchCount).toBe(1);

    // All promises should resolve to same result
    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result.patternIds).toEqual(['sundell-1']);
      expect(result.totalCount).toBe(1);
    });
  });

  it('should fetch separately for different intents', async () => {
    const intent1: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    const intent2: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'combine',
      minQuality: 60,
      sources: ['sundell'],
    };

    const intent3: IntentKey = {
      tool: 'search_swift_content',
      query: 'async',
      minQuality: 0,
      sources: ['sundell'],
    };

    let fetchCount = 0;
    const slowFetcher = async (intentId: string): Promise<StorableCachedSearchResult> => {
      fetchCount++;
      await new Promise(resolve => setTimeout(resolve, 30));
      return {
        patternIds: [intentId],
        scores: { [intentId]: 85 },
        totalCount: 1,
      };
    };

    // Make concurrent requests for different intents
    const promises = [
      intentCache.getOrFetch(intent1, () => slowFetcher('intent1')),
      intentCache.getOrFetch(intent2, () => slowFetcher('intent2')),
      intentCache.getOrFetch(intent3, () => slowFetcher('intent3')),
    ];

    const results = await Promise.all(promises);

    // Should fetch once per unique intent (3 total)
    expect(fetchCount).toBe(3);

    // Each result should be different
    expect(results[0].patternIds).toEqual(['intent1']);
    expect(results[1].patternIds).toEqual(['intent2']);
    expect(results[2].patternIds).toEqual(['intent3']);
  });

  it('should not cross-contaminate results for different intents', async () => {
    const intent1: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'swiftui',
      minQuality: 60,
      sources: ['sundell'],
    };

    const intent2: IntentKey = {
      tool: 'get_swift_pattern',
      query: 'combine',
      minQuality: 60,
      sources: ['sundell'],
    };

    const fetcher1 = async (): Promise<StorableCachedSearchResult> => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return {
        patternIds: ['sundell-1'],
        scores: { 'sundell-1': 85 },
        totalCount: 1,
        patterns: [MOCK_PATTERNS[0]],
      };
    };

    const fetcher2 = async (): Promise<StorableCachedSearchResult> => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return {
        patternIds: ['sundell-2'],
        scores: { 'sundell-2': 55 },
        totalCount: 1,
        patterns: [MOCK_PATTERNS[1]],
      };
    };

    // Make concurrent requests for different intents
    const [result1, result2] = await Promise.all([
      intentCache.getOrFetch(intent1, fetcher1),
      intentCache.getOrFetch(intent2, fetcher2),
    ]);

    // Results should be distinct, no cross-contamination
    expect(result1.patternIds).toEqual(['sundell-1']);
    expect(result2.patternIds).toEqual(['sundell-2']);
    expect(result1.patterns).toEqual([MOCK_PATTERNS[0]]);
    expect(result2.patterns).toEqual([MOCK_PATTERNS[1]]);
  });
});
