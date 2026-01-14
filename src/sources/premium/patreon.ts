// src/sources/premium/patreon.ts

import { loadTokens, getValidAccessToken } from './patreon-oauth.js';
import { getChannelVideos, searchVideos, Video } from './youtube.js';
import { extractFromAttachment, ExtractedPattern } from './patreon-zip.js';
import { getByPatreonId } from '../../config/creators.js';
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

function getSwiftMcpDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(home, '.swift-mcp');
}

function getConfigPath(): string {
  return path.join(getSwiftMcpDir(), 'patreon-creators.json');
}

function detectTopics(text: string): string[] {
  const topics: string[] = [];
  const lower = text.toLowerCase();

  const keywords: Record<string, string[]> = {
    'swiftui': ['swiftui', '@state', '@binding', '@observable'],
    'concurrency': ['async', 'await', 'actor', 'task'],
    'networking': ['urlsession', 'network', 'api call'],
    'testing': ['xctest', 'unit test', 'mock'],
    'architecture': ['mvvm', 'coordinator', 'clean architecture'],
    'uikit': ['uikit', 'uiview', 'autolayout'],
  };

  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(w => lower.includes(w))) {
      topics.push(topic);
    }
  }

  return topics;
}

function hasCodeContent(content: string): boolean {
  return /\b(func|class|struct|protocol|extension)\s+\w+/.test(content) ||
         content.includes('```');
}

function calculateRelevance(text: string, hasCode: boolean): number {
  const lower = text.toLowerCase();
  let score = 0;

  // High-value keywords
  const keywords: Record<string, number> = {
    'swift': 10,
    'swiftui': 10,
    'ios': 8,
    'testing': 7,
    'architecture': 7,
    'pattern': 6,
    'best practice': 8,
    'tutorial': 5,
    'example': 4,
    'async': 6,
    'await': 6,
    'actor': 6,
    'protocol': 5,
    'generic': 5,
  };

  for (const [keyword, points] of Object.entries(keywords)) {
    if (lower.includes(keyword)) {
      score += points;
    }
  }

  // Bonus for code content
  if (hasCode) {
    score += 15;
  }

  return Math.min(100, score);
}

function isSwiftRelated(name: string, summary?: string): boolean {
  const text = `${name} ${summary || ''}`.toLowerCase();
  const keywords = ['swift', 'swiftui', 'ios', 'apple', 'xcode', 'uikit', 'iphone', 'ipad'];
  return keywords.some(k => text.includes(k));
}

// Extract post ID from Patreon URL
// e.g., https://www.patreon.com/posts/apple-stocks-ui-148144034 -> 148144034
function extractPostId(patreonUrl: string): string | null {
  const match = patreonUrl.match(/patreon\.com\/posts\/[^\/]+-(\d+)/);
  return match ? match[1] : null;
}

