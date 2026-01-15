// src/sources/free/sundell.ts

import { RssPatternSource, BasePattern } from './rssPatternSource.js';

export interface SundellPattern extends BasePattern {}

const sundellTopicKeywords: Record<string, string[]> = {
  'testing': ['test', 'unittest', 'xctest', 'mock'],
  'networking': ['network', 'urlsession', 'api', 'http'],
  'architecture': ['architecture', 'mvvm', 'viper', 'coordinator'],
  'swiftui': ['swiftui', 'view', 'state', 'binding'],
  'concurrency': ['async', 'await', 'actor', 'task', 'thread'],
  'protocols': ['protocol', 'generic', 'associated type'],
  'performance': ['performance', 'optimization', 'memory', 'speed'],
};

const sundellQualitySignals: Record<string, number> = {
  // Technical depth
  'how to': 5,
  'step by step': 5,
  'tutorial': 5,
  'guide': 4,
  'example': 4,
  'pattern': 6,
  'best practice': 8,
  'tip': 3,

  // Advanced topics
  'architecture': 8,
  'testing': 7,
  'performance': 7,
  'concurrency': 7,
  'async': 6,
  'await': 6,
  'actor': 6,
  'protocol': 5,
  'generic': 5,

  // Frameworks
  'swiftui': 6,
  'combine': 6,
  'uikit': 5,
  'foundation': 4,
};

export class SundellSource extends RssPatternSource<SundellPattern> {
  constructor() {
    super({
      feedUrl: 'https://www.swiftbysundell.com/feed.rss',
      cacheKey: 'sundell-patterns',
      rssCacheTtl: 3600,
      topicKeywords: sundellTopicKeywords,
      qualitySignals: sundellQualitySignals,
    });
  }

  protected makePattern(obj: BasePattern): SundellPattern {
    return { ...obj };
  }
}

export default SundellSource;
