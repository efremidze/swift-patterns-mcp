// src/sources/free/vanderlee.ts

import { RssPatternSource, BasePattern } from './rssPatternSource.js';
import { BASE_TOPIC_KEYWORDS, BASE_QUALITY_SIGNALS, mergeKeywords, mergeQualitySignals } from '../../config/swift-keywords.js';

export interface VanderLeePattern extends BasePattern {}

// VanderLee-specific topic keywords (extends base)
const vanderleeSpecificTopics: Record<string, string[]> = {
  'debugging': ['debug', 'breakpoint', 'lldb', 'xcode'],
  'combine': ['combine', 'publisher', 'subscriber'],
  'tooling': ['xcode', 'git', 'ci', 'fastlane'],
  'performance': ['leak', 'profiling'], // Adds to base performance keywords
};

// VanderLee-specific quality signals (extends base, emphasizes performance & debugging)
const vanderleeSpecificSignals: Record<string, number> = {
  'fix': 4,
  'solve': 4,
  'performance': 8, // Override base (was 7, now 8 for vanderlee specialization)
  'memory': 7,
  'debugging': 7,
  'leak': 6,
  'optimization': 7, // Add optimization signal
  'profiling': 6,
  'xcode': 5,
  'instruments': 6,
  'ci': 4,
  'fastlane': 4,
};

const vanderleeTopicKeywords = mergeKeywords(BASE_TOPIC_KEYWORDS, vanderleeSpecificTopics);
const vanderleeQualitySignals = mergeQualitySignals(BASE_QUALITY_SIGNALS, vanderleeSpecificSignals);

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
