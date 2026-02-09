// src/sources/premium/patreon.ts

import { loadTokens, getValidAccessToken } from './patreon-oauth.js';
import { searchVideos, Video } from './youtube.js';
import { downloadPost, scanDownloadedContent, DownloadedPost, DownloadedFile } from './patreon-dl.js';
import { CREATORS, withYouTube } from '../../config/creators.js';
import { detectTopics, hasCodeContent, calculateRelevance } from '../../utils/swift-analysis.js';
import { createSourceConfig } from '../../config/swift-keywords.js';
import { logError } from '../../utils/errors.js';
import { fetch } from '../../utils/fetch.js';
import logger from '../../utils/logger.js';
import { normalizeTokens } from '../../utils/search-terms.js';
import { createCache, type Cache } from 'async-cache-dedupe';

const PATREON_API = 'https://www.patreon.com/api/oauth2/v2';

export interface PatreonPattern {
  id: string;
  title: string;
  url: string;
  publishDate: string;
  excerpt: string;
  content: string;
  creator: string;
  topics: string[];
  relevanceScore: number;
  hasCode: boolean;
}

export interface CreatorInfo {
  id: string;
  name: string;
  url: string;
  isSwiftRelated: boolean;
}

type PatreonSearchMode = 'fast' | 'deep';

interface PatreonSearchOptions {
  mode?: PatreonSearchMode;
}

interface InternalPatreonSearchOptions {
  enrichLinkedPosts: boolean;
  includeDownloadedFallback: boolean;
}

interface PatreonCampaign {
  id: string;
  type: 'campaign';
  attributes: {
    creation_name: string;
    url: string;
    summary?: string;
  };
}

interface PatreonMember {
  id: string;
  type: 'member';
  attributes: {
    patron_status: 'active_patron' | 'declined_patron' | 'former_patron' | null;
  };
  relationships?: {
    campaign?: { data: { id: string; type: string } };
  };
}

interface PatreonIdentityResponse {
  data: {
    id: string;
    type: string;
  };
  included?: Array<PatreonMember | PatreonCampaign>;
}

const { topicKeywords: patreonTopicKeywords, qualitySignals: patreonQualitySignals } = createSourceConfig(
  { 'swiftui': ['@observable'], 'architecture': ['clean architecture'] },
  { 'swift': 10, 'ios': 8, 'pattern': 6, 'best practice': 8 }
);

// Patreon-specific scoring constants (matched to free source defaults)
const PATREON_CODE_BONUS = 10;
const PATREON_BASE_SCORE = 50;
const PATREON_EXCERPT_LENGTH = 300;
const PATREON_DEFAULT_QUERY = 'swiftui';
const MAX_QUERY_VARIANTS = 4;
const MAX_VIDEOS_PER_CREATOR = 25;
const PATREON_SEARCH_CACHE_TTL_SECONDS = 1800;
const PATREON_SEARCH_STALE_SECONDS = 1800;

function isSwiftRelated(name: string, summary?: string): boolean {
  const text = `${name} ${summary || ''}`.toLowerCase();
  const keywords = ['swift', 'swiftui', 'ios', 'apple', 'xcode', 'uikit', 'iphone', 'ipad'];
  return keywords.some(k => text.includes(k));
}

