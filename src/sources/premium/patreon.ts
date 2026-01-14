// src/sources/premium/patreon.ts

import {
  getValidAccessToken,
  loadTokens,
} from './patreon-oauth.js';
import { extractFromAttachment } from './patreon-zip.js';
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

export interface Creator {
  id: string;
  name: string;
  url: string;
  isSwiftRelated: boolean;
}

interface PatreonPost {
  id: string;
  attributes: {
    title: string;
    content: string;
    url: string;
    published_at: string;
  };
  relationships?: {
    attachments?: { data: Array<{ id: string; type: string }> };
  };
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
  async getSubscribedCreators(): Promise<Creator[]> {
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

  async detectSwiftCreators(): Promise<Creator[]> {
    const creators = await this.getSubscribedCreators();
    return creators.filter(c => c.isSwiftRelated);
  }

  async fetchPatterns(creatorId?: string): Promise<PatreonPattern[]> {
    const accessToken = await getValidAccessToken(this.clientId, this.clientSecret);
    if (!accessToken) return [];

    const patterns: PatreonPattern[] = [];
    const creatorsToFetch = creatorId
      ? [creatorId]
      : this.enabledCreators;

    for (const cid of creatorsToFetch) {
      try {
        const posts = await this.fetchCreatorPosts(cid, accessToken);
        patterns.push(...posts);
      } catch (error) {
        console.error(`Failed to fetch posts for creator ${cid}:`, error);
      }
    }

    // Sort by date (newest first)
    patterns.sort((a, b) =>
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );

    return patterns;
  }

  private async fetchCreatorPosts(
    creatorId: string,
    accessToken: string
  ): Promise<PatreonPattern[]> {
    const response = await fetch(
      `${PATREON_API}/campaigns/${creatorId}/posts?fields[post]=title,content,url,published_at`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.status}`);
    }

    const data = await response.json() as {
      data: PatreonPost[];
      included?: Array<{ id: string; type: string; attributes: { url: string } }>;
    };

    const patterns: PatreonPattern[] = [];

    for (const post of data.data) {
      const content = post.attributes.content || '';
      const title = post.attributes.title || '';

      // Extract from title first (metadata-first approach)
      let topics = detectTopics(title);
      if (topics.length === 0) {
        // Fallback to content scanning
        topics = detectTopics(content);
      }

      const hasCode = hasCodeContent(content);
      const relevanceScore = calculateRelevance(`${title} ${content}`, hasCode);

      patterns.push({
        id: `patreon-${post.id}`,
        title,
        url: post.attributes.url,
        publishDate: post.attributes.published_at,
        excerpt: content.substring(0, 300),
        content,
        creator: creatorId,
        topics,
        relevanceScore,
        hasCode,
      });

      // Check for zip attachments
      if (post.relationships?.attachments?.data) {
        for (const attachment of post.relationships.attachments.data) {
          const included = data.included?.find(
            i => i.id === attachment.id && i.type === 'attachment'
          );
          if (included?.attributes?.url?.endsWith('.zip')) {
            const result = await extractFromAttachment(
              included.attributes.url,
              post.id,
              accessToken
            );
            if (result.success) {
              for (const extracted of result.patterns) {
                const extractedRelevance = calculateRelevance(
                  `${extracted.filename} ${extracted.content}`,
                  extracted.hasCode
                );
                patterns.push({
                  id: `patreon-${post.id}-${extracted.filename}`,
                  title: `${title} - ${extracted.filename}`,
                  url: post.attributes.url,
                  publishDate: post.attributes.published_at,
                  excerpt: extracted.content.substring(0, 300),
                  content: extracted.content,
                  creator: creatorId,
                  topics: extracted.topics,
                  relevanceScore: extractedRelevance,
                  hasCode: extracted.hasCode,
                });
              }
            }
          }
        }
      }
    }

    return patterns;
  }

  async searchPatterns(query: string): Promise<PatreonPattern[]> {
    const patterns = await this.fetchPatterns();
    const lowerQuery = query.toLowerCase();

    return patterns.filter(p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.content.toLowerCase().includes(lowerQuery) ||
      p.topics.some(t => t.includes(lowerQuery))
    );
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export default PatreonSource;
