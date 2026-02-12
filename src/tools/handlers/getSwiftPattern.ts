// src/tools/handlers/getSwiftPattern.ts

import type { ToolHandler } from '../types.js';
import { FREE_SOURCE_NAMES, getSourceNames, searchMultipleSources, type FreeSourceName } from '../../utils/source-registry.js';
import { formatTopicPatterns, COMMON_FORMAT_OPTIONS, detectCodeIntent } from '../../utils/pattern-formatter.js';
import { createMarkdownResponse, createTextResponse } from '../../utils/response-helpers.js';
import type { IntentKey } from '../../utils/intent-cache.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import { CREATORS } from '../../config/creators.js';
import { validateRequiredString, validateOptionalString, validateOptionalNumber, isValidationError } from '../validation.js';
import { cachedSearch } from './cached-search.js';
import {
  buildQueryProfile,
  compareByOverlapThenScore,
  computeQueryOverlap,
  isStrongQueryOverlap,
  QUERY_OVERLAP_RELEVANCE_MULTIPLIER,
  QUERY_OVERLAP_SCORE_CAP,
  type QueryProfile,
} from '../../utils/query-analysis.js';

const HYBRID_VARIANT_LIMIT = 4;
const HYBRID_CODE_BOOST = 1;
const HYBRID_EXACT_QUERY_BOOST = 4.5;
const HYBRID_MIN_TOKENS_FOR_STRICT_GATE = 3;
const HYBRID_MIN_MATCHED_TOKENS_WITHOUT_PHRASE = 3;

interface RankedPattern {
  pattern: BasePattern;
  overlap: { score: number; matchedTokens: number };
  rankScore: number;
}

function mergeAndRankPatterns(
  topic: string,
  minQuality: number,
  strictResults: BasePattern[],
  broadResults: BasePattern[],
): BasePattern[] {
  const profile = buildQueryProfile(topic);
  const rankedById = new Map<string, RankedPattern>();
  const normalizedTopic = topic.toLowerCase().trim().replace(/\s+/g, ' ');
  const topicParts = normalizedTopic.split(' ').filter(Boolean);
  const significantBigrams = topicParts
    .slice(0, -1)
    .map((part, index) => `${part} ${topicParts[index + 1]}`)
    .filter(phrase => phrase.length > 8);
  const applyStrongOverlapGate = profile.weightedTokens.length >= HYBRID_MIN_TOKENS_FOR_STRICT_GATE;

  const rankPattern = (pattern: BasePattern): RankedPattern | null => {
    const haystack = `${pattern.title} ${pattern.excerpt} ${pattern.content} ${pattern.topics.join(' ')}`.toLowerCase();
    const overlap = computeQueryOverlap(haystack, profile);
    const strongOverlap = isStrongQueryOverlap(overlap, profile);
    const hasBigramMatch = significantBigrams.length > 0
      ? significantBigrams.some(phrase => haystack.includes(phrase))
      : false;

    if (applyStrongOverlapGate && !strongOverlap) {
      return null;
    }
    if (
      applyStrongOverlapGate &&
      significantBigrams.length > 0 &&
      !hasBigramMatch &&
      overlap.matchedTokens < HYBRID_MIN_MATCHED_TOKENS_WITHOUT_PHRASE
    ) {
      return null;
    }

    const overlapBoost = Math.min(overlap.score, QUERY_OVERLAP_SCORE_CAP) * QUERY_OVERLAP_RELEVANCE_MULTIPLIER;
    const exactQueryBoost = normalizedTopic.length > 0 && haystack.includes(normalizedTopic)
      ? HYBRID_EXACT_QUERY_BOOST
      : 0;
    const codeBoost = pattern.hasCode ? HYBRID_CODE_BOOST : 0;

    return {
      pattern,
      overlap,
      rankScore: pattern.relevanceScore + overlapBoost + exactQueryBoost + codeBoost,
    };
  };

  for (const pattern of [...strictResults, ...broadResults]) {
    if (pattern.relevanceScore < minQuality) continue;
    const ranked = rankPattern(pattern);
    if (!ranked) continue;

    const existing = rankedById.get(pattern.id);
    if (!existing || ranked.rankScore > existing.rankScore) {
      rankedById.set(pattern.id, ranked);
    }
  }

  return Array.from(rankedById.values())
    .sort((a, b) => {
      const byRank = b.rankScore - a.rankScore;
      if (byRank !== 0) return byRank;
      return compareByOverlapThenScore(a, b);
    })
    .map(r => r.pattern);
}

