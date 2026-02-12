import { describe, expect, it } from 'vitest';
import {
  buildQueryProfile,
  canonicalizeToken,
  compareByOverlapThenScore,
  computeQueryOverlap,
  isStrongQueryOverlap,
} from '../query-analysis.js';

describe('query-analysis', () => {
  it('canonicalizes plural and gerund tokens', () => {
    expect(canonicalizeToken('animations')).toBe('animation');
    expect(canonicalizeToken('scrolling')).toBe('scroll');
    expect(canonicalizeToken('glass')).toBe('glas');
    expect(canonicalizeToken('swiftui')).toBe('swiftui');
  });

  it('builds unique ordered query variants up to max limit', () => {
    const profile = buildQueryProfile('SwiftUI scrolling animations navigation transitions scrolling');
    expect(profile.compiledQueries.length).toBeLessThanOrEqual(4);
    expect(profile.compiledQueries[0]).toBe('SwiftUI scrolling animations navigation transitions scrolling');
    expect(new Set(profile.compiledQueries).size).toBe(profile.compiledQueries.length);
    expect(profile.weightedTokens.length).toBeGreaterThan(2);
  });

  it('falls back to default query when input is empty', () => {
    const profile = buildQueryProfile('   ');
    expect(profile.compiledQueries).toEqual(['swiftui']);
    expect(profile.weightedTokens).toEqual([]);
  });

  it('scores overlap using weighted token matches', () => {
    const profile = buildQueryProfile('swiftui navigation stack transitions');
    const overlap = computeQueryOverlap('Advanced SwiftUI navigation stack with transitions', profile);
    expect(overlap.matchedTokens).toBeGreaterThanOrEqual(2);
    expect(overlap.score).toBeGreaterThan(0);
  });

  it('treats sparse overlap as weak and richer overlap as strong', () => {
    const profile = buildQueryProfile('swiftui navigation stack transitions animation');
    const weak = computeQueryOverlap('SwiftUI tips', profile);
    const strong = computeQueryOverlap('Navigation stack transitions and animation in SwiftUI', profile);
    expect(isStrongQueryOverlap(weak, profile)).toBe(false);
    expect(isStrongQueryOverlap(strong, profile)).toBe(true);
  });

  it('orders results by overlap first then relevance score', () => {
    const a = {
      overlap: { score: 4, matchedTokens: 2 },
      pattern: { relevanceScore: 95 },
    };
    const b = {
      overlap: { score: 6, matchedTokens: 3 },
      pattern: { relevanceScore: 60 },
    };
    const c = {
      overlap: { score: 4, matchedTokens: 2 },
      pattern: { relevanceScore: 70 },
    };

    expect(compareByOverlapThenScore(a as any, b as any)).toBeGreaterThan(0);
    expect(compareByOverlapThenScore(a as any, c as any)).toBeLessThan(0);
  });
});
