// src/utils/intent-cache.ts
// Intent-aware response caching for MCP tool handlers

import { createHash } from 'crypto';
import { FileCache } from './cache.js';

// 12 hours in seconds (longer than RSS cache, shorter than article cache)
const DEFAULT_INTENT_TTL = 43200;
const DEFAULT_MAX_MEMORY_ENTRIES = 200;

// Stopwords for query normalization (subset of search.ts STOPWORDS)
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
  'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
  'i', 'my', 'me', 'he', 'she', 'him', 'her', 'his', 'who', 'what', 'which',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'same',
  'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there'
]);

// Swift-specific terms that should be preserved during normalization
const PRESERVE_TERMS = new Set([
  'swift', 'swiftui', 'uikit', 'combine', 'async', 'await', 'actor',
  'struct', 'class', 'enum', 'protocol', 'extension', 'func', 'var', 'let',
  'mvvm', 'viper', 'mvc', 'tca', 'xctest', 'xcode', 'ios', 'macos',
  'watchos', 'tvos', 'ipados', 'appkit', 'foundation', 'coredata',
  'cloudkit', 'urlsession', 'codable', 'observable', 'published',
  'stateobject', 'observedobject', 'environmentobject', 'binding', 'state'
]);

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
 * Cached result metadata (not full patterns)
 */
export interface CachedIntentResult {
  patternIds: string[];           // Pattern IDs in order
  scores: Record<string, number>; // ID -> relevance score mapping
  sourceFingerprint: string;      // Hash of sources at cache time
  timestamp: number;              // Cache creation time
  totalCount: number;             // Total patterns before any limits
}

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
  private pendingFetches: Map<string, Promise<unknown>> = new Map();

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
    const tokens = query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, ' ')  // Keep hyphens for technical terms
      .replace(/\s+/g, ' ')       // Collapse whitespace
      .split(' ')
      .filter(token => token.length > 1);

    const processed: string[] = [];

    for (const token of tokens) {
      // Check if full token is preserved
      if (PRESERVE_TERMS.has(token)) {
        processed.push(token);
        continue;
      }

      // Split hyphenated terms and process parts
      const parts = token.split('-');
      for (const part of parts) {
        if (part.length <= 1) continue;
        if (STOPWORDS.has(part)) continue;

        // Keep preserved terms, include others
        processed.push(part);
      }
    }

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
   */
  async set(
    intent: IntentKey,
    result: Omit<CachedIntentResult, 'sourceFingerprint' | 'timestamp'>,
    ttl: number = DEFAULT_INTENT_TTL
  ): Promise<void> {
    const key = this.buildCacheKey(intent);
    const fingerprint = this.getSourceFingerprint(intent.sources);

    const entry: CachedIntentResult = {
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
    fetcher: () => Promise<Omit<CachedIntentResult, 'sourceFingerprint' | 'timestamp'>>,
    ttl: number = DEFAULT_INTENT_TTL
  ): Promise<CachedIntentResult> {
    // Check cache first
    const cached = await this.get(intent);
    if (cached) {
      return cached;
    }

    // Build key for deduplication
    const key = this.buildCacheKey(intent);

    // Check if fetch already in progress (stampede prevention)
    const pending = this.pendingFetches.get(key);
    if (pending) {
      return pending as Promise<CachedIntentResult>;
    }

    // Start fetch and track it
    const fetchPromise = (async () => {
      try {
        const result = await fetcher();
        const fingerprint = this.getSourceFingerprint(intent.sources);

        const entry: CachedIntentResult = {
          ...result,
          sourceFingerprint: fingerprint,
          timestamp: Date.now(),
        };

        await this.cache.set(key, entry, ttl);
        return entry;
      } finally {
        this.pendingFetches.delete(key);
      }
    })();

    this.pendingFetches.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Clear all cached intents
   */
  clear(): void {
    this.cache.clear();
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

export default IntentCache;
