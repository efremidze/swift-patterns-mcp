// src/sources/free/rssPatternSource.ts

import Parser from 'rss-parser';
import { rssCache, articleCache } from '../../utils/cache.js';
import { CachedSearchIndex } from '../../utils/search.js';
import { detectTopics as detectTopicsUtil, hasCodeContent as hasCodeContentUtil, calculateRelevance as calculateRelevanceUtil } from '../../utils/swift-analysis.js';
import { fetchText, buildHeaders } from '../../utils/http.js';
import { logError } from '../../utils/errors.js';

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
  private cachedSearch = new CachedSearchIndex<T>(['title', 'content', 'topics']);

  constructor(options: RssPatternSourceOptions) {
    this.options = options;
  }

  async fetchPatterns(): Promise<T[]> {
    try {
      const { cacheKey, rssCacheTtl = 3600 } = this.options;
      const cached = await rssCache.get<T[]>(cacheKey);
      if (cached) return cached;

      const feed = await this.parser.parseURL(this.options.feedUrl);
      const patterns = await Promise.all(
        feed.items.map(item => this.processItem(item))
      );

      await rssCache.set(cacheKey, patterns, rssCacheTtl);
      // Invalidate search index after fetching new patterns
      this.cachedSearch.invalidate();
      return patterns;
    } catch (error) {
      logError('RSS Pattern Source', error, { feedUrl: this.options.feedUrl });
      return [];
    }
  }

  protected async processItem(item: Parser.Item): Promise<T> {
    const rssContent = item.content || item.contentSnippet || '';
    const url = item.link || '';
    let content = rssContent;

    if (this.options.fetchFullArticle && url) {
      try {
        content = await this.fetchArticleContent(url);
      } catch {
        content = rssContent;
      }
    }

    const text = `${item.title} ${content}`.toLowerCase();
    const topics = this.detectTopics(text);
    const hasCode = this.hasCodeContent(content);
    const relevanceScore = this.calculateRelevance(text, hasCode);
    return this.makePattern({
      id: `${this.options.cacheKey}-${item.guid || item.link}`,
      title: item.title || '',
      url,
      publishDate: item.pubDate || '',
      excerpt: (item.contentSnippet || '').substring(0, 300),
      content,
      topics,
      relevanceScore,
      hasCode,
    });
  }

  protected async fetchArticleContent(url: string): Promise<string> {
    const { articleCacheTtl = 86400, extractContentFn } = this.options;
    const cached = await articleCache.get<string>(url);
    if (cached) return cached;
    
    const headers = buildHeaders('swift-patterns-mcp/1.0 (RSS Reader)');
    const html = await fetchText(url, { headers });
    const content = extractContentFn ? extractContentFn(html) : html;
    await articleCache.set(url, content, articleCacheTtl);
    return content;
  }

  protected detectTopics(text: string): string[] {
    return detectTopicsUtil(text, this.options.topicKeywords);
  }

  protected calculateRelevance(text: string, hasCode: boolean): number {
    return calculateRelevanceUtil(text, hasCode, this.options.qualitySignals, 50, 10);
  }

  protected hasCodeContent(content: string): boolean {
    return hasCodeContentUtil(content);
  }

  async searchPatterns(query: string): Promise<T[]> {
    const patterns = await this.fetchPatterns();
    return this.cachedSearch.search(patterns, query);
  }

  // Override in subclass if custom transformation is needed
  // Default implementation just spreads the object (works for most cases)
  protected makePattern(obj: BasePattern): T {
    return { ...obj } as T;
  }
}
