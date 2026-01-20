// src/sources/premium/patreon.ts

import { loadTokens, getValidAccessToken } from './patreon-oauth.js';
import { getChannelVideos, searchVideos, Video } from './youtube.js';
import { scanDownloadedContent, DownloadedPost } from './patreon-dl.js';
import { getByPatreonId } from '../../config/creators.js';
import { getPatreonCreatorsPath } from '../../utils/paths.js';
import { detectTopics, hasCodeContent, calculateRelevance } from '../../utils/swift-analysis.js';
import { createSourceConfig } from '../../config/swift-keywords.js';
import { logError } from '../../utils/errors.js';
import fs from 'fs';
import path from 'path';

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
  private enabledCreators: string[] = [];

  constructor() {
    this.clientId = process.env.PATREON_CLIENT_ID || '';
    this.clientSecret = process.env.PATREON_CLIENT_SECRET || '';
    this.loadEnabledCreators();
  }

  private loadEnabledCreators(): void {
    try {
      const configPath = getPatreonCreatorsPath();
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.enabledCreators = data.enabledCreators || [];
      }
    } catch {
      this.enabledCreators = [];
    }
  }

  saveEnabledCreators(creatorIds: string[]): void {
    this.enabledCreators = creatorIds;
    const configPath = getPatreonCreatorsPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ enabledCreators: creatorIds }, null, 2));
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
    const creatorsToFetch = creatorId
      ? [creatorId]
      : this.enabledCreators;

    // 1. Scan locally downloaded content (from patreon-dl)
    const downloadedPosts = scanDownloadedContent();

    for (const post of downloadedPosts) {
      // Filter by creator if specified
      const creator = creatorsToFetch.length > 0
        ? getByPatreonId(creatorsToFetch.find(id => {
            const c = getByPatreonId(id);
            return c?.name === post.creator;
          }) || '')
        : null;

      if (creatorsToFetch.length > 0 && !creator) continue;

      patterns.push(...this.downloadedPostToPatterns(post));
    }

    // 2. Fetch YouTube videos for additional metadata
    for (const patreonId of creatorsToFetch) {
      const creator = getByPatreonId(patreonId);
      if (!creator?.youtubeChannelId) continue;

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
    const patterns: PatreonPattern[] = [];

    for (const file of post.files) {
      if (file.type === 'other') continue;

      const content = file.content || '';
      const text = `${file.filename} ${content}`;
      const topics = detectTopics(text, patreonTopicKeywords);
      const hasCode = file.type === 'swift' || hasCodeContent(content);
      const relevanceScore = calculateRelevance(text, hasCode, patreonQualitySignals, PATREON_BASE_SCORE, PATREON_CODE_BONUS);

      patterns.push({
        id: `dl-${post.postId}-${file.filename}`,
        title: `${post.title} - ${file.filename}`,
        url: `file://${file.filepath}`,
        publishDate: post.publishDate || new Date().toISOString(),
        excerpt: content.substring(0, 300),
        content,
        creator: post.creator,
        topics,
        relevanceScore,
        hasCode,
      });
    }

    return patterns;
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

    // Search YouTube for each enabled creator
    for (const patreonId of this.enabledCreators) {
      const creator = getByPatreonId(patreonId);
      if (!creator?.youtubeChannelId) continue;

      try {
        const videos = await searchVideos(query, creator.youtubeChannelId, 25);
        for (const video of videos) {
          patterns.push(this.videoToPattern(video, creator.name));
        }
      } catch (error) {
        logError('Patreon', error, { creator: creator.name, query });
      }
    }

    return patterns;
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export default PatreonSource;
