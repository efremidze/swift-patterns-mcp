// src/tools/handlers/getSwiftPattern.ts

import type { ToolHandler } from '../types.js';
import { FREE_SOURCE_NAMES, getSourceNames, searchMultipleSources, type FreeSourceName } from '../../utils/source-registry.js';
import { formatTopicPatterns, COMMON_FORMAT_OPTIONS, detectCodeIntent } from '../../utils/pattern-formatter.js';
import { createTextResponse } from '../../utils/response-helpers.js';
import { intentCache, type IntentKey, type StorableCachedSearchResult } from '../../utils/intent-cache.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import { getMemvidMemory } from '../../utils/memvid-memory.js';
import SourceManager from '../../config/sources.js';
import logger from '../../utils/logger.js';

export const getSwiftPatternHandler: ToolHandler = async (args, context) => {
  const topic = args?.topic as string;

  if (!topic) {
    return createTextResponse(`Missing required argument: topic

Usage: get_swift_pattern({ topic: "swiftui" })

Example topics:
- swiftui, concurrency, testing, networking
- performance, architecture, protocols
- async-await, combine, coredata`);
  }

  const source = (args?.source as string) || "all";
  const minQuality = (args?.minQuality as number) || 65;
  const wantsCode = detectCodeIntent(args, topic);

  if (source !== 'all' && !FREE_SOURCE_NAMES.includes(source as FreeSourceName)) {
    return createTextResponse(`"${source}" isn't a supported free source for get_swift_pattern.

Available free sources: ${FREE_SOURCE_NAMES.join(', ')}

For Patreon creators (e.g. Kavsoft), use:
get_patreon_patterns({ topic: "${topic}" })`);
  }

  // Build intent key for caching
  const intentKey: IntentKey = {
    tool: 'get_swift_pattern',
    query: topic,
    minQuality,
    sources: getSourceNames(source as FreeSourceName | 'all'),
  };

  // Try to get cached result
  const cached = await intentCache.get(intentKey);

  let results: BasePattern[];
  let wasCacheHit = false;

  if (cached) {
    // Cache hit - use cached patterns
    results = (cached.patterns as BasePattern[]) || [];
    wasCacheHit = true;
  } else {
    // Cache miss - fetch from sources using centralized search
    const allResults = await searchMultipleSources(topic, source as FreeSourceName | 'all');

    // Filter by quality
    results = allResults
      .filter(p => p.relevanceScore >= minQuality);

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Cache the results (patterns are already metadata, not full articles)
    if (results.length > 0) {
      const cacheData: StorableCachedSearchResult = {
        patternIds: results.map(p => p.id),
        scores: Object.fromEntries(results.map(p => [p.id, p.relevanceScore])),
        totalCount: results.length,
        patterns: results,
      };
      await intentCache.set(intentKey, cacheData);
    }
  }

  // Memvid persistent memory integration (when not from cache)
  if (!wasCacheHit) {
    const sourceManager = new SourceManager();
    const memvidConfig = sourceManager.getMemvidConfig();

    if (memvidConfig.enabled && memvidConfig.autoStore && results.length > 0) {
      try {
        const memvidMemory = getMemvidMemory();
        
        // Store patterns asynchronously for future cross-session recall
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
  }

  if (results.length === 0) {
    return createTextResponse(`No patterns found for "${topic}" with quality ≥ ${minQuality}.

Try:
- Broader search terms
- Lower minQuality
- Different topic

Available sources: Swift by Sundell, Antoine van der Lee, Nil Coalescing, Point-Free
${context.sourceManager.isSourceConfigured('patreon') ? '\n💡 Enable Patreon for more premium content!' : ''}`);
  }

  // Format using shared utility
  const formatted = formatTopicPatterns(results, topic, {
    ...COMMON_FORMAT_OPTIONS,
    includeCode: wantsCode,
  });

  return createTextResponse(formatted);
};
