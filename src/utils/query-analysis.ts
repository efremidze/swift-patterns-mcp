// src/utils/query-analysis.ts
// Query profiling and overlap scoring for pattern search

import { normalizeTokens } from './search-terms.js';

export const MAX_QUERY_VARIANTS = 4;
export const PATREON_DEFAULT_QUERY = 'swiftui';
export const QUERY_OVERLAP_SCORE_CAP = 8;
export const QUERY_OVERLAP_RELEVANCE_MULTIPLIER = 1.5;

const CONVERSATIONAL_PREFIX_PATTERNS: RegExp[] = [
  /^\s*i\s+want\s+to\s+/i,
  /^\s*i\s+need\s+to\s+/i,
  /^\s*i(?:'m| am)\s+trying\s+to\s+/i,
  /^\s*(?:build|create|make)\s+(?:a|an|the)\s+/i,
  /^\s*(?:build|create|make)\s+/i,
  /^\s*can\s+you\s+/i,
  /^\s*could\s+you\s+/i,
  /^\s*please\s+/i,
  /^\s*help\s+me\s+(?:build|create|make|with)\s+/i,
  /^\s*show\s+me\s+(?:how\s+to\s+)?/i,
  /^\s*how\s+do\s+i\s+/i,
];

const LOW_SIGNAL_QUERY_TOKENS = new Set([
  'want',
  'need',
  'build',
  'create',
  'make',
  'show',
  'help',
  'implement',
  'trying',
  'look',
  'looking',
  'like',
]);

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

function stripConversationalFraming(query: string): string {
  let normalized = query
    .replace(/\((?:use|using)\s+patreon\)/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let changed = true;
  while (changed && normalized.length > 0) {
    changed = false;
    for (const pattern of CONVERSATIONAL_PREFIX_PATTERNS) {
      const next = normalized.replace(pattern, '').trim();
      if (next && next !== normalized) {
        normalized = next;
        changed = true;
        break;
      }
    }
  }

  return normalized;
}

function removeLowSignalTokens(tokens: string[]): string[] {
  const filtered = tokens.filter(token => !LOW_SIGNAL_QUERY_TOKENS.has(token));
  // Keep original token stream if filtering would over-prune.
  return filtered.length >= 2 ? filtered : tokens;
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

  const deFramed = stripConversationalFraming(original);
  if (deFramed.length > 0) {
    push(deFramed);
  }

  const rawTokens = normalizeTokens(deFramed || original).map(canonicalizeToken);
  const tokens = removeLowSignalTokens(rawTokens);
  if (tokens.length > 0) {
    // Preserve token order for high-signal keyword phrase searches.
    push(tokens.join(' '));
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
    if (top5) push(top5);

    const top3 = weightedTokens.slice(0, 3).map(t => t.token).join(' ');
    if (top3) push(top3);
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
