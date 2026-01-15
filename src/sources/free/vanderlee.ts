// src/sources/free/vanderlee.ts

import { RssPatternSource, BasePattern } from './rssPatternSource.js';

export interface VanderLeePattern extends BasePattern {}

const vanderleeTopicKeywords: Record<string, string[]> = {
  'debugging': ['debug', 'breakpoint', 'lldb', 'xcode'],
  'performance': ['performance', 'memory', 'leak', 'optimization'],
  'swiftui': ['swiftui', 'view', 'state', 'binding'],
  'combine': ['combine', 'publisher', 'subscriber'],
  'concurrency': ['async', 'await', 'actor', 'task'],
  'testing': ['test', 'xctest', 'mock'],
  'tooling': ['xcode', 'git', 'ci', 'fastlane'],
};

const vanderleeQualitySignals: Record<string, number> = {
  // Technical depth
  'how to': 5,
  'step by step': 5,
  'tutorial': 5,
  'guide': 4,
  'example': 4,
  'tip': 3,
  'fix': 4,
  'solve': 4,

  // Performance & debugging (van der Lee specialties)
  'performance': 8,
  'memory': 7,
  'debugging': 7,
  'leak': 6,
  'optimization': 7,
  'profiling': 6,

  // Advanced topics
  'concurrency': 7,
  'async': 6,
  'await': 6,
  'combine': 6,

  // Frameworks & tools
  'swiftui': 6,
  'xcode': 5,
  'instruments': 6,
  'ci': 4,
  'fastlane': 4,
};

function extractPostContent(html: string): string {
  // Extract content from post-content div
  const postContentMatch = html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div/i);
  if (postContentMatch) {
    return stripHtml(postContentMatch[1]);
  }
  // Fallback: extract from article tag
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    return stripHtml(articleMatch[1]);
  }
  return '';
}

function stripHtml(html: string): string {
  // Keep code blocks intact for detection, remove other HTML
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    // Keep pre/code tags for code detection
    .replace(/<(?!pre|code|\/pre|\/code)[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class VanderLeeSource extends RssPatternSource<VanderLeePattern> {
  constructor() {
    super({
      feedUrl: 'https://www.avanderlee.com/feed/',
      cacheKey: 'vanderlee-patterns',
      rssCacheTtl: 3600,
      articleCacheTtl: 86400,
      topicKeywords: vanderleeTopicKeywords,
      qualitySignals: vanderleeQualitySignals,
      fetchFullArticle: true,
      extractContentFn: extractPostContent,
    });
  }

  protected makePattern(obj: BasePattern): VanderLeePattern {
    return { ...obj };
  }
}

export default VanderLeeSource;
