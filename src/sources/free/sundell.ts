// src/sources/free/sundell.ts

import { RssPatternSource, type BasePattern } from './rssPatternSource.js';
import { BASE_TOPIC_KEYWORDS, BASE_QUALITY_SIGNALS, mergeKeywords, mergeQualitySignals } from '../../config/swift-keywords.js';

export interface SundellPattern extends BasePattern {}

// Sundell-specific topic keywords (extends base)
const sundellSpecificTopics: Record<string, string[]> = {
  'protocols': ['associated type'], // Adds to base
};

// Sundell-specific quality signals (extends base)
const sundellSpecificSignals: Record<string, number> = {
  'pattern': 6,
  'best practice': 8,
  'foundation': 4,
};

const sundellTopicKeywords = mergeKeywords(BASE_TOPIC_KEYWORDS, sundellSpecificTopics);
const sundellQualitySignals = mergeQualitySignals(BASE_QUALITY_SIGNALS, sundellSpecificSignals);

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
}

export default SundellSource;
