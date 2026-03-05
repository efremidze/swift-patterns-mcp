// src/utils/query-analysis.ts
// Query profiling and overlap scoring for pattern search

import { normalizeTokens } from './search-terms.js';
import { extractNlpIntentFacets, extractNlpKeywordPhrases } from './query-rewrite.js';

export const MAX_QUERY_VARIANTS = 4;
export const PATREON_DEFAULT_QUERY = 'swiftui';
export const QUERY_OVERLAP_SCORE_CAP = 8;
export const QUERY_OVERLAP_RELEVANCE_MULTIPLIER = 1.5;

export interface QueryProfile {
  compiledQueries: string[];
  retrievalQueries: string[];
  fallbackQueries: string[];
  intentFacets: string[];
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
  const compiled: string[] = [];
  const compiledSeen = new Set<string>();
  const retrieval: string[] = [];
  const retrievalSeen = new Set<string>();
  const fallback: string[] = [];
  const fallbackSeen = new Set<string>();

  const pushUnique = (target: string[], seen: Set<string>, q: string): void => {
    const normalized = q.trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    target.push(normalized);
  };

  const pushCompiled = (q: string): void => {
    pushUnique(compiled, compiledSeen, q);
  };

  const pushRetrieval = (q: string): void => {
    pushUnique(retrieval, retrievalSeen, q);
  };

  const pushFallback = (q: string): void => {
    pushUnique(fallback, fallbackSeen, q);
  };

  if (original.length > 0) {
    pushCompiled(original);
  }

  const keywordPhrases = extractNlpKeywordPhrases(original);
  const intentFacets = extractNlpIntentFacets(original);

  for (const phrase of keywordPhrases.slice(0, 2)) {
    pushCompiled(phrase);
  }

  const tokenSource = keywordPhrases[0] || original;
  const tokens = normalizeTokens(tokenSource).map(canonicalizeToken);
  if (tokens.length > 0) {
    // Preserve token order for high-signal keyword phrase searches.
    pushCompiled(tokens.join(' '));
  }

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
    const top5 = weightedTokens.slice(0, 5).map(t => t.token).join(' ');
    if (top5) pushCompiled(top5);

    const top3 = weightedTokens.slice(0, 3).map(t => t.token).join(' ');
    if (top3) pushCompiled(top3);
  }

  const weightByToken = new Map(weightedTokens.map(item => [item.token, item.weight]));
  const scoredFacets = intentFacets
    .map(facet => {
      const facetTokens = normalizeTokens(facet).map(canonicalizeToken);
      const lexicalScore = facetTokens.reduce((sum, token) => sum + (weightByToken.get(token) ?? 0), 0);
      const diversity = new Set(facetTokens).size;
      const specificity = facetTokens.reduce((sum, token) => sum + Math.min(token.length, 12) / 12, 0);
      return {
        facet,
        score: lexicalScore + (diversity * 0.4) + specificity,
      };
    })
    .sort((a, b) => b.score - a.score);

  const primaryPhrase = keywordPhrases[0] || '';
  if (primaryPhrase) {
    pushRetrieval(primaryPhrase);
  }
  for (const facet of scoredFacets.slice(0, 3)) {
    pushRetrieval(facet.facet);
  }
  if (tokens.length > 0) {
    pushRetrieval(tokens.join(' '));
  }
  if (weightedTokens.length > 0) {
    const top5 = weightedTokens.slice(0, 5).map(t => t.token).join(' ');
    if (top5) pushRetrieval(top5);
    const top3 = weightedTokens.slice(0, 3).map(t => t.token).join(' ');
    if (top3) pushRetrieval(top3);
  }
  if (original.length > 0) {
    pushRetrieval(original);
  }

  for (const facet of scoredFacets.slice(3)) {
    pushFallback(facet.facet);
  }
  for (const phrase of keywordPhrases.slice(1)) {
    pushFallback(phrase);
  }
  if (tokens.length > 0) {
    pushFallback(tokens.join(' '));
  }
  if (weightedTokens.length > 0) {
    const top5 = weightedTokens.slice(0, 5).map(t => t.token).join(' ');
    if (top5) pushFallback(top5);
    const top3 = weightedTokens.slice(0, 3).map(t => t.token).join(' ');
    if (top3) pushFallback(top3);
  }
  if (original.length > 0) {
    pushFallback(original);
  }

  // Keep a broad fallback if no meaningful variant exists.
  if (compiled.length === 0) {
    pushCompiled(PATREON_DEFAULT_QUERY);
  }
  if (retrieval.length === 0) {
    pushRetrieval(compiled[0] || PATREON_DEFAULT_QUERY);
  }
  if (fallback.length === 0 && compiled.length > 1) {
    for (const queryVariant of compiled.slice(1)) {
      pushFallback(queryVariant);
    }
  }

  const retrievalQueries = retrieval.slice(0, MAX_QUERY_VARIANTS);
  const retrievalKeys = new Set(retrievalQueries.map(q => q.toLowerCase()));
  const fallbackQueries = fallback
    .filter(q => !retrievalKeys.has(q.toLowerCase()))
    .slice(0, MAX_QUERY_VARIANTS * 2);

  return {
    compiledQueries: compiled.slice(0, MAX_QUERY_VARIANTS),
    retrievalQueries,
    fallbackQueries,
    intentFacets: scoredFacets.map(item => item.facet),
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
