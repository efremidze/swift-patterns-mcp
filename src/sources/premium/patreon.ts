// src/sources/premium/patreon.ts

import { loadTokens, getValidAccessToken } from './patreon-oauth.js';
import { searchVideos, Video } from './youtube.js';
import { downloadPost, extractPostId, scanDownloadedContent, DownloadedPost, DownloadedFile } from './patreon-dl.js';
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

interface QueryProfile {
  compiledQueries: string[];
  weightedTokens: Array<{ token: string; weight: number }>;
}

interface QueryOverlap {
  score: number;
  matchedTokens: number;
}

interface OverlapScoredPattern {
  pattern: PatreonPattern;
  overlap: QueryOverlap;
}

type DedupStrategy = 'keep-first' | 'prefer-best';

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
const MAX_VIDEOS_PER_CREATOR = 15;
const PATREON_SEARCH_CACHE_TTL_SECONDS = 1800;
const PATREON_SEARCH_STALE_SECONDS = 1800;
const QUERY_OVERLAP_SCORE_CAP = 8;
const QUERY_OVERLAP_RELEVANCE_MULTIPLIER = 1.5;
const PATREON_DEEP_MAX_ENRICHED_POSTS = 5;
const PATREON_DOWNLOADED_RESULTS_LIMIT = 100;
const PATREON_DIRECT_URL_TIMEOUT_MS = 4000;

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

function buildQueryProfile(query: string): QueryProfile {
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

function selectCreatorsForQuery(query: string) {
  const creators = withYouTube();
  const q = query.toLowerCase();
  const matched = creators.filter(c =>
    q.includes(c.id.toLowerCase()) ||
    q.includes(c.name.toLowerCase())
  );
  return matched.length > 0 ? matched : creators;
}

function computeQueryOverlap(text: string, profile: QueryProfile): QueryOverlap {
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

function isStrongQueryOverlap(overlap: QueryOverlap, profile: QueryProfile): boolean {
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

function applyOverlapBoost(baseScore: number, overlapScore: number): number {
  const boost = Math.round(Math.min(overlapScore, QUERY_OVERLAP_SCORE_CAP) * QUERY_OVERLAP_RELEVANCE_MULTIPLIER);
  return Math.min(100, baseScore + boost);
}

function getPositiveIntEnv(name: string, fallback: number): number {
  const raw = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function isPatreonPostUrl(query: string): boolean {
  return /patreon\.com\/posts\//i.test(query);
}

function getPatreonSearchCacheKey(query: string): string {
  const normalized = normalizeTokens(query).map(canonicalizeToken).sort().join(' ');
  const base = normalized || query.trim().toLowerCase();
  return `patreon-search::${base}`;
}

function canonicalizePatternUrl(rawUrl: string): string {
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

function buildPatternDedupKey(pattern: PatreonPattern): string {
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

function compareByOverlapThenScore(a: OverlapScoredPattern, b: OverlapScoredPattern): number {
  if (b.overlap.score !== a.overlap.score) {
    return b.overlap.score - a.overlap.score;
  }
  return b.pattern.relevanceScore - a.pattern.relevanceScore;
}

function rankPatternsForQuery(
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
    .sort(compareByOverlapThenScore)
    .map(({ pattern }) => pattern);

  if (overlapped.length === 0 && options.fallbackToOriginal) {
    return patterns;
  }

  return overlapped;
}

function shouldReplaceByQuality(existing: PatreonPattern, candidate: PatreonPattern): boolean {
  return (
    candidate.relevanceScore > existing.relevanceScore ||
    (candidate.relevanceScore === existing.relevanceScore && candidate.hasCode && !existing.hasCode)
  );
}

function dedupePatterns(patterns: PatreonPattern[], strategy: DedupStrategy): PatreonPattern[] {
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
        return this.downloadedPostToPatterns(existing)
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

    return this.filesToPatterns(downloadResult.files, {
      id: postId ? `direct-${postId}` : `direct-${Date.now()}`,
      title: postId ? `Patreon Post ${postId}` : 'Patreon Post',
      publishDate: new Date().toISOString(),
      creator: 'Patreon',
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private getDownloadedPatterns(query: string, profile?: QueryProfile): PatreonPattern[] {
    try {
      const posts = scanDownloadedContent();
      if (posts.length === 0) return [];

      const queryProfile = profile ?? buildQueryProfile(query);
      const patterns = posts.flatMap(post => this.downloadedPostToPatterns(post));
      const ranked = rankPatternsForQuery(
        patterns,
        queryProfile,
        pattern => `${pattern.title} ${pattern.excerpt} ${pattern.content} ${pattern.topics.join(' ')}`,
        { fallbackToOriginal: false }
      );
      const deduped = dedupePatterns(ranked, 'keep-first');

      const maxDownloadedResults = getPositiveIntEnv(
        'PATREON_MAX_DOWNLOADED_RESULTS',
        PATREON_DOWNLOADED_RESULTS_LIMIT
      );
      return deduped.slice(0, maxDownloadedResults);
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
    const queryProfile = buildQueryProfile(query);

    // Search YouTube for creators in parallel, using query variants to handle long natural prompts.
    const creators = selectCreatorsForQuery(query);
    const queryVariants = queryProfile.compiledQueries;

    logger.info({
      query,
      queryVariants,
      weightedTokens: queryProfile.weightedTokens.slice(0, 5),
      creators: creators.map(c => c.name),
    }, 'Patreon search variants');

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

    // Fetch actual content for a bounded top subset of Patreon post links.
    // This keeps deep mode useful while preventing large downloads in MCP flows.
    let enrichedPatterns = patterns;
    if (enrichLinkedPosts) {
      const sorted = [...patterns].sort((a, b) => b.relevanceScore - a.relevanceScore);
      const maxEnrichedPosts = getPositiveIntEnv(
        'PATREON_DEEP_MAX_ENRICHED_POSTS',
        PATREON_DEEP_MAX_ENRICHED_POSTS
      );

      const toEnrich = sorted
        .filter(pattern => pattern.url.includes('patreon.com/posts/'))
        .slice(0, maxEnrichedPosts);
      const enrichKeys = new Set(toEnrich.map(pattern => `${pattern.id}::${pattern.url}`));
      const passthrough = sorted.filter(pattern => !enrichKeys.has(`${pattern.id}::${pattern.url}`));

      const enrichedSubset = await this.enrichPatternsWithContent(toEnrich);
      enrichedPatterns = [...enrichedSubset, ...passthrough];
    }

    // Also search local downloaded Patreon content as a resilient fallback path.
    const downloadedPatterns = includeDownloadedFallback
      ? this.getDownloadedPatterns(query, queryProfile)
      : [];

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
    const downloadMemo = new Map<string, Promise<PatreonPattern[]>>();
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

        const existing = downloadMemo.get(pattern.url);
        if (existing) {
          outputs[currentIndex] = await existing;
          continue;
        }

        const downloadPromise = (async (): Promise<PatreonPattern[]> => {
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
              return filePatterns.length > 0 ? filePatterns : [pattern];
            }

            // Keep original pattern if download failed or no files
            return [pattern];
          } catch (error) {
            logError('Patreon', error, { url: pattern.url });
            return [pattern];
          }
        })();

        downloadMemo.set(pattern.url, downloadPromise);
        outputs[currentIndex] = await downloadPromise;
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
