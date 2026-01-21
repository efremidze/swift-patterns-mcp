// src/tools/handlers/getSwiftPattern.ts

import type { ToolHandler } from '../types.js';
import { getSources, getSourceNames, type FreeSourceName } from '../../utils/source-registry.js';
import { formatTopicPatterns } from '../../utils/pattern-formatter.js';
import { createTextResponse } from '../../utils/response-helpers.js';
import { intentCache, type IntentKey, type CachedIntentResultWithPatterns } from '../../utils/intent-cache.js';
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
  const minQuality = (args?.minQuality as number) || 60;

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
    const cachedWithPatterns = cached as CachedIntentResultWithPatterns;
    results = (cachedWithPatterns.patterns as BasePattern[]) || [];
  } else {
    // Cache miss - fetch from sources
    const sources = getSources(source as FreeSourceName | 'all');

    // Search all requested sources in parallel
    const allResults = await Promise.all(
      sources.map(s => s.searchPatterns(topic))
    );

    // Filter by quality and flatten
    results = allResults
      .flat()
      .filter(p => p.relevanceScore >= minQuality);

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Cache the results (patterns are already metadata, not full articles)
    if (results.length > 0) {
      await intentCache.set(intentKey, {
        patternIds: results.map(p => p.id),
        scores: Object.fromEntries(results.map(p => [p.id, p.relevanceScore])),
        totalCount: results.length,
        patterns: results,
      });
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
    maxResults: 10,
    includeQuality: true,
    includeTopics: true,
    includeCode: true,
    excerptLength: 300,
  });

  return createTextResponse(formatted);
};
