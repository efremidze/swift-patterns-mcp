// src/tools/handlers/searchSwiftContent.ts

import type { ToolHandler } from '../types.js';
import { searchMultipleSources, getSourceNames, getSources } from '../../utils/source-registry.js';
import { formatSearchPatterns } from '../../utils/pattern-formatter.js';
import { createTextResponse } from '../../utils/response-helpers.js';
import { intentCache, type IntentKey, type StorableCachedSearchResult } from '../../utils/intent-cache.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import { SemanticRecallIndex, type SemanticRecallConfig } from '../../utils/semantic-recall.js';
import SourceManager from '../../config/sources.js';

// Module-level singleton for semantic recall index
let semanticIndex: SemanticRecallIndex | null = null;

function getSemanticIndex(config: SemanticRecallConfig): SemanticRecallIndex {
  if (!semanticIndex) {
    semanticIndex = new SemanticRecallIndex(config);
  }
  return semanticIndex;
}

/**
 * Fetch all patterns from all sources for semantic indexing
 */
async function getAllPatternsForSemanticIndex(): Promise<BasePattern[]> {
  const sources = getSources('all');
  const results = await Promise.allSettled(
    sources.map(source => source.fetchPatterns())
  );
  return results
    .filter((r): r is PromiseFulfilledResult<BasePattern[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

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
    filtered = (cached.patterns as BasePattern[]) || [];
  } else {
    // Cache miss - fetch from sources
    const results = await searchMultipleSources(query);

    // Filter by code if requested
    filtered = requireCode
      ? results.filter(r => r.hasCode)
      : results;

    // Cache the results
    if (filtered.length > 0) {
      const cacheData: StorableCachedSearchResult = {
        patternIds: filtered.map(p => p.id),
        scores: Object.fromEntries(filtered.map(p => [p.id, p.relevanceScore])),
        totalCount: filtered.length,
        patterns: filtered,
      };
      await intentCache.set(intentKey, cacheData);
    }
  }

  // Get semantic recall config
  const sourceManager = new SourceManager();
  const semanticConfig = sourceManager.getSemanticRecallConfig();

  let finalResults = filtered;

  // Semantic recall fallback: only if enabled AND lexical results are weak
  if (semanticConfig.enabled && filtered.length > 0) {
    // Calculate max lexical score
    const maxScore = Math.max(...filtered.map(p => p.relevanceScore));

    // Normalize to 0-1 scale (relevanceScore is 0-100)
    const normalizedMaxScore = maxScore / 100;

    if (normalizedMaxScore < semanticConfig.minLexicalScore) {
      // Lexical results are weak - try semantic recall
      const index = getSemanticIndex(semanticConfig);

      // Index all high-quality patterns (this is cached, so cheap after first call)
      const allPatterns = await getAllPatternsForSemanticIndex();
      await index.index(allPatterns);

      // Search semantically
      const semanticResults = await index.search(query, 5);

      // Merge conservatively: semantic results as supplement, not replacement
      // Add semantic results not already in filtered
      const existingIds = new Set(filtered.map(p => p.id));
      const newSemanticResults = semanticResults.filter(p => !existingIds.has(p.id));

      // Append semantic results after lexical results
      finalResults = [...filtered, ...newSemanticResults];

      // Re-apply relevance filter and re-sort
      finalResults = finalResults
        .filter(p => p.relevanceScore >= semanticConfig.minRelevanceScore)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
  }

  if (finalResults.length === 0) {
    return createTextResponse(`No results found for "${query}"${requireCode ? ' with code examples' : ''}.`);
  }

  // Format using shared utility
  const formatted = formatSearchPatterns(finalResults, query, {
    maxResults: 10,
    includeCode: true,
    excerptLength: 200,
  });

  return createTextResponse(formatted);
};