interface PatreonPostResponse {
  data: {
    id: string;
    attributes: {
      title: string;
      content: string;
      url: string;
      published_at: string;
    };
  };
  included?: Array<{
    id: string;
    type: string;
    attributes: {
      name?: string;
      url?: string;
    };
  }>;
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
      const configPath = getConfigPath();
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
    const configPath = getConfigPath();
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
      // Use identity endpoint with memberships to get campaigns user is subscribed to
      // This is the ONLY correct way to get patron memberships
      const url = `${PATREON_API}/identity?include=memberships.campaign&fields[user]=full_name,email&fields[member]=patron_status&fields[campaign]=creation_name,url,summary`;
      console.log(`Fetching: ${url}`);

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Failed to fetch memberships: ${response.status}`);
        console.error(`Response: ${errorBody}`);
        return [];
      }

      const data = await response.json() as PatreonIdentityResponse;

      if (!data.included) {
        console.error('No memberships data in response. User may not have any active patron memberships.');
        return [];
      }

      console.log(`Memberships response: ${JSON.stringify(data, null, 2).slice(0, 500)}`);

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
      const creators = campaigns
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

      if (creators.length === 0) {
        console.warn(
          'No active Patreon memberships found. ' +
          'You must be a paying patron of at least one creator to use Patreon with swift-mcp.'
        );
      }

      return creators;
    } catch (error) {
      console.error('Failed to fetch subscribed creators:', error);
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

    console.log(`Fetching patterns for ${creatorsToFetch.length} creators:`, creatorsToFetch);

    // Get access token for Patreon API (for zip downloads)
    const accessToken = await getValidAccessToken(this.clientId, this.clientSecret);

    for (const patreonId of creatorsToFetch) {
      // Look up creator in registry to get YouTube channel
      const creator = getByPatreonId(patreonId);
      if (!creator?.youtubeChannelId) {
        console.log(`No YouTube channel for creator ${patreonId}`);
        continue;
      }

      try {
        const videos = await getChannelVideos(creator.youtubeChannelId, 50);
        console.log(`Found ${videos.length} videos for ${creator.name}`);

        for (const video of videos) {
          // Add video as pattern
          patterns.push(this.videoToPattern(video, creator.name));

          // If video has Patreon link, try to fetch zip attachments
          if (video.patreonLink && accessToken) {
            const zipPatterns = await this.fetchPostZips(video.patreonLink, video.title, creator.name, accessToken);
            patterns.push(...zipPatterns);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch videos for ${creator.name}:`, error);
      }
    }

    // Sort by date (newest first)
    patterns.sort((a, b) =>
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );

    return patterns;
  }

  /**
   * Fetch a Patreon post and extract zip attachments
   */
  private async fetchPostZips(
    patreonUrl: string,
    videoTitle: string,
    creatorName: string,
    accessToken: string
  ): Promise<PatreonPattern[]> {
    const postId = extractPostId(patreonUrl);
    if (!postId) {
      console.log(`Could not extract post ID from: ${patreonUrl}`);
      return [];
    }

    try {
      const url = `${PATREON_API}/posts/${postId}?include=attachments&fields[post]=title,content,url,published_at&fields[attachment]=name,url`;
      console.log(`Fetching Patreon post: ${postId}`);

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.log(`Failed to fetch post ${postId}: ${response.status}`);
        console.log(`Error: ${errorBody}`);
        return [];
      }

      const data = await response.json() as PatreonPostResponse;
      const patterns: PatreonPattern[] = [];

      // Find zip attachments
      const attachments = data.included?.filter(
        item => item.type === 'attachment' && item.attributes.url?.endsWith('.zip')
      ) || [];

      console.log(`Found ${attachments.length} zip attachments for post ${postId}`);

      for (const attachment of attachments) {
        if (!attachment.attributes.url) continue;

        const result = await extractFromAttachment(
          attachment.attributes.url,
          postId,
          accessToken
        );

        if (result.success) {
          for (const extracted of result.patterns) {
            patterns.push(this.extractedToPattern(
              extracted,
              videoTitle,
              patreonUrl,
              data.data.attributes.published_at,
              creatorName
            ));
          }
          console.log(`Extracted ${result.patterns.length} files from ${attachment.attributes.name || 'zip'}`);
        } else {
          console.log(`Failed to extract zip: ${result.warnings.join(', ')}`);
        }
      }

      return patterns;
    } catch (error) {
      console.error(`Error fetching post ${postId}:`, error);
      return [];
    }
  }

  /**
   * Convert extracted zip file to PatreonPattern
   */
  private extractedToPattern(
    extracted: ExtractedPattern,
    videoTitle: string,
    patreonUrl: string,
    publishDate: string,
    creatorName: string
  ): PatreonPattern {
    const text = `${extracted.filename} ${extracted.content}`;
    const relevanceScore = calculateRelevance(text, extracted.hasCode);

    return {
      id: `zip-${patreonUrl.split('-').pop()}-${extracted.filename}`,
      title: `${videoTitle} - ${extracted.filename}`,
      url: patreonUrl,
      publishDate,
      excerpt: extracted.content.substring(0, 300),
      content: extracted.content,
      creator: creatorName,
      topics: extracted.topics,
      relevanceScore,
      hasCode: extracted.hasCode,
    };
  }

  private videoToPattern(video: Video, creatorName: string): PatreonPattern {
    const text = `${video.title} ${video.description}`;
    const topics = detectTopics(text);
    const hasCode = hasCodeContent(video.description) || (video.codeLinks?.length ?? 0) > 0;
    const relevanceScore = calculateRelevance(text, hasCode);

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
        console.error(`Search failed for ${creator.name}:`, error);
      }
    }

    return patterns;
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export default PatreonSource;
