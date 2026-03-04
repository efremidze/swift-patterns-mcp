// src/tools/handlers/searchSwiftContent.ts

import type { ToolHandler } from '../types.js';
import type { PatreonSourceInstance } from '../types.js';
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

interface SemanticRecallIndexLike {
  index(patterns: BasePattern[]): Promise<void>;
  search(query: string, limit: number): Promise<BasePattern[]>;
}

interface MemvidMemoryLike {
  search(
    query: string,
    options: { k: number; mode: 'auto' | 'sem' }
  ): Promise<BasePattern[]>;
}

interface CachedSearchLike {
  (options: {
    intentKey: IntentKey;
    fetcher: () => Promise<BasePattern[]>;
    sourceManager: SourceManager;
  }): Promise<{ results: BasePattern[]; wasCacheHit: boolean }>;
}

export interface SearchSwiftContentDependencies {
  searchMultipleSources: typeof searchMultipleSources;
  getSourceNames: typeof getSourceNames;
  fetchAllPatterns: typeof fetchAllPatterns;
  cachedSearch: CachedSearchLike;
  createSemanticIndex: (config: SemanticRecallConfig) => SemanticRecallIndexLike;
  getMemvidMemory: () => MemvidMemoryLike;
  formatSearchPatterns: typeof formatSearchPatterns;
  detectCodeIntent: typeof detectCodeIntent;
  createMarkdownResponse: typeof createMarkdownResponse;
  createTextResponse: typeof createTextResponse;
  logger: Pick<typeof logger, 'info' | 'warn'>;
  semanticTimeoutMs: number;
  patreonUnifiedTimeoutMs: number;
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

/** Sort comparator: descending by relevanceScore */
function byRelevanceDesc(a: BasePattern, b: BasePattern): number {
  return b.relevanceScore - a.relevanceScore;
}

/** Filter out patterns already present in `existing` by id or url */
function dedup(candidates: BasePattern[], existing: BasePattern[]): BasePattern[] {
  const ids = new Set(existing.map(p => p.id));
  const urls = new Set(existing.map(p => p.url));
  return candidates.filter(p => !ids.has(p.id) && !urls.has(p.url));
}

function createSemanticIndexFactory(): (config: SemanticRecallConfig) => SemanticRecallIndex {
  let semanticIndex: SemanticRecallIndex | null = null;

  return (config: SemanticRecallConfig): SemanticRecallIndex => {
    if (!semanticIndex) {
      semanticIndex = new SemanticRecallIndex(config);
    }
    return semanticIndex;
  };
}

function createDefaultDependencies(): SearchSwiftContentDependencies {
  return {
    searchMultipleSources,
    getSourceNames,
    fetchAllPatterns,
    cachedSearch,
    createSemanticIndex: createSemanticIndexFactory(),
    getMemvidMemory,
    formatSearchPatterns,
    detectCodeIntent,
    createMarkdownResponse,
    createTextResponse,
    logger,
    semanticTimeoutMs: SEMANTIC_TIMEOUT_MS,
    patreonUnifiedTimeoutMs: PATREON_UNIFIED_TIMEOUT_MS,
  };
}

export function createSearchSwiftContentHandler(
  overrides: Partial<SearchSwiftContentDependencies> = {}
): ToolHandler {
  const deps = {
    ...createDefaultDependencies(),
    ...overrides,
  };

  async function trySemanticRecall(options: SemanticRecallOptions): Promise<BasePattern[]> {
    return Promise.race([
      trySemanticRecallInner(options),
      new Promise<BasePattern[]>(resolve =>
        setTimeout(() => resolve([]), deps.semanticTimeoutMs)
      ),
    ]);
  }

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
      const index = deps.createSemanticIndex(config);
      const enabledSourceIds = sourceManager.getEnabledSources().map(s => s.id as FreeSourceName);
      const allPatterns = await deps.fetchAllPatterns(enabledSourceIds);

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

  return async (args, context) => {
    const query = validateRequiredString(args, 'query', `Usage: search_swift_content({ query: "async await" })`);
    if (isValidationError(query)) return query;

    const requireCodeValidated = validateOptionalBoolean(args, 'requireCode');
    if (isValidationError(requireCodeValidated)) return requireCodeValidated;
    const requireCode = !!requireCodeValidated;

    const wantsCode = deps.detectCodeIntent(args, query);

    const enabledSourceIds = context.sourceManager.getEnabledSources().map(s => s.id);
    const patreonEnabled = enabledSourceIds.includes('patreon') && !!context.patreonSource;

    // Build intent key for caching
    const sourcesForCache = [
      ...deps.getSourceNames('all'),
      ...(patreonEnabled ? ['patreon'] : []),
    ].sort();
    const intentKey: IntentKey = {
      tool: 'search_swift_content',
      query,
      minQuality: 0,
      sources: sourcesForCache,
      requireCode,
    };

    const { results: finalResults } = await deps.cachedSearch({
      intentKey,
      sourceManager: context.sourceManager,
      fetcher: async () => {
        // Lexical search across free sources
        const results = await deps.searchMultipleSources(query);
        let filtered: BasePattern[] = requireCode
          ? results.filter(r => r.hasCode)
          : results;

        // Patreon unified search
        if (patreonEnabled && context.patreonSource) {
          try {
            const patreon = new context.patreonSource() as PatreonSourceInstance;
            const patreonResults = await Promise.race([
              patreon.searchPatterns(query, { mode: 'fast' }),
              new Promise<[]>(resolve => setTimeout(() => resolve([]), deps.patreonUnifiedTimeoutMs)),
            ]);
            const patreonFiltered = requireCode
              ? patreonResults.filter(r => r.hasCode)
              : patreonResults;

            const dedupedPatreon = dedup(patreonFiltered, filtered);
            if (dedupedPatreon.length > 0) {
              filtered = [...filtered, ...dedupedPatreon];
            }
          } catch (error) {
            deps.logger.warn({ err: error }, 'Patreon search failed in unified search');
          }
        }

        filtered.sort(byRelevanceDesc);

        // Semantic recall: supplement lexical results when enabled
        const semanticConfig = context.sourceManager.getSemanticRecallConfig();
        if (semanticConfig.enabled) {
          const semanticResults = await trySemanticRecall({
            query,
            lexicalResults: filtered,
            config: semanticConfig,
            sourceManager: context.sourceManager,
            requireCode,
          });
          if (semanticResults.length > 0) {
            filtered = [...filtered, ...semanticResults]
              .sort(byRelevanceDesc);
          }
        }

        // Memvid recall: supplement with cross-session patterns
        const memvidConfig = context.sourceManager.getMemvidConfig();
        if (memvidConfig.enabled) {
          try {
            const memvidMemory = deps.getMemvidMemory();
            const memvidResults = await memvidMemory.search(query, {
              k: 5,
              mode: memvidConfig.useEmbeddings ? 'sem' : 'auto',
            });

            const newMemvidResults = dedup(
              requireCode ? memvidResults.filter(p => p.hasCode) : memvidResults,
              filtered,
            );
            if (newMemvidResults.length > 0) {
              deps.logger.info({ count: newMemvidResults.length }, 'Added patterns from memvid persistent memory');
              filtered = [...filtered, ...newMemvidResults]
                .sort(byRelevanceDesc);
            }
          } catch (error) {
            deps.logger.warn({ err: error }, 'Memvid memory operation failed');
          }
        }

        return filtered;
      },
    });

    if (finalResults.length === 0) {
      return deps.createMarkdownResponse(
        `Search Results: "${query}"`,
        `No results found for "${query}"${requireCode ? ' with code examples' : ''}.`,
      );
    }

    // Format using shared utility
    const formatted = deps.formatSearchPatterns(finalResults, query, {
      ...COMMON_FORMAT_OPTIONS,
      includeCode: wantsCode,
    });

    return deps.createTextResponse(formatted);
  };
}

export const searchSwiftContentHandler: ToolHandler = createSearchSwiftContentHandler();