async function runBroadSearch(topic: string, source: FreeSourceName | 'all', profile: QueryProfile): Promise<BasePattern[]> {
  const variants = profile.compiledQueries.slice(0, HYBRID_VARIANT_LIMIT);
  if (variants.length === 0) return [];

  const all = await Promise.all(
    variants.map(query => searchMultipleSources(query, source))
  );

  const deduped = new Map<string, BasePattern>();
  for (const resultSet of all) {
    for (const pattern of resultSet) {
      const existing = deduped.get(pattern.id);
      if (!existing || pattern.relevanceScore > existing.relevanceScore) {
        deduped.set(pattern.id, pattern);
      }
    }
  }

  return Array.from(deduped.values());
}

export const getSwiftPatternHandler: ToolHandler = async (args, context) => {
  const topic = validateRequiredString(args, 'topic', `Usage: get_swift_pattern({ topic: "swiftui" })

Example topics:
- swiftui, concurrency, testing, networking
- performance, architecture, protocols
- async-await, combine, coredata`);
  if (isValidationError(topic)) return topic;

  const sourceValidated = validateOptionalString(args, 'source');
  if (isValidationError(sourceValidated)) return sourceValidated;
  const source = sourceValidated || "all";

  const minQualityValidated = validateOptionalNumber(args, 'minQuality');
  if (isValidationError(minQualityValidated)) return minQualityValidated;
  const minQuality = minQualityValidated || 65;
  const wantsCode = detectCodeIntent(args, topic);

  if (source !== 'all' && !FREE_SOURCE_NAMES.includes(source as FreeSourceName)) {
    const patreonCreator = CREATORS.find(c => c.id.toLowerCase() === source.toLowerCase());

    if (patreonCreator) {
      return createTextResponse(`"${patreonCreator.name}" is a Patreon creator, not a free source.

Use get_patreon_patterns to search Patreon content:
get_patreon_patterns({ topic: "${topic}" })`);
    }

    return createTextResponse(`"${source}" isn't a recognized source.

Available free sources: ${FREE_SOURCE_NAMES.join(', ')}
Patreon creators: ${CREATORS.map(c => c.id).join(', ')}

For free sources, use:
get_swift_pattern({ topic: "${topic}", source: "sundell" })

For Patreon creators, use:
get_patreon_patterns({ topic: "${topic}" })`);
  }

  // Build intent key for caching
  const intentKey: IntentKey = {
    tool: 'get_swift_pattern_hybrid_v3',
    query: topic,
    minQuality,
    sources: getSourceNames(source as FreeSourceName | 'all'),
  };

  const { results } = await cachedSearch({
    intentKey,
    sourceManager: context.sourceManager,
    fetcher: async () => {
      const searchSource = source as FreeSourceName | 'all';
      const profile = buildQueryProfile(topic);
      const [strictResults, broadResults] = await Promise.all([
        searchMultipleSources(topic, searchSource),
        runBroadSearch(topic, searchSource, profile),
      ]);
      return mergeAndRankPatterns(topic, minQuality, strictResults, broadResults);
    },
  });

  if (results.length === 0) {
    return createMarkdownResponse(
      `Swift Patterns: ${topic}`,
      `No patterns found for "${topic}" with quality ≥ ${minQuality}.`,
      `Try:
- Broader search terms
- Lower minQuality
- Different topic
- search_swift_content({ query: "${topic}" }) for broader discovery`,
      'Available sources: Swift by Sundell, Antoine van der Lee, Nil Coalescing, Point-Free',
      context.sourceManager.isSourceConfigured('patreon')
        ? `💡 For creator-specific/tutorial content, use get_patreon_patterns({ topic: "${topic}" }).`
        : undefined,
    );
  }

  // Format using shared utility
  const formatted = formatTopicPatterns(results, topic, {
    ...COMMON_FORMAT_OPTIONS,
    includeCode: wantsCode,
  });

  return createTextResponse(formatted);
};
