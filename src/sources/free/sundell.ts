// src/sources/free/sundell.ts

import { RssPatternSource, type BasePattern } from './rssPatternSource.js';
import { createSourceConfig } from '../../config/swift-keywords.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SundellPattern extends BasePattern {}

const { topicKeywords, qualitySignals } = createSourceConfig(
  { 'protocols': ['associated type'] },
  { 'pattern': 6, 'best practice': 8, 'foundation': 4 }
);

export class SundellSource extends RssPatternSource<SundellPattern> {
  constructor() {
    super({
      feedUrl: 'https://www.swiftbysundell.com/feed.rss',
      cacheKey: 'sundell-patterns',
      rssCacheTtl: 3600,
      topicKeywords,
      qualitySignals,
    });
  }
}

export default SundellSource;
