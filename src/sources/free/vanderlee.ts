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
  
  async fetchPatterns(): Promise<VanderLeePattern[]> {
    try {
      const feed = await this.parser.parseURL(this.feedUrl);
      
      return feed.items.map((item: any) => {
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
