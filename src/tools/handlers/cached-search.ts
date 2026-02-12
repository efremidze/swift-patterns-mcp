// src/tools/handlers/cached-search.ts
// Shared intent-cache + memvid integration for search handlers

import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import { intentCache, type IntentKey, type StorableCachedSearchResult } from '../../utils/intent-cache.js';
import { getMemvidMemory } from '../../utils/memvid-memory.js';
import type SourceManager from '../../config/sources.js';
import logger from '../../utils/logger.js';

interface CachedSearchResult {
  results: BasePattern[];
  wasCacheHit: boolean;
}

interface CachedSearchOptions {
  intentKey: IntentKey;
  fetcher: () => Promise<BasePattern[]>;
  sourceManager: SourceManager;
}

/**
 * Run a search with intent-cache and memvid integration.
 *
 * - Checks the intent cache first
 * - On miss, calls `fetcher`, caches the results, and fires memvid auto-store
 * - Returns results + cache-hit flag
 */
export async function cachedSearch(options: CachedSearchOptions): Promise<CachedSearchResult> {
  const { intentKey, fetcher, sourceManager } = options;

  const cached = await intentCache.get(intentKey);

  if (cached) {
    return {
      results: (cached.patterns as BasePattern[]) || [],
      wasCacheHit: true,
    };
  }

  const results = await fetcher();

  // Cache the results
  if (results.length > 0) {
    const cacheData: StorableCachedSearchResult = {
      patternIds: results.map(p => p.id),
      scores: Object.fromEntries(results.map(p => [p.id, p.relevanceScore])),
      totalCount: results.length,
      patterns: results,
    };
    await intentCache.set(intentKey, cacheData);
  }

  // Memvid auto-store (fire-and-forget)
  autoStoreInMemvid(results, sourceManager);

  return { results, wasCacheHit: false };
}

/**
 * Fire-and-forget memvid storage when enabled.
 */
function autoStoreInMemvid(results: BasePattern[], sourceManager: SourceManager): void {
  if (results.length === 0) return;

  const memvidConfig = sourceManager.getMemvidConfig();
  if (!memvidConfig.enabled || !memvidConfig.autoStore) return;

  try {
    const memvidMemory = getMemvidMemory();
    memvidMemory.storePatterns(results, {
      enableEmbedding: memvidConfig.useEmbeddings,
      embeddingModel: memvidConfig.embeddingModel,
    }).catch(err => {
      logger.warn({ err }, 'Failed to store patterns in memvid');
    });
  } catch (error) {
    logger.warn({ err: error }, 'Memvid memory operation failed');
  }
}
