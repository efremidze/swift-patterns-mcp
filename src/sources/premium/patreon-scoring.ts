// src/sources/premium/patreon-scoring.ts
// Pattern scoring and ranking logic for Patreon search

import type { PatreonPattern } from './patreon.js';
import {
  type QueryProfile,
  type OverlapScoredPattern,
  computeQueryOverlap,
  isStrongQueryOverlap,
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
    .sort(compareByOverlapThenScoreWithRecency)
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

function parsePublishedTimestamp(iso: string | undefined): number {
  if (!iso) return 0;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : 0;
}

function recencyBoost(pattern: PatreonPattern, nowMs = Date.now()): number {
  const published = parsePublishedTimestamp(pattern.publishDate);
  if (published <= 0) return 0;

  const ageDays = (nowMs - published) / (24 * 60 * 60 * 1000);
  if (ageDays <= 14) return 8;
  if (ageDays <= 30) return 6;
  if (ageDays <= 90) return 4;
  if (ageDays <= 180) return 2;
  if (ageDays <= 365) return 1;
  return 0;
}

function boostedScore(pattern: PatreonPattern): number {
  return pattern.relevanceScore + recencyBoost(pattern);
}

function compareByOverlapThenScoreWithRecency(a: OverlapScoredPattern, b: OverlapScoredPattern): number {
  if (b.overlap.score !== a.overlap.score) {
    return b.overlap.score - a.overlap.score;
  }

  const boostedDiff = boostedScore(b.pattern) - boostedScore(a.pattern);
  if (boostedDiff !== 0) {
    return boostedDiff;
  }

  if (b.pattern.relevanceScore !== a.pattern.relevanceScore) {
    return b.pattern.relevanceScore - a.pattern.relevanceScore;
  }

  return parsePublishedTimestamp(b.pattern.publishDate) - parsePublishedTimestamp(a.pattern.publishDate);
}

export function sortPatternsByScoreThenRecency(patterns: PatreonPattern[]): PatreonPattern[] {
  return [...patterns].sort((a, b) => {
    const boostedDiff = boostedScore(b) - boostedScore(a);
    if (boostedDiff !== 0) return boostedDiff;

    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }

    return parsePublishedTimestamp(b.publishDate) - parsePublishedTimestamp(a.publishDate);
  });
}
