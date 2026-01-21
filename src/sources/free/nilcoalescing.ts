// src/sources/free/nilcoalescing.ts

import { RssPatternSource, type BasePattern } from './rssPatternSource.js';
import { createSourceConfig } from '../../config/swift-keywords.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NilCoalescingPattern extends BasePattern {}

const { topicKeywords, qualitySignals } = createSourceConfig(
  {
    'swiftui': ['navigation', 'animation', 'layout', 'viewbuilder'],
    'concurrency': ['async/await', 'task', 'actor'],
    'testing': ['snapshot', 'unit test'],
    'accessibility': ['accessibility', 'voiceover'],
  },
  {
    'swiftui': 7, 'navigation': 5, 'animation': 4, 'layout': 4,
    'accessibility': 6, 'async': 6, 'await': 6, 'actor': 6,
    'testing': 7, 'snapshot': 6,
  }
);

export class NilCoalescingSource extends RssPatternSource<NilCoalescingPattern> {
  constructor() {
    super({
      feedUrl: 'https://nilcoalescing.com/feed.rss',
      cacheKey: 'nilcoalescing-patterns',
      rssCacheTtl: 3600,
      topicKeywords,
      qualitySignals,
    });
  }
}

export default NilCoalescingSource;
