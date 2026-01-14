// src/sources/free/vanderlee.ts

import Parser from 'rss-parser';

export interface VanderLeePattern {
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

export class VanderLeeSource {
  private parser = new Parser();
  private feedUrl = 'https://www.avanderlee.com/feed/';
  private lastFetchTime: number = 0;
  private cachedPatterns: VanderLeePattern[] | null = null;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  
  async fetchPatterns(): Promise<VanderLeePattern[]> {
    // Simple cache to avoid hammering RSS feeds
    const now = Date.now();
    if (this.cachedPatterns && (now - this.lastFetchTime) < this.CACHE_DURATION_MS) {
      return this.cachedPatterns;
    }
    
    try {
      const feed = await this.parser.parseURL(this.feedUrl);
      
      const patterns = feed.items.map((item: any) => {
        const content = item.content || item.contentSnippet || '';
        const text = `${item.title} ${content}`.toLowerCase();
        
        const topics = this.detectTopics(text);
        const relevanceScore = this.calculateRelevance(text);
        const hasCode = this.hasCodeContent(content);
        
        return {
          id: `vanderlee-${item.guid || item.link}`,
          title: item.title || '',
          url: item.link || '',
          publishDate: item.pubDate || '',
          excerpt: (item.contentSnippet || '').substring(0, 300),
          content: content,
          topics,
          relevanceScore,
          hasCode,
        };
      });
      
      this.cachedPatterns = patterns;
      this.lastFetchTime = Date.now();
      return patterns;
    } catch (error) {
      console.error('Failed to fetch van der Lee content:', error);
      return [];
    }
  }
  
  private detectTopics(text: string): string[] {
    const topicKeywords: Record<string, string[]> = {
      'debugging': ['debug', 'breakpoint', 'lldb', 'xcode'],
      'performance': ['performance', 'memory', 'leak', 'optimization'],
      'swiftui': ['swiftui', 'view', 'state', 'binding'],
      'combine': ['combine', 'publisher', 'subscriber'],
      'concurrency': ['async', 'await', 'actor', 'task'],
      'testing': ['test', 'xctest', 'mock'],
      'tooling': ['xcode', 'git', 'ci', 'fastlane'],
    };
    
    const detected: string[] = [];
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        detected.push(topic);
      }
    }
    
    return detected;
  }
  
  private calculateRelevance(text: string): number {
    let score = 0;
    
    const keywords = {
      'swift': 10,
      'swiftui': 10,
      'ios': 8,
      'performance': 8,
      'memory': 7,
      'debugging': 7,
      'xcode': 6,
      'practical': 7,
      'tips': 5,
    };
    
    for (const [keyword, points] of Object.entries(keywords)) {
      if (text.includes(keyword)) {
        score += points;
      }
    }
    
    return Math.min(100, score);
  }
  
  private hasCodeContent(content: string): boolean {
    return content.includes('<code>') || 
           content.includes('```') ||
           /\b(func|class|struct|protocol)\s+\w+/.test(content);
  }
  
  async searchPatterns(query: string): Promise<VanderLeePattern[]> {
    const patterns = await this.fetchPatterns();
    const lowerQuery = query.toLowerCase();
    
    return patterns.filter(p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.content.toLowerCase().includes(lowerQuery) ||
      p.topics.some(t => t.includes(lowerQuery))
    );
  }
}

export default VanderLeeSource;
