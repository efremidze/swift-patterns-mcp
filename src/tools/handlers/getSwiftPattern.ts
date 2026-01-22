// src/tools/handlers/getSwiftPattern.ts

import type { ToolHandler } from '../types.js';
import { getSourceNames, searchMultipleSources, type FreeSourceName } from '../../utils/source-registry.js';
import { formatTopicPatterns, COMMON_FORMAT_OPTIONS, detectCodeIntent } from '../../utils/pattern-formatter.js';
import { createTextResponse } from '../../utils/response-helpers.js';
import { intentCache, type IntentKey, type StorableCachedSearchResult } from '../../utils/intent-cache.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';

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

  if (cached) {
    // Cache hit - use cached patterns
    results = (cached.patterns as BasePattern[]) || [];
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
