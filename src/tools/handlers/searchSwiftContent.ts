// src/tools/handlers/searchSwiftContent.ts

import type { ToolHandler } from '../types.js';
import { searchMultipleSources, getSourceNames, fetchAllPatterns, type FreeSourceName } from '../../utils/source-registry.js';
import { formatSearchPatterns, COMMON_FORMAT_OPTIONS, detectCodeIntent } from '../../utils/pattern-formatter.js';
import { createMarkdownResponse, createTextResponse } from '../../utils/response-helpers.js';
import type { IntentKey } from '../../utils/intent-cache.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import { SemanticRecallIndex, type SemanticRecallConfig } from '../../utils/semantic-recall.js';
import type SourceManager from '../../config/sources.js';
import { getMemvidMemory } from '../../utils/memvid-memory.js';
import logger from '../../utils/logger.js';
import { validateRequiredString, validateOptionalBoolean, isValidationError } from '../validation.js';
import { cachedSearch } from './cached-search.js';

// Module-level singleton for semantic recall index
let semanticIndex: SemanticRecallIndex | null = null;

function getSemanticIndex(config: SemanticRecallConfig): SemanticRecallIndex {
  if (!semanticIndex) {
    semanticIndex = new SemanticRecallIndex(config);
  }
  return semanticIndex;
}

interface SemanticRecallOptions {
  query: string;
  lexicalResults: BasePattern[];
  config: SemanticRecallConfig;
  sourceManager: SourceManager;
  requireCode: boolean;
}

const SEMANTIC_TIMEOUT_MS = 5_000;
const PATREON_UNIFIED_TIMEOUT_MS = 5_000;

/**
 * Attempt semantic recall with a timeout.
 * Returns empty array if semantic recall takes too long or fails.
 */
async function trySemanticRecall(options: SemanticRecallOptions): Promise<BasePattern[]> {
  return Promise.race([
    trySemanticRecallInner(options),
    new Promise<BasePattern[]>(resolve =>
      setTimeout(() => resolve([]), SEMANTIC_TIMEOUT_MS)
    ),
  ]);
}

/**
 * Attempt semantic recall to supplement lexical results.
 * Returns additional patterns not in lexicalResults, or empty array on failure.
 * Handles all errors internally - never throws.
 */
async function trySemanticRecallInner(options: SemanticRecallOptions): Promise<BasePattern[]> {
  const { query, lexicalResults, config, sourceManager, requireCode } = options;

  try {
    // Check if semantic recall should activate
    const maxScore = lexicalResults.length > 0
      ? Math.max(...lexicalResults.map(p => p.relevanceScore)) / 100
      : 0;

    const shouldActivate = lexicalResults.length === 0 || maxScore < config.minLexicalScore;
    if (!shouldActivate) return [];

    // Get/create index and fetch patterns from enabled sources
    const index = getSemanticIndex(config);
    const enabledSourceIds = sourceManager.getEnabledSources().map(s => s.id as FreeSourceName);
    const allPatterns = await fetchAllPatterns(enabledSourceIds);

    await index.index(allPatterns);

    // Search and filter
    const semanticResults = await index.search(query, 5);
    const existingIds = new Set(lexicalResults.map(p => p.id));

    return semanticResults.filter(p =>
      !existingIds.has(p.id) &&
      (!requireCode || p.hasCode) &&
      p.relevanceScore >= config.minRelevanceScore
    );
  } catch {
    // Semantic recall is best-effort; return empty on any failure
    return [];
  }
}

