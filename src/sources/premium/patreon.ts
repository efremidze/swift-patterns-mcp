// src/sources/premium/patreon.ts

import { loadTokens, getValidAccessToken } from './patreon-oauth.js';
import { searchVideos } from './youtube.js';
import { downloadPost, extractPostId, scanDownloadedContent } from './patreon-dl.js';
import { CREATORS } from '../../config/creators.js';
import { logError } from '../../utils/errors.js';
import { fetch } from '../../utils/fetch.js';
import logger from '../../utils/logger.js';
import { createCache, type Cache } from 'async-cache-dedupe';
import { buildQueryProfile } from '../../utils/query-analysis.js';
import { rankPatternsForQuery, selectCreatorsForQuery } from './patreon-scoring.js';
import {
  dedupePatterns,
  isPatreonPostUrl,
  getPatreonSearchCacheKey,
} from './patreon-dedup.js';
import {
  enrichPatternsWithContent,
  filesToPatterns,
  downloadedPostToPatterns,
  videoToPattern,
  getDownloadedPatterns,
  getPositiveIntEnv,
} from './patreon-enrichment.js';

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

interface PatreonSearchOptions { mode?: PatreonSearchMode }

interface InternalPatreonSearchOptions { enrichLinkedPosts: boolean; includeDownloadedFallback: boolean }

interface PatreonCampaign { id: string; type: 'campaign'; attributes: { creation_name: string; url: string; summary?: string } }
interface PatreonMember { id: string; type: 'member'; attributes: { patron_status: 'active_patron' | 'declined_patron' | 'former_patron' | null }; relationships?: { campaign?: { data: { id: string; type: string } } } }
interface PatreonIdentityResponse { data: { id: string; type: string }; included?: Array<PatreonMember | PatreonCampaign> }

const MAX_VIDEOS_PER_CREATOR = 15;
const PATREON_SEARCH_CACHE_TTL_SECONDS = 1800;
const PATREON_SEARCH_STALE_SECONDS = 1800;
const PATREON_DEEP_MAX_ENRICHED_POSTS = 5;
const PATREON_DIRECT_URL_TIMEOUT_MS = 4000;
const PATREON_DEFAULT_QUERY = 'swiftui';

