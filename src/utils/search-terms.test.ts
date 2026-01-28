// src/utils/search-terms.test.ts
// Tests for shared normalization logic

import { describe, it, expect } from 'vitest';
import { normalizeTokens } from './search-terms.js';

describe('normalizeTokens', () => {
  describe('basic normalization', () => {
    it('should lowercase text', () => {
      const result = normalizeTokens('SwiftUI Combine');
      expect(result).toContain('swiftui');
      expect(result).toContain('combine');
    });

    it('should filter stopwords', () => {
      const result = normalizeTokens('how to use async await');
      expect(result).not.toContain('how');
      expect(result).not.toContain('to');
      expect(result).toContain('use');
      expect(result).toContain('async');
      expect(result).toContain('await');
    });

    it('should handle hyphenated terms', () => {
      const result = normalizeTokens('async-await patterns');
      expect(result).toContain('async');
      expect(result).toContain('await');
      expect(result).toContain('patterns');
    });

    it('should preserve Swift-specific terms', () => {
      const result = normalizeTokens('swiftui actor protocol');
      expect(result).toContain('swiftui');
      expect(result).toContain('actor');
      expect(result).toContain('protocol');
    });

    it('should strip non-word characters', () => {
      const result = normalizeTokens('test@email.com (example) [brackets]');
      // Only valid word tokens should remain
      expect(result).not.toContain('@');
      expect(result).not.toContain('(');
      expect(result).not.toContain(')');
    });

    it('should filter short tokens', () => {
      const result = normalizeTokens('a b swift ui');
      expect(result).not.toContain('a');
      expect(result).not.toContain('b');
      expect(result).toContain('swift');
    });
  });

  describe('with transform function', () => {
    it('should apply transform to non-preserved terms', () => {
      const mockStemmer = (token: string) => token + '_stem';
      const result = normalizeTokens('testing patterns', mockStemmer);
      
      // "patterns" should be stemmed
      expect(result).toContain('patterns_stem');
    });

    it('should not apply transform to preserved terms', () => {
      const mockStemmer = (token: string) => token + '_stem';
      const result = normalizeTokens('swiftui patterns', mockStemmer);
      
      // "swiftui" should NOT be stemmed
      expect(result).toContain('swiftui');
      expect(result).not.toContain('swiftui_stem');
      
      // "patterns" should be stemmed
      expect(result).toContain('patterns_stem');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = normalizeTokens('');
      expect(result).toEqual([]);
    });

    it('should handle only stopwords', () => {
      const result = normalizeTokens('the and or but');
      expect(result).toEqual([]);
    });

    it('should handle whitespace-only', () => {
      const result = normalizeTokens('   \t\n   ');
      expect(result).toEqual([]);
    });

    it('should handle mixed case preserved terms', () => {
      const result = normalizeTokens('SwiftUI ASYNC Await');
      expect(result).toContain('swiftui');
      expect(result).toContain('async');
      expect(result).toContain('await');
    });
  });

  describe('consistency with IntentCache and search', () => {
    it('should produce same tokens for query normalization (without transform)', () => {
      const query = 'how to use async-await with SwiftUI';
      const result = normalizeTokens(query);
      
      // Should contain: use, async, await, swiftui (sorted elsewhere)
      expect(result).toContain('use');
      expect(result).toContain('async');
      expect(result).toContain('await');
      expect(result).toContain('swiftui');
      
      // Should NOT contain stopwords
      expect(result).not.toContain('how');
      expect(result).not.toContain('to');
      expect(result).not.toContain('with');
    });

    it('should handle technical terms consistently', () => {
      const query = 'mvvm architecture objective-c';
      const result = normalizeTokens(query);
      
      expect(result).toContain('mvvm');
      expect(result).toContain('architecture');
      expect(result).toContain('objective'); // Split from hyphen
      expect(result).not.toContain('c'); // Filtered as <= 1 char
    });
  });
});
