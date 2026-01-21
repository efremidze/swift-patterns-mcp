// src/tools/handlers/searchSwiftContent.ts

import type { ToolHandler } from '../types.js';
import { searchMultipleSources, getSourceNames } from '../../utils/source-registry.js';
import { formatSearchPatterns } from '../../utils/pattern-formatter.js';
import { createTextResponse } from '../../utils/response-helpers.js';
import { intentCache, type IntentKey, type CachedIntentResultWithPatterns } from '../../utils/intent-cache.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';

export const searchSwiftContentHandler: ToolHandler = async (args) => {
  const query = args?.query as string;
  const requireCode = args?.requireCode as boolean;

  if (!query) {
    return createTextResponse(`Missing required argument: query

Usage: search_swift_content({ query: "async await" })`);
  }

  // Build intent key for caching
  // This handler always uses 'all' sources and default minQuality of 0
  const intentKey: IntentKey = {
    tool: 'search_swift_content',
    query,
    minQuality: 0,
    sources: getSourceNames('all'),
    requireCode: requireCode || false,
  };

  // Try to get cached result
  const cached = await intentCache.get(intentKey);

  let filtered: BasePattern[];

  if (cached) {
    // Cache hit - use cached patterns
    const cachedWithPatterns = cached as CachedIntentResultWithPatterns;
    filtered = (cachedWithPatterns.patterns as BasePattern[]) || [];
  } else {
    // Cache miss - fetch from sources
    const results = await searchMultipleSources(query);

    // Filter by code if requested
    filtered = requireCode
      ? results.filter(r => r.hasCode)
      : results;

    // Cache the results
    if (filtered.length > 0) {
      await intentCache.set(intentKey, {
        patternIds: filtered.map(p => p.id),
        scores: Object.fromEntries(filtered.map(p => [p.id, p.relevanceScore])),
        totalCount: filtered.length,
        patterns: filtered,
      });
    }
  }

  if (filtered.length === 0) {
    return createTextResponse(`No results found for "${query}"${requireCode ? ' with code examples' : ''}.`);
  }

  // Format using shared utility
  const formatted = formatSearchPatterns(filtered, query, {
    maxResults: 10,
    includeCode: true,
    excerptLength: 200,
  });

  return createTextResponse(formatted);
};
