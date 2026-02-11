// src/utils/query-analysis.ts
// Query profiling and overlap scoring for pattern search

import { normalizeTokens } from './search-terms.js';

export const MAX_QUERY_VARIANTS = 4;
export const PATREON_DEFAULT_QUERY = 'swiftui';
export const QUERY_OVERLAP_SCORE_CAP = 8;
export const QUERY_OVERLAP_RELEVANCE_MULTIPLIER = 1.5;

export interface QueryProfile {
  compiledQueries: string[];
  weightedTokens: Array<{ token: string; weight: number }>;
}

export interface QueryOverlap {
  score: number;
  matchedTokens: number;
}

export interface OverlapScoredPattern {
  pattern: any;
  overlap: QueryOverlap;
}

export function canonicalizeToken(token: string): string {
  if (token.endsWith('ing') && token.length > 5) {
    const stemmed = token.slice(0, -3);
    if (stemmed.endsWith('ll')) return stemmed;
    return stemmed;
  }
  if (token.endsWith('s') && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

export function buildQueryProfile(query: string): QueryProfile {
  const original = query.trim();
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (q: string): void => {
    const normalized = q.trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  };

  if (original.length > 0) {
    push(original);
  }

  const tokens = normalizeTokens(original).map(canonicalizeToken);
  const tokenStats = new Map<string, { count: number; firstIndex: number }>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const existing = tokenStats.get(token);
    if (!existing) {
      tokenStats.set(token, { count: 1, firstIndex: i });
    } else {
      existing.count += 1;
    }
  }

  const weightedTokens = Array.from(tokenStats.entries())
    .map(([token, stat]) => {
      const positionBoost = 1 - (stat.firstIndex / Math.max(tokens.length, 1));
      const specificityBoost = Math.min(token.length, 12) / 12;
      const weight = (stat.count * 2) + positionBoost + specificityBoost;
      return { token, weight: Number(weight.toFixed(3)) };
    })
    .sort((a, b) => b.weight - a.weight);

  if (weightedTokens.length > 0) {
    const normalized = weightedTokens.map(t => t.token).join(' ');
    push(normalized);

    const top3 = weightedTokens.slice(0, 3).map(t => t.token).join(' ');
    if (top3) push(top3);

    const top5 = weightedTokens.slice(0, 5).map(t => t.token).join(' ');
    if (top5) push(top5);
  }

  // Keep a broad fallback if no meaningful variant exists.
  if (out.length === 0) {
    push(PATREON_DEFAULT_QUERY);
  }

  return {
    compiledQueries: out.slice(0, MAX_QUERY_VARIANTS),
    weightedTokens,
  };
}

export function computeQueryOverlap(text: string, profile: QueryProfile): QueryOverlap {
  if (profile.weightedTokens.length === 0) {
    return { score: 0, matchedTokens: 0 };
  }
  const haystack = text.toLowerCase();
  let score = 0;
  let matchedTokens = 0;

  for (const token of profile.weightedTokens) {
    if (haystack.includes(token.token)) {
      score += token.weight;
      matchedTokens += 1;
    }
  }

  return { score, matchedTokens };
}

export function isStrongQueryOverlap(overlap: QueryOverlap, profile: QueryProfile): boolean {
  const tokenCount = profile.weightedTokens.length;

  if (tokenCount === 0) return false;
  if (tokenCount <= 2) return overlap.matchedTokens >= 1;

  // Long prompts should match multiple weighted terms, not just "swiftui".
  const topWeights = profile.weightedTokens
    .slice(0, Math.min(4, tokenCount))
    .reduce((sum, token) => sum + token.weight, 0);
  const minScore = topWeights * 0.35;

  return overlap.matchedTokens >= 2 && overlap.score >= minScore;
}

export function compareByOverlapThenScore(a: OverlapScoredPattern, b: OverlapScoredPattern): number {
  if (b.overlap.score !== a.overlap.score) {
    return b.overlap.score - a.overlap.score;
  }
  return b.pattern.relevanceScore - a.pattern.relevanceScore;
}
