import { describe, expect, it, vi } from 'vitest';
import { buildQueryProfile } from '../../../utils/query-analysis.js';

const mockWithYouTube = vi.hoisted(() => vi.fn());

vi.mock('../../../config/creators.js', () => ({
  withYouTube: mockWithYouTube,
}));

import {
  applyOverlapBoost,
  rankPatternsForQuery,
  selectCreatorsForQuery,
  shouldTriggerConfidenceFallback,
  shouldReplaceByQuality,
  sortPatternsByScoreThenRecency,
} from '../patreon-scoring.js';

function pattern(
  id: string,
  title: string,
  relevanceScore: number,
  hasCode = false,
  creator = 'Kavsoft',
  publishDate = '2026-01-01'
) {
  return {
    id,
    title,
    url: `https://www.patreon.com/posts/${id}`,
    publishDate,
    excerpt: '',
    content: '',
    creator,
    topics: [],
    relevanceScore,
    hasCode,
  };
}

describe('patreon-scoring', () => {
  it('applies rounded overlap boost using multiplier', () => {
    expect(applyOverlapBoost(40, 2.3)).toBe(43);
  });

  it('caps overlap contribution before applying boost', () => {
    expect(applyOverlapBoost(40, 999)).toBe(52);
  });

  it('caps final relevance score at 100', () => {
    expect(applyOverlapBoost(99, 8)).toBe(100);
    expect(applyOverlapBoost(100, 1)).toBe(100);
  });

  it('returns matched creators by case-insensitive name', () => {
    mockWithYouTube.mockReturnValue([
      { id: 'swiftuicodes', name: 'SwiftUICodes' },
      { id: 'sucodee', name: 'sucodee' },
    ]);

    expect(selectCreatorsForQuery('new SWIFTUICODES animations')).toEqual([
      { id: 'swiftuicodes', name: 'SwiftUICodes' },
    ]);
  });

  it('falls back to all creators when no creator terms match', () => {
    const creators = [
      { id: 'kavsoft', name: 'Kavsoft' },
      { id: 'sucodee', name: 'sucodee' },
    ];
    mockWithYouTube.mockReturnValue(creators);
    expect(selectCreatorsForQuery('swiftui navigation stack')).toEqual(creators);
  });

  it('returns original list when profile has no weighted tokens', () => {
    const patterns = [pattern('1', 'A', 40), pattern('2', 'B', 50)];
    const profile = buildQueryProfile(' ');
    expect(rankPatternsForQuery(patterns as any, profile, p => p.title, { fallbackToOriginal: true })).toEqual(patterns);
  });

  it('ranks by overlap when strong matches exist', () => {
    const profile = buildQueryProfile('swiftui navigation stack animation');
    const patterns = [
      pattern('1', 'SwiftUI Navigation Stack Animation', 20),
      pattern('2', 'SwiftUI Layout Basics', 95),
      pattern('3', 'Navigation Stack Transition API', 60),
    ];

    const ranked = rankPatternsForQuery(patterns as any, profile, p => p.title, { fallbackToOriginal: true });
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].title).toContain('Navigation');
    expect(ranked[0].relevanceScore).toBeGreaterThanOrEqual(patterns[0].relevanceScore);
  });

  it('returns original list when no strong overlap and fallback is enabled', () => {
    const profile = buildQueryProfile('complex paidwall architecture advanced concurrency');
    const patterns = [pattern('1', 'SwiftUI intro', 30), pattern('2', 'Basic list view', 29)];
    const ranked = rankPatternsForQuery(patterns as any, profile, p => p.title, { fallbackToOriginal: true });
    expect(ranked).toEqual(patterns);
  });

  it('returns empty list when no strong overlap and fallback is disabled', () => {
    const profile = buildQueryProfile('complex paidwall architecture advanced concurrency');
    const patterns = [pattern('1', 'SwiftUI intro', 30), pattern('2', 'Basic list view', 29)];
    const ranked = rankPatternsForQuery(patterns as any, profile, p => p.title, { fallbackToOriginal: false });
    expect(ranked).toEqual([]);
  });

  it('triggers confidence fallback when top results weakly match long query', () => {
    const profile = buildQueryProfile('photo editor flow photospicker crop filters export share');
    const patterns = [
      pattern('1', 'SwiftUI intro list basics', 90),
      pattern('2', 'Simple animation examples', 88),
    ];

    const shouldFallback = shouldTriggerConfidenceFallback(patterns as any, profile, p => p.title);
    expect(shouldFallback).toBe(true);
  });

  it('does not trigger confidence fallback when top result strongly matches query', () => {
    const profile = buildQueryProfile('calendar infinite scrollview');
    const patterns = [
      pattern('1', 'Calendar Infinite ScrollView', 85),
      pattern('2', 'Calendar List Basics', 70),
    ];

    const shouldFallback = shouldTriggerConfidenceFallback(patterns as any, profile, p => p.title);
    expect(shouldFallback).toBe(false);
  });

  it('uses haystack mapper for overlap calculations', () => {
    const profile = buildQueryProfile('vision os spatial');
    const patterns = [pattern('1', 'Title without keywords', 10), pattern('2', 'Another title', 10)];
    const ranked = rankPatternsForQuery(
      patterns as any,
      profile,
      p => (p.id === '1' ? 'vision os spatial immersion' : 'nothing'),
      { fallbackToOriginal: false }
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].id).toBe('1');
  });

  it('prefers recent pattern when overlap and score are otherwise tied', () => {
    const profile = buildQueryProfile('calendar infinite scrollview');
    const patterns = [
      pattern('old', 'Calendar Infinite ScrollView', 91, false, 'Kavsoft', '2021-01-01T00:00:00Z'),
      pattern('new', 'Calendar Infinite ScrollView', 91, false, 'Kavsoft', '2026-01-10T19:35:26Z'),
    ];
    const ranked = rankPatternsForQuery(patterns as any, profile, p => p.title, { fallbackToOriginal: true });
    expect(ranked[0].id).toBe('new');
  });

  it('sorts fallback lists by relevance and recency', () => {
    const patterns = [
      pattern('older-high', 'A', 90, false, 'Kavsoft', '2020-01-01T00:00:00Z'),
      pattern('newer-mid', 'B', 88, false, 'Kavsoft', '2026-01-10T19:35:26Z'),
      pattern('older-mid', 'C', 88, false, 'Kavsoft', '2022-01-01T00:00:00Z'),
    ];
    const sorted = sortPatternsByScoreThenRecency(patterns as any);
    expect(sorted.map(p => p.id)).toEqual(['newer-mid', 'older-high', 'older-mid']);
  });

  it('prefers candidate with higher relevance score', () => {
    const existing = pattern('1', 'Old', 60, false);
    const candidate = pattern('2', 'New', 80, false);
    expect(shouldReplaceByQuality(existing as any, candidate as any)).toBe(true);
  });

  it('prefers candidate with code when scores tie', () => {
    const existing = pattern('1', 'Old', 80, false);
    const candidate = pattern('2', 'New', 80, true);
    expect(shouldReplaceByQuality(existing as any, candidate as any)).toBe(true);
  });

  it('does not replace candidate when it does not improve quality', () => {
    const sameQuality = shouldReplaceByQuality(
      pattern('1', 'Old', 80, true) as any,
      pattern('2', 'New', 80, true) as any
    );
    const lowerQuality = shouldReplaceByQuality(
      pattern('1', 'Old', 85, true) as any,
      pattern('2', 'New', 70, false) as any
    );

    expect(sameQuality).toBe(false);
    expect(lowerQuality).toBe(false);
  });
});
