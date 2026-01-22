// src/tools/handlers/searchSwiftContent.ts

import type { ToolHandler } from '../types.js';
import { searchMultipleSources, getSourceNames, getSource, type FreeSourceName } from '../../utils/source-registry.js';
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
 * Fetch patterns from enabled sources for semantic indexing
 */
async function getAllPatternsForSemanticIndex(sourceManager: SourceManager): Promise<BasePattern[]> {
  // Get only user-enabled sources
  const enabledSources = sourceManager.getEnabledSources();
  const sourceIds = enabledSources.map(s => s.id as FreeSourceName);

  // Get source instances for enabled sources
  const sources = sourceIds.map(id => getSource(id));

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

  // Track whether this was a cache hit (to avoid re-caching)
  let wasCacheHit = false;

  if (cached) {
    // Cache hit - use cached patterns (includes any semantic results from prior search)
    filtered = (cached.patterns as BasePattern[]) || [];
    wasCacheHit = true;
  } else {
    // Cache miss - fetch from sources
    const results = await searchMultipleSources(query);

    // Filter by code if requested
    filtered = requireCode
      ? results.filter(r => r.hasCode)
      : results;
  }

  // Get semantic recall config
  const sourceManager = new SourceManager();
  const semanticConfig = sourceManager.getSemanticRecallConfig();

  let finalResults = filtered;

  // Semantic recall fallback: activates when enabled AND not a cache hit AND either:
  // (1) No lexical results at all, OR
  // (2) Lexical results are weak (max score below threshold)
  // Cache hits already include semantic results from the original search
  if (!wasCacheHit && semanticConfig.enabled) {
    // Determine if semantic recall should activate
    const noLexicalResults = filtered.length === 0;
    const maxScore = filtered.length > 0
      ? Math.max(...filtered.map(p => p.relevanceScore))
      : 0;
    const normalizedMaxScore = maxScore / 100;
    const weakLexicalResults = filtered.length > 0 && normalizedMaxScore < semanticConfig.minLexicalScore;

    if (noLexicalResults || weakLexicalResults) {
      // Lexical results are absent or weak - try semantic recall
      // Wrapped in try-catch: semantic recall is a fallback, failures shouldn't break the handler
      try {
        const index = getSemanticIndex(semanticConfig);

        // Index all high-quality patterns from enabled sources (cached, so cheap after first call)
        const allPatterns = await getAllPatternsForSemanticIndex(sourceManager);
        await index.index(allPatterns);

        // Search semantically
        const semanticResultsRaw = await index.search(query, 5);
        const semanticResults = requireCode
          ? semanticResultsRaw.filter(p => p.hasCode)
          : semanticResultsRaw;

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
      } catch {
        // Semantic recall failed - fall back to lexical results only
        // finalResults already equals filtered, so no action needed
      }
    }
  }

  // Cache final results (after semantic merge) if this was a cache miss
  if (!wasCacheHit && finalResults.length > 0) {
    const cacheData: StorableCachedSearchResult = {
      patternIds: finalResults.map(p => p.id),
      scores: Object.fromEntries(finalResults.map(p => [p.id, p.relevanceScore])),
      totalCount: finalResults.length,
      patterns: finalResults,
    };
    await intentCache.set(intentKey, cacheData);
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
