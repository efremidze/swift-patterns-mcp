import { describe, expect, it } from 'vitest';
import {
  buildPatternDedupKey,
  canonicalizePatternUrl,
  dedupePatterns,
  getPatreonSearchCacheKey,
  isPatreonPostUrl,
} from '../patreon-dedup.js';

function pattern(id: string, url: string, relevanceScore: number, hasCode = false, creator = 'Kavsoft', title = 'Pattern') {
  return {
    id,
    title,
    url,
    publishDate: '2026-01-01',
    excerpt: '',
    content: '',
    creator,
    topics: [],
    relevanceScore,
    hasCode,
  };
}

describe('patreon-dedup', () => {
  it('detects Patreon post URLs', () => {
    expect(isPatreonPostUrl('https://www.patreon.com/posts/new-swift-ui-123')).toBe(true);
    expect(isPatreonPostUrl('https://PATREON.com/posts/123')).toBe(true);
    expect(isPatreonPostUrl('https://www.patreon.com/kavsoft')).toBe(false);
  });

  it('normalizes search cache key by token sorting', () => {
    const a = getPatreonSearchCacheKey('SwiftUI animations navigation');
    const b = getPatreonSearchCacheKey('navigation swiftui animation');
    expect(a).toBe(b);
  });

  it('falls back to trimmed lowercase query when tokens are empty', () => {
    expect(getPatreonSearchCacheKey('   ###   ')).toBe('patreon-search::###');
  });

  it('canonicalizes youtube watch URLs to video key', () => {
    expect(canonicalizePatternUrl('https://www.youtube.com/watch?v=abc123&t=9')).toBe('youtube:abc123');
  });

  it('canonicalizes Patreon post URLs and strips trailing slashes', () => {
    expect(canonicalizePatternUrl('https://www.patreon.com/posts/example-12345/')).toBe(
      'patreon-post:https://www.patreon.com/posts/example-12345'
    );
  });

  it('returns trimmed raw URL when URL parsing fails', () => {
    expect(canonicalizePatternUrl(' not-a-valid-url ')).toBe('not-a-valid-url');
  });

  it('builds file dedup key from creator and title', () => {
    expect(buildPatternDedupKey(pattern('1', 'file:///tmp/one.swift', 40, false, 'Kavsoft', 'Glass UI') as any)).toBe(
      'file-title:kavsoft::glass ui'
    );
  });

  it('builds patreon page key with creator scoping', () => {
    expect(buildPatternDedupKey(pattern('1', 'https://www.patreon.com/kavsoft', 40, false, 'Kavsoft') as any)).toBe(
      'patreon-page:https://www.patreon.com/kavsoft::kavsoft'
    );
  });

  it('builds canonical key for patreon post URLs', () => {
    expect(buildPatternDedupKey(pattern('1', 'https://www.patreon.com/posts/pattern-123', 40) as any)).toBe(
      'patreon-post:https://www.patreon.com/posts/pattern-123'
    );
  });

  it('dedupes by keep-first strategy', () => {
    const first = pattern('1', 'https://www.patreon.com/posts/pattern-123', 20, false);
    const second = pattern('2', 'https://www.patreon.com/posts/pattern-123', 90, true);
    const deduped = dedupePatterns([first as any, second as any], 'keep-first');
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe('1');
  });

  it('dedupes by prefer-best strategy using relevance score', () => {
    const low = pattern('1', 'https://www.patreon.com/posts/pattern-123', 30, false);
    const high = pattern('2', 'https://www.patreon.com/posts/pattern-123', 70, false);
    const deduped = dedupePatterns([low as any, high as any], 'prefer-best');
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe('2');
  });

  it('dedupes by prefer-best strategy using hasCode tie-break', () => {
    const noCode = pattern('1', 'https://www.patreon.com/posts/pattern-123', 70, false);
    const withCode = pattern('2', 'https://www.patreon.com/posts/pattern-123', 70, true);
    const deduped = dedupePatterns([noCode as any, withCode as any], 'prefer-best');
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe('2');
  });

  it('keeps distinct entries for different canonical keys', () => {
    const a = pattern('1', 'https://www.youtube.com/watch?v=abc123', 70, true);
    const b = pattern('2', 'https://www.youtube.com/watch?v=def456', 70, true);
    const c = pattern('3', 'https://www.patreon.com/posts/xyz-99', 70, true);
    const deduped = dedupePatterns([a as any, b as any, c as any], 'prefer-best');
    expect(deduped).toHaveLength(3);
  });
});