function isSwiftRelated(name: string, summary?: string): boolean {
  const text = `${name} ${summary || ''}`.toLowerCase();
  const keywords = ['swift', 'swiftui', 'ios', 'apple', 'xcode', 'uikit', 'iphone', 'ipad'];
  return keywords.some(k => text.includes(k));
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

  // Returns creators the user PAYS (patron memberships) via identity endpoint with memberships.campaign include.
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

      if (!data.included) return [];

      const members = data.included.filter((item): item is PatreonMember =>
        item.type === 'member' && (item as PatreonMember).attributes?.patron_status === 'active_patron');
      const campaigns = data.included.filter((item): item is PatreonCampaign => item.type === 'campaign');
      const activeCampaignIds = new Set(
        members.map(m => m.relationships?.campaign?.data?.id).filter((id): id is string => !!id)
      );

      return campaigns.filter(c => activeCampaignIds.has(c.id)).map(campaign => ({
        id: campaign.id,
        name: campaign.attributes.creation_name,
        url: campaign.attributes.url,
        isSwiftRelated: isSwiftRelated(campaign.attributes.creation_name, campaign.attributes.summary),
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

  private async searchDirectPostUrl(query: string, mode: PatreonSearchMode): Promise<PatreonPattern[] | null> {
    if (!isPatreonPostUrl(query)) return null;

    const postId = extractPostId(query);
    const posts = scanDownloadedContent();

    if (postId) {
      const existing = posts.find(post =>
        post.postId === postId ||
        post.dirName === postId ||
        post.dirName?.startsWith(`${postId} -`) ||
        post.dirName?.startsWith(`${postId}-`)
      );
      if (existing) {
        return downloadedPostToPatterns(existing)
          .sort((a, b) => b.relevanceScore - a.relevanceScore);
      }
    }

    if (mode === 'fast') {
      // Unified search should remain low-latency and avoid direct download side effects.
      return [];
    }

    const timeoutMs = getPositiveIntEnv('PATREON_DIRECT_URL_TIMEOUT_MS', PATREON_DIRECT_URL_TIMEOUT_MS);
    const downloadResult = await Promise.race([
      downloadPost(query, 'Patreon'),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!downloadResult || !downloadResult.success || !downloadResult.files || downloadResult.files.length === 0) {
      return [];
    }

    return filesToPatterns(downloadResult.files, {
      id: postId ? `direct-${postId}` : `direct-${Date.now()}`,
      title: postId ? `Patreon Post ${postId}` : 'Patreon Post',
      publishDate: new Date().toISOString(),
      creator: 'Patreon',
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private async searchPatternsInternal(
    query: string,
    options: InternalPatreonSearchOptions
  ): Promise<PatreonPattern[]> {
    const { enrichLinkedPosts, includeDownloadedFallback } = options;
    const queryProfile = buildQueryProfile(query);

    const creators = selectCreatorsForQuery(query);
    const queryVariants = queryProfile.compiledQueries;
    logger.info({ query, queryVariants, weightedTokens: queryProfile.weightedTokens.slice(0, 5), creators: creators.map(c => c.name) }, 'Patreon search variants');

    const results = await Promise.allSettled(
      creators.map(async (creator) => {
        const byId = new Map<string, PatreonPattern>();

        for (const variant of queryVariants) {
          const videos = await searchVideos(variant, creator.youtubeChannelId!, MAX_VIDEOS_PER_CREATOR);
          for (const video of videos) {
            if (!byId.has(video.id)) {
              byId.set(video.id, videoToPattern(video, creator.name));
            }
          }

          if (byId.size >= MAX_VIDEOS_PER_CREATOR) break;
        }

        const allPatterns = Array.from(byId.values());
        return rankPatternsForQuery(
          allPatterns,
          queryProfile,
          pattern => `${pattern.title} ${pattern.excerpt} ${pattern.topics.join(' ')}`,
          { fallbackToOriginal: true }
        );
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

    let enrichedPatterns = patterns;
    if (enrichLinkedPosts) {
      const sorted = [...patterns].sort((a, b) => b.relevanceScore - a.relevanceScore);
      const maxEnrichedPosts = getPositiveIntEnv('PATREON_DEEP_MAX_ENRICHED_POSTS', PATREON_DEEP_MAX_ENRICHED_POSTS);
      const toEnrich = sorted.filter(p => p.url.includes('patreon.com/posts/')).slice(0, maxEnrichedPosts);
      const enrichKeys = new Set(toEnrich.map(p => `${p.id}::${p.url}`));
      const passthrough = sorted.filter(p => !enrichKeys.has(`${p.id}::${p.url}`));

      const enrichedSubset = await enrichPatternsWithContent(toEnrich, filesToPatterns);
      enrichedPatterns = [...enrichedSubset, ...passthrough];
    }

    const downloadedPatterns = includeDownloadedFallback ? getDownloadedPatterns(query, queryProfile) : [];

    const merged = dedupePatterns([...enrichedPatterns, ...downloadedPatterns], 'prefer-best');
    return merged.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async searchPatterns(query: string, options: PatreonSearchOptions = {}): Promise<PatreonPattern[]> {
    const mode: PatreonSearchMode = options.mode ?? 'deep';
    const directPatterns = await this.searchDirectPostUrl(query, mode);
    if (directPatterns !== null) {
      return directPatterns;
    }

    if (mode === 'fast') {
      const localMatches = getDownloadedPatterns(query);
      if (localMatches.length > 0) return localMatches;
      return this.fastSearchCache.fastSearch(query);
    }

    return this.searchPatternsInternal(query, { enrichLinkedPosts: true, includeDownloadedFallback: true });
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export default PatreonSource;