function canonicalizeToken(token: string): string {
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

function buildQueryVariants(query: string): string[] {
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

  push(original);

  const tokens = normalizeTokens(original).map(canonicalizeToken);
  if (tokens.length > 0) {
    push(tokens.join(' '));
  }

  const priorityTerms = ['swiftui', 'parallax', 'carousel', 'scroll', 'card', 'animation'];
  const prioritized = priorityTerms.filter(t => tokens.includes(t));
  const remaining = tokens.filter(t => !prioritized.includes(t));
  const focused = [...prioritized, ...remaining].slice(0, 4);
  if (focused.length > 0) {
    push(focused.join(' '));
  }

  // Keep a broad fallback if no meaningful variant exists.
  if (out.length === 0) {
    push(PATREON_DEFAULT_QUERY);
  }

  return out.slice(0, MAX_QUERY_VARIANTS);
}

function selectCreatorsForQuery(query: string) {
  const creators = withYouTube();
  const q = query.toLowerCase();
  const matched = creators.filter(c =>
    q.includes(c.id.toLowerCase()) ||
    q.includes(c.name.toLowerCase())
  );
  return matched.length > 0 ? matched : creators;
}

function hasQueryOverlap(text: string, query: string): boolean {
  const terms = normalizeTokens(query).map(canonicalizeToken);
  if (terms.length === 0) return true;
  const haystack = text.toLowerCase();
  return terms.some(term => haystack.includes(term));
}

function getPatreonSearchCacheKey(query: string): string {
  const normalized = normalizeTokens(query).map(canonicalizeToken).sort().join(' ');
  const base = normalized || query.trim().toLowerCase();
  return `patreon-search::${base}`;
}


export class PatreonSource {
  private clientId: string;
  private clientSecret: string;
  private fastSearchCache: Cache & {
    fastSearch: (query: string) => Promise<PatreonPattern[]>;
  };

  constructor() {
    this.clientId = process.env.PATREON_CLIENT_ID || '';
    this.clientSecret = process.env.PATREON_CLIENT_SECRET || '';

    this.fastSearchCache = createCache({
      storage: { type: 'memory', options: { size: 200 } },
      ttl: PATREON_SEARCH_CACHE_TTL_SECONDS,
      stale: PATREON_SEARCH_STALE_SECONDS,
      onError: (err: unknown) => {
        logError('Patreon', err, { source: 'fast-cache' });
      },
    }).define('fastSearch', {
      ttl: PATREON_SEARCH_CACHE_TTL_SECONDS,
      stale: PATREON_SEARCH_STALE_SECONDS,
      serialize: (q: string) => getPatreonSearchCacheKey(q),
    }, async (q: string) => {
      return this.searchPatternsInternal(q, {
        enrichLinkedPosts: false,
        includeDownloadedFallback: true,
      });
    }) as Cache & {
      fastSearch: (query: string) => Promise<PatreonPattern[]>;
    };
  }

  async isConfigured(): Promise<boolean> {
    if (!this.clientId || !this.clientSecret) return false;
    const tokens = await loadTokens();
    return tokens !== null;
  }

  /**
   * Returns creators the user PAYS (patron memberships).
   * 
   * IMPORTANT: This uses the identity endpoint with memberships.campaign include,
   * NOT the /campaigns endpoint. The /campaigns endpoint only returns campaigns
   * you OWN as a creator, not campaigns you subscribe to as a patron.
   * 
   * Correct API: GET /identity?include=memberships.campaign
   */
  async getSubscribedCreators(): Promise<CreatorInfo[]> {
    const accessToken = await getValidAccessToken(this.clientId, this.clientSecret);
    if (!accessToken) return [];

    try {
      const url = `${PATREON_API}/identity?include=memberships.campaign&fields[user]=full_name,email&fields[member]=patron_status&fields[campaign]=creation_name,url,summary`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        logError('Patreon', `Failed to fetch memberships: ${response.status}`);
        return [];
      }

      const data = await response.json() as PatreonIdentityResponse;

      if (!data.included) {
        return [];
      }

      // Extract active memberships and their campaigns
      const members = data.included.filter(
        (item): item is PatreonMember =>
          item.type === 'member' &&
          (item as PatreonMember).attributes?.patron_status === 'active_patron'
      );

      const campaigns = data.included.filter(
        (item): item is PatreonCampaign => item.type === 'campaign'
      );

      // Get campaign IDs from active memberships
      const activeCampaignIds = new Set(
        members
          .map(m => m.relationships?.campaign?.data?.id)
          .filter((id): id is string => !!id)
      );

      // Return campaigns user is actively subscribed to
      return campaigns
        .filter(c => activeCampaignIds.has(c.id))
        .map(campaign => ({
          id: campaign.id,
          name: campaign.attributes.creation_name,
          url: campaign.attributes.url,
          isSwiftRelated: isSwiftRelated(
            campaign.attributes.creation_name,
            campaign.attributes.summary
          ),
        }));
    } catch (error) {
      logError('Patreon', error);
      return [];
    }
  }

  async detectSwiftCreators(): Promise<CreatorInfo[]> {
    const creators = await this.getSubscribedCreators();
    return creators.filter(c => c.isSwiftRelated);
  }

  async fetchPatterns(creatorId?: string): Promise<PatreonPattern[]> {
    const patterns = await this.searchPatterns(PATREON_DEFAULT_QUERY);

    if (!creatorId) return patterns;

    const creator = CREATORS.find(c => c.patreonCampaignId === creatorId);
    if (!creator) return [];

    return patterns.filter(pattern => pattern.creator === creator.name);
  }

  /**
   * Convert downloaded post to patterns
   */
  private downloadedPostToPatterns(post: DownloadedPost): PatreonPattern[] {
    return this.filesToPatterns(post.files, {
      id: `dl-${post.postId}`,
      title: post.title,
      publishDate: post.publishDate || new Date().toISOString(),
      creator: post.creator,
    });
  }

  private getDownloadedPatterns(query: string): PatreonPattern[] {
    try {
      const posts = scanDownloadedContent();
      if (posts.length === 0) return [];

      const patterns = posts.flatMap(post => this.downloadedPostToPatterns(post));
      const filtered = patterns.filter(pattern =>
        hasQueryOverlap(
          `${pattern.title} ${pattern.excerpt} ${pattern.content} ${pattern.topics.join(' ')}`,
          query
        )
      );
      return filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      logError('Patreon', error, { query, source: 'downloaded-content' });
      return [];
    }
  }


  private videoToPattern(video: Video, creatorName: string): PatreonPattern {
    const text = `${video.title} ${video.description}`;
    const topics = detectTopics(text, patreonTopicKeywords);
    const hasCode = hasCodeContent(video.description) || (video.codeLinks?.length ?? 0) > 0;
    const relevanceScore = calculateRelevance(text, hasCode, patreonQualitySignals, PATREON_BASE_SCORE, PATREON_CODE_BONUS);

    return {
      id: `yt-${video.id}`,
      title: video.title,
      url: video.patreonLink || `https://youtube.com/watch?v=${video.id}`,
      publishDate: video.publishedAt,
      excerpt: video.description.substring(0, PATREON_EXCERPT_LENGTH),
      content: video.description,
      creator: creatorName,
      topics,
      relevanceScore,
      hasCode,
    };
  }

  private async searchPatternsInternal(
    query: string,
    options: InternalPatreonSearchOptions
  ): Promise<PatreonPattern[]> {
    const { enrichLinkedPosts, includeDownloadedFallback } = options;

    // Search YouTube for creators in parallel, using query variants to handle long natural prompts.
    const creators = selectCreatorsForQuery(query);
    const queryVariants = buildQueryVariants(query);

    logger.info({ query, queryVariants, creators: creators.map(c => c.name) }, 'Patreon search variants');

    const results = await Promise.allSettled(
      creators.map(async (creator) => {
        const byId = new Map<string, ReturnType<typeof this.videoToPattern>>();

        for (const variant of queryVariants) {
          const videos = await searchVideos(variant, creator.youtubeChannelId!, MAX_VIDEOS_PER_CREATOR);
          for (const video of videos) {
            if (!byId.has(video.id)) {
              byId.set(video.id, this.videoToPattern(video, creator.name));
            }
          }

          // Stop early once we have enough candidates for this creator.
          if (byId.size >= MAX_VIDEOS_PER_CREATOR) {
            break;
          }
        }

        // Basic relevance gate: keep patterns that overlap with query terms,
        // but allow all if overlap filtering would remove everything.
        const queryTerms = normalizeTokens(query).map(canonicalizeToken);
        const allPatterns = Array.from(byId.values());
        if (queryTerms.length === 0 || allPatterns.length === 0) {
          return allPatterns;
        }

        const overlapped = allPatterns.filter(pattern => {
          const haystack = `${pattern.title} ${pattern.excerpt} ${pattern.topics.join(' ')}`.toLowerCase();
          return queryTerms.some(term => haystack.includes(term));
        });

        return overlapped.length > 0 ? overlapped : allPatterns;
      })
    );

    const patterns: PatreonPattern[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        patterns.push(...result.value);
      } else {
        logError('Patreon', result.reason, { creator: creators[i].name, query });
      }
    }

    // Fetch actual content for patterns with Patreon links (expensive, only for deep mode).
    const enrichedPatterns = enrichLinkedPosts
      ? await this.enrichPatternsWithContent(patterns)
      : patterns;

    // Also search local downloaded Patreon content as a resilient fallback path.
    const downloadedPatterns = includeDownloadedFallback
      ? this.getDownloadedPatterns(query)
      : [];

    const byKey = new Map<string, PatreonPattern>();
    for (const pattern of [...enrichedPatterns, ...downloadedPatterns]) {
      const key = `${pattern.id}::${pattern.url}`;
      if (!byKey.has(key)) {
        byKey.set(key, pattern);
      }
    }

    return Array.from(byKey.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async searchPatterns(query: string, options: PatreonSearchOptions = {}): Promise<PatreonPattern[]> {
    const mode: PatreonSearchMode = options.mode ?? 'deep';

    if (mode === 'fast') {
      const localMatches = this.getDownloadedPatterns(query);
      if (localMatches.length > 0) {
        // Keep low-latency local results first; cache handles stale refresh for misses.
        return localMatches;
      }

      return this.fastSearchCache.fastSearch(query);
    }

    return this.searchPatternsInternal(query, {
      enrichLinkedPosts: true,
      includeDownloadedFallback: true,
    });
  }

  /**
   * Fetch actual code content from Patreon for patterns that have Patreon links
   */
  private async enrichPatternsWithContent(patterns: PatreonPattern[]): Promise<PatreonPattern[]> {
    const concurrencyRaw = Number.parseInt(process.env.PATREON_ENRICH_CONCURRENCY || '3', 10);
    const concurrency = Number.isFinite(concurrencyRaw) && concurrencyRaw > 0 ? concurrencyRaw : 1;
    const outputs: PatreonPattern[][] = new Array(patterns.length);
    let index = 0;

    const worker = async () => {
      while (index < patterns.length) {
        const currentIndex = index++;
        const pattern = patterns[currentIndex];

        // Only fetch content for Patreon URLs
        if (!pattern.url.includes('patreon.com/posts/')) {
          outputs[currentIndex] = [pattern];
          continue;
        }

        try {
          logger.info({ url: pattern.url }, 'Fetching Patreon post content');
          const result = await downloadPost(pattern.url, pattern.creator);

          if (result.success && result.files && result.files.length > 0) {
            // Create patterns from downloaded files
            const filePatterns = this.filesToPatterns(result.files, {
              id: pattern.id,
              title: pattern.title,
              publishDate: pattern.publishDate,
              creator: pattern.creator,
            });
            outputs[currentIndex] = filePatterns.length > 0 ? filePatterns : [pattern];
          } else {
            // Keep original pattern if download failed or no files
            outputs[currentIndex] = [pattern];
          }
        } catch (error) {
          logError('Patreon', error, { url: pattern.url });
          outputs[currentIndex] = [pattern];
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, patterns.length) }, () => worker());
    await Promise.all(workers);

    return outputs.flat();
  }

  /**
   * Convert downloaded files to patterns
   */
  private filesToPatterns(
    files: DownloadedFile[],
    source: Pick<PatreonPattern, 'id' | 'title' | 'publishDate' | 'creator'>
  ): PatreonPattern[] {
    const patterns: PatreonPattern[] = [];

    for (const file of files) {
      if (file.type === 'other') continue;

      const content = file.content || '';
      const text = `${file.filename} ${content}`;
      const topics = detectTopics(text, patreonTopicKeywords);
      const hasCode = file.type === 'swift' || hasCodeContent(content);
      const relevanceScore = calculateRelevance(text, hasCode, patreonQualitySignals, PATREON_BASE_SCORE, PATREON_CODE_BONUS);

      patterns.push({
        id: `${source.id}-${file.filename}`,
        title: `${source.title} - ${file.filename}`,
        url: `file://${file.filepath}`,
        publishDate: source.publishDate,
        excerpt: content.substring(0, PATREON_EXCERPT_LENGTH),
        content,
        creator: source.creator,
        topics,
        relevanceScore,
        hasCode,
      });
    }

    return patterns;
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export default PatreonSource;
