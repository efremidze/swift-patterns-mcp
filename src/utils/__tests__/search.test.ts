// src/utils/search.test.ts

import { describe, it, expect } from 'vitest';
import { SearchIndex, SearchableDocument } from '../search.js';

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
