// src/sources/free/nilcoalescing.ts

import { RssPatternSource, BasePattern } from './rssPatternSource.js';
import { BASE_TOPIC_KEYWORDS, BASE_QUALITY_SIGNALS, mergeKeywords, mergeQualitySignals } from '../../config/swift-keywords.js';

export interface NilCoalescingPattern extends BasePattern {}

const nilCoalescingSpecificTopics: Record<string, string[]> = {
  'swiftui': ['navigation', 'animation', 'layout', 'viewbuilder'],
  'concurrency': ['async/await', 'task', 'actor'],
  'testing': ['snapshot', 'unit test'],
  'accessibility': ['accessibility', 'voiceover'],
};

const nilCoalescingSpecificSignals: Record<string, number> = {
  'swiftui': 7,
  'navigation': 5,
  'animation': 4,
  'layout': 4,
  'accessibility': 6,
  'async': 6,
  'await': 6,
  'actor': 6,
  'testing': 7,
  'snapshot': 6,
};

const nilCoalescingTopicKeywords = mergeKeywords(BASE_TOPIC_KEYWORDS, nilCoalescingSpecificTopics);
const nilCoalescingQualitySignals = mergeQualitySignals(BASE_QUALITY_SIGNALS, nilCoalescingSpecificSignals);

export class NilCoalescingSource extends RssPatternSource<NilCoalescingPattern> {
  constructor() {
    super({
      feedUrl: 'https://nilcoalescing.com/feed.xml',
      cacheKey: 'nilcoalescing-patterns',
      rssCacheTtl: 3600,
      topicKeywords: nilCoalescingTopicKeywords,
      qualitySignals: nilCoalescingQualitySignals,
    });
  }

  protected makePattern(obj: BasePattern): NilCoalescingPattern {
    return { ...obj };
  }
}

export default NilCoalescingSource;