export const searchSwiftContentHandler: ToolHandler = async (args, context) => {
  const query = validateRequiredString(args, 'query', `Usage: search_swift_content({ query: "async await" })`);
  if (isValidationError(query)) return query;

  const requireCodeValidated = validateOptionalBoolean(args, 'requireCode');
  if (isValidationError(requireCodeValidated)) return requireCodeValidated;
  const requireCode = requireCodeValidated || false;

  const wantsCode = detectCodeIntent(args, query);

  const enabledSourceIds = context.sourceManager.getEnabledSources().map(s => s.id);
  const patreonEnabled = enabledSourceIds.includes('patreon') && !!context.patreonSource;
  const sourceManager = context.sourceManager;

  // Build intent key for caching
  const sourcesForCache = [
    ...getSourceNames('all'),
    ...(patreonEnabled ? ['patreon'] : []),
  ].sort();
  const intentKey: IntentKey = {
    tool: 'search_swift_content',
    query,
    minQuality: 0,
    sources: sourcesForCache,
    requireCode: requireCode || false,
  };

  const { results: finalResults } = await cachedSearch({
    intentKey,
    sourceManager,
    fetcher: async () => {
      // Lexical search across free sources
      const results = await searchMultipleSources(query);
      let filtered: BasePattern[] = requireCode
        ? results.filter(r => r.hasCode)
        : results;

      // Patreon unified search
      if (patreonEnabled && context.patreonSource) {
        try {
          const patreon = new context.patreonSource();
          const patreonResults = await Promise.race([
            patreon.searchPatterns(query, { mode: 'fast' }),
            new Promise<[]>(resolve => setTimeout(() => resolve([]), PATREON_UNIFIED_TIMEOUT_MS)),
          ]);
          const patreonFiltered = requireCode
            ? patreonResults.filter(r => r.hasCode)
            : patreonResults;

          if (patreonFiltered.length > 0) {
            const existingIds = new Set(filtered.map(p => p.id));
            const existingUrls = new Set(filtered.map(p => p.url));
            const dedupedPatreon = patreonFiltered.filter(p =>
              !existingIds.has(p.id) && !existingUrls.has(p.url)
            );
            filtered = [...filtered, ...dedupedPatreon];
          }
        } catch (error) {
          logger.warn({ err: error }, 'Patreon search failed in unified search');
        }
      }

      filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Semantic recall: supplement lexical results when enabled
      const semanticConfig = sourceManager.getSemanticRecallConfig();
      if (semanticConfig.enabled) {
        const semanticResults = await trySemanticRecall({
          query,
          lexicalResults: filtered,
          config: semanticConfig,
          sourceManager,
          requireCode: requireCode || false,
        });
        if (semanticResults.length > 0) {
          filtered = [...filtered, ...semanticResults]
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
        }
      }

      // Memvid recall: supplement with cross-session patterns
      const memvidConfig = sourceManager.getMemvidConfig();
      if (memvidConfig.enabled) {
        try {
          const memvidMemory = getMemvidMemory();
          const memvidResults = await memvidMemory.search(query, {
            k: 5,
            mode: memvidConfig.useEmbeddings ? 'sem' : 'auto',
          });

          if (memvidResults.length > 0) {
            const existingIds = new Set(filtered.map(p => p.id));
            const existingUrls = new Set(filtered.map(p => p.url));
            const newMemvidResults = memvidResults.filter(p =>
              !existingIds.has(p.id) &&
              !existingUrls.has(p.url) &&
              (!requireCode || p.hasCode)
            );
            if (newMemvidResults.length > 0) {
              logger.info({ count: newMemvidResults.length }, 'Added patterns from memvid persistent memory');
              filtered = [...filtered, ...newMemvidResults]
                .sort((a, b) => b.relevanceScore - a.relevanceScore);
            }
          }
        } catch (error) {
          logger.warn({ err: error }, 'Memvid memory operation failed');
        }
      }

      return filtered;
    },
  });

  if (finalResults.length === 0) {
    return createMarkdownResponse(
      `Search Results: "${query}"`,
      `No results found for "${query}"${requireCode ? ' with code examples' : ''}.`,
    );
  }

  // Format using shared utility
  const formatted = formatSearchPatterns(finalResults, query, {
    ...COMMON_FORMAT_OPTIONS,
    includeCode: wantsCode,
  });

  return createTextResponse(formatted);
};
