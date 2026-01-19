// src/utils/search.test.ts

import { describe, it, expect } from 'vitest';
import SearchIndex, { fuzzySearch, combineScores, suggestSimilar, SearchableDocument } from './search.js';

// Test documents
const testDocs: SearchableDocument[] = [
  {
    id: 'doc1',
    title: 'Building async SwiftUI apps',
    content: 'Learn how to use async/await with SwiftUI views and state management',
    topics: ['swiftui', 'concurrency'],
  },
  {
    id: 'doc2',
    title: 'Understanding Combine framework',
    content: 'A deep dive into Combine publishers and subscribers',
    topics: ['combine', 'reactive'],
  },
  {
    id: 'doc3',
    title: 'Swift Testing with XCTest',
    content: 'Writing unit tests and UI tests for your iOS apps using XCTest framework',
    topics: ['testing', 'xctest'],
  },
  {
    id: 'doc4',
    title: 'MVVM Architecture in Swift',
    content: 'Implementing the Model-View-ViewModel pattern with protocols and bindings',
    topics: ['architecture', 'mvvm'],
  },
  {
    id: 'doc5',
    title: 'Core Data persistence',
    content: 'Saving and fetching data with CoreData and SwiftUI integration',
    topics: ['coredata', 'persistence'],
  },
];

describe('SearchIndex', () => {
  describe('basic search', () => {
    it('should find documents by title keywords', () => {
      const index = new SearchIndex<SearchableDocument>();
      index.addDocuments(testDocs);

      const results = index.search('SwiftUI');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.item.id === 'doc1')).toBe(true);
    });

    it('should find documents by content keywords', () => {
      const index = new SearchIndex<SearchableDocument>();
      index.addDocuments(testDocs);

      const results = index.search('publishers subscribers');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.item.id === 'doc2')).toBe(true);
    });

    it('should find documents by topic', () => {
      const index = new SearchIndex<SearchableDocument>();
      index.addDocuments(testDocs);

      const results = index.search('testing');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.item.id === 'doc3')).toBe(true);
    });

    it('should return empty array for non-matching query', () => {
      const index = new SearchIndex<SearchableDocument>();
      index.addDocuments(testDocs);

      const results = index.search('nonexistentterm12345');

      expect(results.length).toBe(0);
    });
  });

  describe('fuzzy matching', () => {
    it('should find documents with slight typos', () => {
      const index = new SearchIndex<SearchableDocument>();
      index.addDocuments(testDocs);

      // "swiftui" with typo "swiftiu"
      const results = index.search('swiftiu', { fuzzy: 0.3 });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect fuzzy threshold', () => {
      const index = new SearchIndex<SearchableDocument>();
      index.addDocuments(testDocs);

      // Very strict fuzzy - should not match typos
      const strictResults = index.search('swiftiu', { fuzzy: 0 });
      const lenientResults = index.search('swiftiu', { fuzzy: 0.4 });

      expect(lenientResults.length).toBeGreaterThanOrEqual(strictResults.length);
    });
  });

  describe('score filtering', () => {
    it('should filter results by minimum score', () => {
      const index = new SearchIndex<SearchableDocument>();
      index.addDocuments(testDocs);

      const allResults = index.search('swift');
      const filteredResults = index.search('swift', { minScore: 5 });

      expect(allResults.length).toBeGreaterThanOrEqual(filteredResults.length);
    });
  });

  describe('document management', () => {
    it('should clear old documents when adding new ones', () => {
      const index = new SearchIndex<SearchableDocument>();
      index.addDocuments(testDocs);

      const newDocs = [{
        id: 'new1',
        title: 'New document about Kotlin',
        content: 'This is about Kotlin, not Swift',
        topics: ['kotlin'],
      }];
      index.addDocuments(newDocs);

      const swiftResults = index.search('SwiftUI');
      const kotlinResults = index.search('Kotlin');

      expect(swiftResults.length).toBe(0);
      expect(kotlinResults.length).toBe(1);
    });
  });
});

describe('fuzzySearch helper', () => {
  it('should provide standalone fuzzy search', () => {
    const results = fuzzySearch(testDocs, 'async await');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.id).toBe('doc1');
  });

  it('should return results with scores', () => {
    const results = fuzzySearch(testDocs, 'SwiftUI');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('score');
    expect(results[0]).toHaveProperty('matches');
  });
});

describe('combineScores', () => {
  it('should combine search and static relevance scores', () => {
    const combined = combineScores(10, 80);

    expect(combined).toBeGreaterThan(0);
    expect(combined).toBeLessThanOrEqual(100);
  });

  it('should respect search weight parameter', () => {
    const highSearchWeight = combineScores(10, 50, 0.9);
    const lowSearchWeight = combineScores(10, 50, 0.1);

    // With high search weight, search score matters more
    // With low search weight, static relevance matters more
    expect(highSearchWeight).not.toBe(lowSearchWeight);
  });

  it('should cap scores at 100', () => {
    const combined = combineScores(100, 100, 0.5);

    expect(combined).toBeLessThanOrEqual(100);
  });

  it('should handle zero scores', () => {
    const combined = combineScores(0, 0);

    expect(combined).toBe(0);
  });
});

describe('suggestSimilar', () => {
  const knownTerms = ['swiftui', 'combine', 'async', 'await', 'protocol', 'struct'];

  it('should suggest similar terms for typos', () => {
    const suggestions = suggestSimilar('swiftiu', knownTerms);

    expect(suggestions).toContain('swiftui');
  });

  it('should not suggest exact matches', () => {
    const suggestions = suggestSimilar('swiftui', knownTerms);

    expect(suggestions).not.toContain('swiftui');
  });

  it('should respect max suggestions limit', () => {
    const suggestions = suggestSimilar('s', knownTerms, 2);

    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it('should return empty array for very different terms', () => {
    const suggestions = suggestSimilar('xyzabc123', knownTerms);

    expect(suggestions.length).toBe(0);
  });

  it('should sort by similarity (Levenshtein distance)', () => {
    const suggestions = suggestSimilar('async', ['asyncc', 'asyncxx', 'asyn']);

    // 'asyn' has distance 1, 'asyncc' has distance 1, 'asyncxx' has distance 2
    expect(suggestions.length).toBeGreaterThan(0);
  });
});

describe('tokenization', () => {
  it('should preserve Swift-specific terms without stemming', () => {
    const index = new SearchIndex<SearchableDocument>();
    const docs = [{
      id: 'test1',
      title: 'SwiftUI and Combine',
      content: 'Using async await with SwiftUI',
      topics: ['swiftui', 'combine'],
    }];
    index.addDocuments(docs);

    // These terms should match exactly without stemming issues
    const swiftuiResults = index.search('swiftui');
    const asyncResults = index.search('async');

    expect(swiftuiResults.length).toBe(1);
    expect(asyncResults.length).toBe(1);
  });

  it('should handle hyphenated terms', () => {
    const index = new SearchIndex<SearchableDocument>();
    const docs = [{
      id: 'test1',
      title: 'Async-await patterns',
      content: 'Learn about async-await in Swift',
      topics: ['concurrency'],
    }];
    index.addDocuments(docs);

    const results = index.search('async await');

    expect(results.length).toBe(1);
  });
});
