// src/sources/premium/patreon.ts

import { loadTokens, getValidAccessToken } from './patreon-oauth.js';
import { getChannelVideos, searchVideos, Video } from './youtube.js';
import { scanDownloadedContent, downloadPost, DownloadedPost, DownloadedFile } from './patreon-dl.js';
import { CREATORS, withYouTube } from '../../config/creators.js';
import { detectTopics, hasCodeContent, calculateRelevance } from '../../utils/swift-analysis.js';
import { createSourceConfig } from '../../config/swift-keywords.js';
import { logError } from '../../utils/errors.js';
import { fetch } from '../../utils/fetch.js';
import logger from '../../utils/logger.js';

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

// Patreon-specific scoring constants
const PATREON_CODE_BONUS = 15; // Higher bonus for code-heavy Patreon content
const PATREON_BASE_SCORE = 0; // Start at 0 for Patreon to rely on quality signals

function isSwiftRelated(name: string, summary?: string): boolean {
  const text = `${name} ${summary || ''}`.toLowerCase();
  const keywords = ['swift', 'swiftui', 'ios', 'apple', 'xcode', 'uikit', 'iphone', 'ipad'];
  return keywords.some(k => text.includes(k));
}


export class PatreonSource {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.PATREON_CLIENT_ID || '';
    this.clientSecret = process.env.PATREON_CLIENT_SECRET || '';
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
    const patterns: PatreonPattern[] = [];

    // Use all known creators with YouTube channels, or filter by specific creator
    const creatorsToFetch = creatorId
      ? CREATORS.filter(c => c.patreonCampaignId === creatorId)
      : withYouTube();
    if (creatorId && creatorsToFetch.length === 0) {
      return [];
    }
    // 1. Scan locally downloaded content (from patreon-dl)
    const downloadedPosts = scanDownloadedContent();

    for (const post of downloadedPosts) {
      // Filter by creator if specified
      const matchingCreator = creatorsToFetch.find(c => c.name === post.creator);
      if (creatorId && !matchingCreator) continue;

      patterns.push(...this.downloadedPostToPatterns(post));
    }

    // 2. Fetch YouTube videos for additional metadata
    for (const creator of creatorsToFetch) {
      if (!creator.youtubeChannelId) continue;

      try {
        const videos = await getChannelVideos(creator.youtubeChannelId, 50);
        for (const video of videos) {
          // Add video as pattern (skip if we already have downloaded content for this)
          const hasDownloaded = patterns.some(p =>
            p.url === video.patreonLink || p.title.includes(video.title)
          );
          if (!hasDownloaded) {
            patterns.push(this.videoToPattern(video, creator.name));
          }
        }
      } catch (error) {
        logError('Patreon', error, { creator: creator.name });
      }
    }

    // Sort by date (newest first)
    patterns.sort((a, b) =>
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );

    return patterns;
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
      excerptLength: 300,
    });
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
      excerpt: video.description.substring(0, 300),
      content: video.description,
      creator: creatorName,
      topics,
      relevanceScore,
      hasCode,
    };
  }

  async searchPatterns(query: string): Promise<PatreonPattern[]> {
    const patterns: PatreonPattern[] = [];

    // Search YouTube for all known creators with YouTube channels
    for (const creator of withYouTube()) {
      try {
        const videos = await searchVideos(query, creator.youtubeChannelId!, 25);
        for (const video of videos) {
          patterns.push(this.videoToPattern(video, creator.name));
        }
      } catch (error) {
        logError('Patreon', error, { creator: creator.name, query });
      }
    }

    // Fetch actual content for patterns with Patreon links
    const enrichedPatterns = await this.enrichPatternsWithContent(patterns);
    return enrichedPatterns;
  }

  /**
   * Fetch actual code content from Patreon for patterns that have Patreon links
   */
  private async enrichPatternsWithContent(patterns: PatreonPattern[]): Promise<PatreonPattern[]> {
    const enriched: PatreonPattern[] = [];

    for (const pattern of patterns) {
      // Only fetch content for Patreon URLs
      if (!pattern.url.includes('patreon.com/posts/')) {
        enriched.push(pattern);
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
          if (filePatterns.length > 0) {
            enriched.push(...filePatterns);
          } else {
            enriched.push(pattern);
          }
        } else {
          // Keep original pattern if download failed or no files
          enriched.push(pattern);
        }
      } catch (error) {
        logError('Patreon', error, { url: pattern.url });
        enriched.push(pattern);
      }
    }

    return enriched;
  }

  /**
   * Convert downloaded files to patterns
   */
  private filesToPatterns(
    files: DownloadedFile[],
    source: Pick<PatreonPattern, 'id' | 'title' | 'publishDate' | 'creator'> & { excerptLength?: number }
  ): PatreonPattern[] {
    const patterns: PatreonPattern[] = [];
    const excerptLength = source.excerptLength ?? 500;

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
        excerpt: content.substring(0, excerptLength),
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
