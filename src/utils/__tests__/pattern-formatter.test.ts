// src/utils/__tests__/pattern-formatter.test.ts

import { describe, it, expect } from 'vitest';
import {
  formatTopicPatterns,
  formatSearchPatterns,
  detectCodeIntent,
  COMMON_FORMAT_OPTIONS,
} from '../pattern-formatter.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';

function makePattern(overrides: Partial<BasePattern> = {}): BasePattern {
  return {
    id: 'sundell-patterns-https://example.com/article',
    title: 'Test Pattern',
    url: 'https://example.com/article',
    publishDate: '2024-01-15',
    excerpt: 'A short excerpt about SwiftUI patterns.',
    content: 'Full content about SwiftUI state management and views.',
    topics: ['swiftui'],
    relevanceScore: 85,
    hasCode: true,
    ...overrides,
  };
}

describe('pattern-formatter', () => {
  describe('source name derivation from pattern ID', () => {
    it('should derive "sundell" from sundell pattern IDs', () => {
      const text = formatSearchPatterns(
        [makePattern({ id: 'sundell-patterns-https://swiftbysundell.com/article' })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      expect(text).toContain('**Source**: sundell');
    });

    it('should derive "vanderlee" from vanderlee pattern IDs', () => {
      const text = formatSearchPatterns(
        [makePattern({ id: 'vanderlee-patterns-https://avanderlee.com/article' })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      expect(text).toContain('**Source**: vanderlee');
    });

    it('should derive "pointfree" from pointfree pattern IDs', () => {
      const text = formatSearchPatterns(
        [makePattern({ id: 'pointfree-patterns-https://github.com/pointfreeco/...' })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      expect(text).toContain('**Source**: pointfree');
    });

    it('should derive "nilcoalescing" from nilcoalescing pattern IDs', () => {
      const text = formatSearchPatterns(
        [makePattern({ id: 'nilcoalescing-patterns-https://nilcoalescing.com/article' })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      expect(text).toContain('**Source**: nilcoalescing');
    });

    it('should not produce nonsense source names from article slugs', () => {
      // This was the bug: memvid IDs like "unit-testing-code-that..."
      // would produce source "unit" via id.split('-')[0]
      const text = formatSearchPatterns(
        [makePattern({ id: 'sundell-patterns-https://example.com/unit-testing' })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      // Should be "sundell", not "unit"
      expect(text).toContain('**Source**: sundell');
      expect(text).not.toMatch(/\*\*Source\*\*: unit\b/);
    });
  });

  describe('formatSearchPatterns', () => {
    it('should include search results header with query', () => {
      const text = formatSearchPatterns([makePattern()], 'async await', COMMON_FORMAT_OPTIONS);
      expect(text).toContain('# Search Results: "async await"');
    });

    it('should show result count', () => {
      const patterns = [makePattern(), makePattern({ id: 'vanderlee-1', title: 'Second' })];
      const text = formatSearchPatterns(patterns, 'test', COMMON_FORMAT_OPTIONS);
      expect(text).toContain('Found 2 results');
    });

    it('should include pattern URLs as markdown links', () => {
      const text = formatSearchPatterns(
        [makePattern({ url: 'https://swiftbysundell.com/articles/animation' })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      expect(text).toContain('[Read more](https://swiftbysundell.com/articles/animation)');
    });

    it('should not contain mv2:// URLs', () => {
      const text = formatSearchPatterns(
        [makePattern({ url: 'https://example.com/article' })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      expect(text).not.toContain('mv2://');
    });

    it('should show code indicator for patterns with code', () => {
      const text = formatSearchPatterns(
        [makePattern({ hasCode: true })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      expect(text).toContain('**Code**: ✅');
    });

    it('should not show code indicator for patterns without code', () => {
      const text = formatSearchPatterns(
        [makePattern({ hasCode: false })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      expect(text).not.toContain('**Code**');
    });

    it('should truncate results to maxResults', () => {
      const patterns = Array.from({ length: 10 }, (_, i) =>
        makePattern({ id: `source-${i}`, title: `Pattern ${i}` }),
      );
      const text = formatSearchPatterns(patterns, 'test', { ...COMMON_FORMAT_OPTIONS, maxResults: 3 });
      expect(text).toContain('Showing top 3 of 10 results');
    });

    it('should handle empty results', () => {
      const text = formatSearchPatterns([], 'test', COMMON_FORMAT_OPTIONS);
      expect(text).toContain('Search Results');
      expect(text).not.toContain('Found');
    });
  });

  describe('formatTopicPatterns', () => {
    it('should include topic in header', () => {
      const text = formatTopicPatterns([makePattern()], 'swiftui', COMMON_FORMAT_OPTIONS);
      expect(text).toContain('# Swift Patterns: swiftui');
    });

    it('should include quality scores', () => {
      const text = formatTopicPatterns(
        [makePattern({ relevanceScore: 92 })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      expect(text).toContain('**Quality**: 92/100');
    });

    it('should include topics', () => {
      const text = formatTopicPatterns(
        [makePattern({ topics: ['swiftui', 'animation'] })],
        'test',
        COMMON_FORMAT_OPTIONS,
      );
      expect(text).toContain('**Topics**: swiftui, animation');
    });
  });

  describe('detectCodeIntent', () => {
    it('should detect code intent from args', () => {
      expect(detectCodeIntent({ includeCode: true }, 'swiftui')).toBe(true);
    });

    it('should detect code intent from query keywords', () => {
      expect(detectCodeIntent({}, 'show me code examples')).toBe(true);
      expect(detectCodeIntent({}, 'snippet for animation')).toBe(true);
      expect(detectCodeIntent({}, 'example of navigation')).toBe(true);
    });

    it('should return false for plain queries', () => {
      expect(detectCodeIntent({}, 'swiftui navigation')).toBe(false);
      expect(detectCodeIntent({}, 'async await patterns')).toBe(false);
    });
  });
});
