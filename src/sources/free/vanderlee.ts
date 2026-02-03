// src/sources/free/vanderlee.ts

import { parseHTML } from 'linkedom';
import { stripHtml as stripHtmlLib } from 'string-strip-html';
import { RssPatternSource, type BasePattern } from './rssPatternSource.js';
import { createSourceConfig } from '../../config/swift-keywords.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface VanderLeePattern extends BasePattern {}

const { topicKeywords, qualitySignals } = createSourceConfig(
  {
    'debugging': ['debug', 'breakpoint', 'lldb', 'xcode'],
    'combine': ['combine', 'publisher', 'subscriber'],
    'tooling': ['xcode', 'git', 'ci', 'fastlane'],
    'performance': ['leak', 'profiling'],
  },
  {
    'fix': 4, 'solve': 4, 'performance': 8, 'memory': 7,
    'debugging': 7, 'leak': 6, 'optimization': 7, 'profiling': 6,
    'xcode': 5, 'instruments': 6, 'ci': 4, 'fastlane': 4,
  }
);

function extractPostContent(html: string): string {
  const { document } = parseHTML(html);
  
  // Try multiple selectors in order of preference
  const selectors = [
    '.post-content',
    'article .entry-content',
    'article',
    'main',
    '.content',
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      // Remove unwanted elements before extracting text
      const unwantedElements = element.querySelectorAll('script, style, nav, footer, .sidebar, .comments');
      unwantedElements.forEach((el: any) => {
        el.parentNode?.removeChild(el);
      });
      
      return stripHtml(element.innerHTML);
    }
  }
  
  return '';
}

function stripHtml(html: string): string {
  // Use string-strip-html library (more robust than regex)
  // Keep pre/code tags for code detection in swift-analysis.ts
  return stripHtmlLib(html, {
    ignoreTags: ['pre', 'code'],
    stripTogetherWithTheirContents: ['script', 'style', 'nav', 'footer'],
  }).result;
}

export class VanderLeeSource extends RssPatternSource<VanderLeePattern> {
  constructor() {
    super({
      feedUrl: 'https://www.avanderlee.com/feed/',
      cacheKey: 'vanderlee-patterns',
      rssCacheTtl: 3600,
      articleCacheTtl: 86400,
      topicKeywords,
      qualitySignals,
      fetchFullArticle: true,
      extractContentFn: extractPostContent,
    });
  }
}

export default VanderLeeSource;
