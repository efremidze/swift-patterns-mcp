// src/sources/free/rssPatternSource.ts

import Parser from 'rss-parser';
import { rssCache, articleCache } from '../../utils/cache.js';
import { SearchIndex, combineScores } from '../../utils/search.js';

export interface BasePattern {
  id: string;
  title: string;
  url: string;
  publishDate: string;
  excerpt: string;
  content: string;
  topics: string[];
  relevanceScore: number;
  hasCode: boolean;
}

export interface RssPatternSourceOptions {
  feedUrl: string;
  cacheKey: string;
  rssCacheTtl?: number;
  articleCacheTtl?: number;
  topicKeywords: Record<string, string[]>;
  qualitySignals: Record<string, number>;
  fetchFullArticle?: boolean;
  extractContentFn?: (html: string) => string;
}

export abstract class RssPatternSource<T extends BasePattern> {
  protected parser = new Parser();
  protected options: RssPatternSourceOptions;

  constructor(options: RssPatternSourceOptions) {
    this.options = options;
  }

  async fetchPatterns(): Promise<T[]> {
    try {
      const { cacheKey, rssCacheTtl = 3600, fetchFullArticle } = this.options;
      const cached = await rssCache.get<T[]>(cacheKey);
      if (cached) return cached;
      const feed = await this.parser.parseURL(this.options.feedUrl);
      const patterns = await Promise.all(
        feed.items.map(item =>
          fetchFullArticle ? this.processArticle(item) : this.processRssItem(item)
        )
      );
      await rssCache.set(cacheKey, patterns, rssCacheTtl);
      return patterns;
    } catch (error) {
      console.error('Failed to fetch RSS content:', error);
      return [];
    }
  }

  protected async processRssItem(item: Parser.Item): Promise<T> {
    const content = item.content || item.contentSnippet || '';
    const text = `${item.title} ${content}`.toLowerCase();
    const topics = this.detectTopics(text);
    const hasCode = this.hasCodeContent(content);
    const relevanceScore = this.calculateRelevance(text, hasCode);
    return this.makePattern({
      id: `${this.options.cacheKey}-${item.guid || item.link}`,
      title: item.title || '',
      url: item.link || '',
      publishDate: item.pubDate || '',
      excerpt: (item.contentSnippet || '').substring(0, 300),
      content,
      topics,
      relevanceScore,
      hasCode,
    });
  }

  protected async processArticle(item: Parser.Item): Promise<T> {
    const rssContent = item.content || item.contentSnippet || '';
    const url = item.link || '';
    let fullContent = rssContent;
    try {
      if (url) {
        fullContent = await this.fetchArticleContent(url);
      }
    } catch {
      fullContent = rssContent;
    }
    const text = `${item.title} ${fullContent}`.toLowerCase();
    const topics = this.detectTopics(text);
    const hasCode = this.hasCodeContent(fullContent);
    const relevanceScore = this.calculateRelevance(text, hasCode);
    return this.makePattern({
      id: `${this.options.cacheKey}-${item.guid || item.link}`,
      title: item.title || '',
      url,
      publishDate: item.pubDate || '',
      excerpt: (item.contentSnippet || '').substring(0, 300),
      content: fullContent,
      topics,
      relevanceScore,
      hasCode,
    });
  }

  protected async fetchArticleContent(url: string): Promise<string> {
    const { articleCacheTtl = 86400, extractContentFn } = this.options;
    const cached = await articleCache.get<string>(url);
    if (cached) return cached;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'swift-mcp/1.0 (RSS Reader)' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const content = extractContentFn ? extractContentFn(html) : html;
      await articleCache.set(url, content, articleCacheTtl);
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }

  protected detectTopics(text: string): string[] {
    const detected: string[] = [];
    for (const [topic, keywords] of Object.entries(this.options.topicKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        detected.push(topic);
      }
    }
    return detected;
  }

  protected calculateRelevance(text: string, hasCode: boolean): number {
    let score = 50;
    for (const [keyword, points] of Object.entries(this.options.qualitySignals)) {
      if (text.includes(keyword)) {
        score += points;
      }
    }
    if (hasCode) score += 10;
    return Math.min(100, score);
  }

  protected hasCodeContent(content: string): boolean {
    if (content.includes('<code>') || content.includes('<pre>')) return true;
    if (content.includes('```')) return true;
    if (/\b(func|class|struct|protocol|extension|enum|actor)\s+\w+/.test(content)) return true;
    const codeIndicators = [
      /\blet\s+\w+\s*[=:]/,
      /\bvar\s+\w+\s*[=:]/,
      /\breturn\s+\w+/, 
      /\bguard\s+let/,
      /\bif\s+let/,
      /\basync\s+(func|let|var|throws)/,
      /\bawait\s+\w+/, 
      /\b\w+\s*\(\s*\)\s*->\s*\w+/, 
      /@\w+\s+(struct|class|func|var)/,
    ];
    return codeIndicators.some(pattern => pattern.test(content));
  }

  async searchPatterns(query: string): Promise<T[]> {
    const patterns = await this.fetchPatterns();
    const searchIndex = new SearchIndex<T>(['title', 'content', 'topics']);
    searchIndex.addDocuments(patterns);
    const results = searchIndex.search(query, {
      fuzzy: 0.2,
      boost: { title: 2.5, topics: 1.8, content: 1 },
    });
    return results
      .map(result => ({
        ...result.item,
        relevanceScore: combineScores(result.score, result.item.relevanceScore),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // To be implemented by subclass to cast to correct type
  protected abstract makePattern(obj: BasePattern): T;
}
