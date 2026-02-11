// src/sources/premium/patreon-dedup.ts
// Pattern deduplication and URL canonicalization

import type { PatreonPattern } from './patreon.js';
import { shouldReplaceByQuality } from './patreon-scoring.js';
import { normalizeTokens } from '../../utils/search-terms.js';
import { canonicalizeToken } from '../../utils/query-analysis.js';

export type DedupStrategy = 'keep-first' | 'prefer-best';

export function isPatreonPostUrl(query: string): boolean {
  return /patreon\.com\/posts\//i.test(query);
}

export function getPatreonSearchCacheKey(query: string): string {
  const normalized = normalizeTokens(query).map(canonicalizeToken).sort().join(' ');
  const base = normalized || query.trim().toLowerCase();
  return `patreon-search::${base}`;
}

export function canonicalizePatternUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);

    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      if (videoId) return `youtube:${videoId}`;
    }

    if (parsed.hostname.includes('patreon.com')) {
      const pathname = parsed.pathname.replace(/\/+$/, '');
      if (pathname.includes('/posts/')) {
        return `patreon-post:${parsed.origin}${pathname}`;
      }
      return `patreon-page:${parsed.origin}${pathname}`;
    }

    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl.trim();
  }
}

export function buildPatternDedupKey(pattern: PatreonPattern): string {
  if (pattern.url.startsWith('file://')) {
    return `file-title:${pattern.creator.toLowerCase()}::${pattern.title.toLowerCase()}`;
  }

  const normalizedUrl = canonicalizePatternUrl(pattern.url);
  if (normalizedUrl.startsWith('patreon-page:')) {
    // Many videos map to a single creator page URL; include creator to keep one best per creator page.
    return `${normalizedUrl}::${pattern.creator.toLowerCase()}`;
  }

  return normalizedUrl;
}

export function dedupePatterns(patterns: PatreonPattern[], strategy: DedupStrategy): PatreonPattern[] {
  const byKey = new Map<string, PatreonPattern>();
  for (const pattern of patterns) {
    const key = buildPatternDedupKey(pattern);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, pattern);
      continue;
    }

    if (strategy === 'prefer-best' && shouldReplaceByQuality(existing, pattern)) {
      byKey.set(key, pattern);
    }
  }

  return Array.from(byKey.values());
}
