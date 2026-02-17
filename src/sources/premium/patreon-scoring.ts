// src/sources/premium/patreon-scoring.ts
// Pattern scoring and ranking logic for Patreon search

import type { PatreonPattern } from './patreon.js';
import {
  type QueryProfile,
  type OverlapScoredPattern,
  computeQueryOverlap,
  isStrongQueryOverlap,
  compareByOverlapThenScore,
  QUERY_OVERLAP_SCORE_CAP,
  QUERY_OVERLAP_RELEVANCE_MULTIPLIER,
} from '../../utils/query-analysis.js';
import { withYouTube } from '../../config/creators.js';

export function applyOverlapBoost(baseScore: number, overlapScore: number): number {
  const boost = Math.round(Math.min(overlapScore, QUERY_OVERLAP_SCORE_CAP) * QUERY_OVERLAP_RELEVANCE_MULTIPLIER);
  return Math.min(100, baseScore + boost);
}

export function selectCreatorsForQuery(query: string) {
  const creators = withYouTube();
  const q = query.toLowerCase();
  const matched = creators.filter(c =>
    q.includes(c.id.toLowerCase()) ||
    q.includes(c.name.toLowerCase())
  );
  return matched.length > 0 ? matched : creators;
}

export function rankPatternsForQuery(
  patterns: PatreonPattern[],
  profile: QueryProfile,
  toHaystack: (pattern: PatreonPattern) => string,
  options: { fallbackToOriginal: boolean }
): PatreonPattern[] {
  if (profile.weightedTokens.length === 0 || patterns.length === 0) {
    return patterns;
  }

  const scored = patterns.map<OverlapScoredPattern>(pattern => {
    const overlap = computeQueryOverlap(toHaystack(pattern).toLowerCase(), profile);
    return {
      pattern: {
        ...pattern,
        relevanceScore: applyOverlapBoost(pattern.relevanceScore, overlap.score),
      },
      overlap,
    };
  });

  const overlapped = scored
    .filter(({ overlap }) => isStrongQueryOverlap(overlap, profile))
    .sort(compareByOverlapThenScore)
    .map(({ pattern }) => pattern);

  if (overlapped.length === 0 && options.fallbackToOriginal) {
    return patterns;
  }

  return overlapped;
}

export function shouldReplaceByQuality(existing: PatreonPattern, candidate: PatreonPattern): boolean {
  return (
    candidate.relevanceScore > existing.relevanceScore ||
    (candidate.relevanceScore === existing.relevanceScore && candidate.hasCode && !existing.hasCode)
  );
}
