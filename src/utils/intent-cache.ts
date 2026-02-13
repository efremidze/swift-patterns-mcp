// src/utils/intent-cache.ts
// Intent-aware response caching for MCP tool handlers

import { createHash } from 'crypto';
import { FileCache } from './cache.js';
import { normalizeTokens } from './search-terms.js';
import { InflightDeduper } from './inflight-dedup.js';

// 12 hours in seconds (longer than RSS cache, shorter than article cache)
const DEFAULT_INTENT_TTL = 43200;
const DEFAULT_MAX_MEMORY_ENTRIES = 200;

/**
 * Components used to build a cache key
 */
export interface IntentKey {
  tool: string;           // Tool name: "get_swift_pattern" | "search_swift_content"
  query: string;          // Raw query/topic from user
  minQuality: number;     // Quality threshold (default 60)
  sources: string[];      // Enabled source IDs
  requireCode?: boolean;  // Optional code filter
}

/**
 * Cached search result with all required fields
 */
interface CachedIntentResult {
  patternIds: string[];           // Pattern IDs in order
  scores: Record<string, number>; // ID -> relevance score mapping
  sourceFingerprint: string;      // Hash of sources at cache time
  timestamp: number;              // Cache creation time
  totalCount: number;             // Total patterns before any limits
  patterns?: unknown[];           // Optional - full pattern objects when stored
}

/**
 * Storable cached search result (without immutable metadata fields)
 * Handlers use this to set cache values with complete type safety
 */
export type StorableCachedSearchResult = Omit<CachedIntentResult, 'sourceFingerprint' | 'timestamp'>;

/**
 * IntentCache - Caches tool handler results by normalized query intent
 *
 * Key features:
 * - SHA-256 hashing for cache keys
 * - Query normalization (lowercase, stopwords, sorted)
 * - Source fingerprinting for invalidation
 * - Stores metadata only (IDs + scores), not full patterns
 */
export class IntentCache {
  private cache: FileCache;
  private pendingFetches = new InflightDeduper<string, CachedIntentResult>();

  // Simple metrics
  private hits = 0;
  private misses = 0;

  constructor(
    maxMemoryEntries: number = DEFAULT_MAX_MEMORY_ENTRIES,
    namespace: string = 'intent'
  ) {
    this.cache = new FileCache(namespace, maxMemoryEntries);
  }

  /**
   * Normalize a query for consistent cache key generation
   * - Lowercase
   * - Remove stopwords (except Swift terms)
   * - Sort alphabetically (order-independent)
   */
  normalizeQuery(query: string): string {
    // Use shared normalization without stemming (cache keys shouldn't stem)
    const processed = normalizeTokens(query);

    // Sort for order-independent matching
    return processed.sort().join(' ');
  }

  /**
   * Generate a fingerprint from enabled source IDs
   * Used to detect when sources change (invalidating cached results)
   */
  getSourceFingerprint(sources: string[]): string {
    const sorted = [...sources].sort().join(',');
    return createHash('sha256')
      .update(sorted)
      .digest('hex')
      .substring(0, 12); // 12 chars sufficient for source combos
  }

  /**
   * Build a cache key from intent components
   * Format: tool::normalizedQuery::qN::fingerprint[::code]
   */
  buildCacheKey(intent: IntentKey): string {
    const normalized = this.normalizeQuery(intent.query);
    const fingerprint = this.getSourceFingerprint(intent.sources);

    const parts = [
      intent.tool,
      normalized,
      `q${intent.minQuality}`,
      fingerprint,
    ];

    if (intent.requireCode) {
      parts.push('code');
    }

    const key = parts.join('::');

    // Always hash for filesystem safety and consistent length
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Get cached result, validating source fingerprint
   * Returns null if no valid cache entry exists
   */
  async get(intent: IntentKey): Promise<CachedIntentResult | null> {
    const key = this.buildCacheKey(intent);
    const cached = await this.cache.get<CachedIntentResult>(key);

    if (!cached) {
      this.misses++;
      return null;
    }

    // Validate source fingerprint hasn't changed
    const currentFingerprint = this.getSourceFingerprint(intent.sources);
    if (cached.sourceFingerprint !== currentFingerprint) {
      this.misses++;
      return null; // Sources changed, treat as miss
    }

    this.hits++;
    return cached;
  }

  /**
   * Store result in cache
   * Accepts both basic CachedIntentResult and extended CachedIntentResultWithPatterns
   */
  async set(
    intent: IntentKey,
    result: StorableCachedSearchResult,
    ttl: number = DEFAULT_INTENT_TTL
  ): Promise<void> {
    const key = this.buildCacheKey(intent);
    const fingerprint = this.getSourceFingerprint(intent.sources);

    const entry = {
      ...result,
      sourceFingerprint: fingerprint,
      timestamp: Date.now(),
    };

    await this.cache.set(key, entry, ttl);
  }

  /**
   * Get cached result or fetch if not cached
   * Includes in-flight deduplication to prevent cache stampede
   */
  async getOrFetch(
    intent: IntentKey,
    fetcher: () => Promise<StorableCachedSearchResult>,
    ttl: number = DEFAULT_INTENT_TTL
  ): Promise<CachedIntentResult> {
    // Check cache first
    const cached = await this.get(intent);
    if (cached) {
      return cached;
    }

    // Build key for deduplication
    const key = this.buildCacheKey(intent);

    return this.pendingFetches.run(key, async () => {
      const result = await fetcher();
      const fingerprint = this.getSourceFingerprint(intent.sources);

      const entry: CachedIntentResult = {
        ...result,
        sourceFingerprint: fingerprint,
        timestamp: Date.now(),
      };

      await this.cache.set(key, entry, ttl);
      return entry;
    });
  }

  /**
   * Clear all cached intents
   */
  async clear(): Promise<void> {
    await this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

// Shared instance for tool handlers
export const intentCache = new IntentCache();

