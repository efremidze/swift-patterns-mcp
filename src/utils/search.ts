// src/utils/search.ts
// Advanced search utilities with fuzzy matching and smart stemming

import MiniSearch from 'minisearch';
import natural from 'natural';
import { normalizeTokens } from './search-terms.js';

// Porter Stemmer for English
const stemmer = natural.PorterStemmer;

export interface SearchableDocument {
  id: string;
  title: string;
  content: string;
  topics: string[];
}

interface SearchResult<T> {
  item: T;
  score: number;
  matches: string[];
}

interface SearchOptions {
  fuzzy?: number;           // Fuzzy matching threshold (0-1, default 0.2)
  boost?: Record<string, number>;  // Field boosting
  minScore?: number;        // Minimum score threshold
}

// Custom tokenizer with smart hyphen handling and stemming
function tokenize(text: string): string[] {
  return normalizeTokens(text, (token) => stemmer.stem(token));
}

// Process query with same tokenization for consistent matching
function processQuery(query: string): string[] {
  return tokenize(query);
}

export class SearchIndex<T extends SearchableDocument> {
  private miniSearch: MiniSearch<T>;
  private documents: Map<string, T> = new Map();

  constructor(fields: string[] = ['title', 'content', 'topics']) {
    this.miniSearch = new MiniSearch<T>({
      fields,
      storeFields: ['id'],
      tokenize, // Uses our new smart tokenizer
      processTerm: (term) => term, // Already processed by tokenize
      searchOptions: {
        boost: { title: 2, topics: 1.5, content: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  addDocuments(docs: T[]): void {
    // Clear existing documents
    this.miniSearch.removeAll();
    this.documents.clear();

    // Preprocess documents for indexing
    const processedDocs = docs.map(doc => ({
      ...doc,
      // Join topics array for indexing
      topics: Array.isArray(doc.topics) ? doc.topics.join(' ') : doc.topics,
    }));

    // Add to MiniSearch
    this.miniSearch.addAll(processedDocs);

    // Store original documents for retrieval
    docs.forEach(doc => this.documents.set(doc.id, doc));
  }

  search(query: string, options: SearchOptions = {}): SearchResult<T>[] {
    const {
      fuzzy = 0.2,
      boost = { title: 2, topics: 1.5, content: 1 },
      minScore = 0,
    } = options;

    // Get stemmed query terms for match highlighting
    const queryTerms = processQuery(query);

    // Search with MiniSearch
    const results = this.miniSearch.search(query, {
      fuzzy,
      prefix: true,
      boost,
      combineWith: 'OR',
    });

    // Map results to original documents with scores
    return results
      .filter(result => result.score >= minScore)
      .map(result => {
        const doc = this.documents.get(result.id);
        if (!doc) return null;

        // Find which terms matched
        const matches = this.findMatches(doc, queryTerms);

        return {
          item: doc,
          score: result.score,
          matches,
        };
      })
      .filter((r): r is SearchResult<T> => r !== null);
  }

  private findMatches(doc: T, queryTerms: string[]): string[] {
    const matches: string[] = [];
    const searchText = `${doc.title} ${doc.content} ${doc.topics.join(' ')}`.toLowerCase();

    for (const term of queryTerms) {
      // Check both stemmed and original
      if (searchText.includes(term)) {
        matches.push(term);
      }
    }

    return [...new Set(matches)];
  }
}

// Standalone search function for simple use cases
export function fuzzySearch<T extends SearchableDocument>(
  documents: T[],
  query: string,
  options: SearchOptions = {}
): SearchResult<T>[] {
  const index = new SearchIndex<T>();
  index.addDocuments(documents);
  return index.search(query, options);
}

// Get search relevance score (combines MiniSearch score with static relevance)
export function combineScores(
  searchScore: number,
  staticRelevance: number,
  searchWeight: number = 0.8
): number {
  // Normalize search score (MiniSearch scores can vary widely)
  // Divide by 5 to spread scores further apart (was /10)
  const normalizedSearch = Math.min(searchScore / 5, 1) * 100;

  // Weighted combination: heavily favor query-aware search score (80%)
  // over static quality score (20%)
  let combined = Math.round(
    normalizedSearch * searchWeight +
    staticRelevance * (1 - searchWeight)
  );

  // Cap score at 50 when search relevance is very low — prevents
  // irrelevant content from scoring high just because it's "quality" content
  if (searchScore < 1.0) {
    combined = Math.min(combined, 50);
  }

  return combined;
}

// Suggest similar terms (for "did you mean?" functionality)
export function suggestSimilar(
  query: string,
  knownTerms: string[],
  maxSuggestions: number = 3
): string[] {
  const queryLower = query.toLowerCase();

  // Calculate Levenshtein distance
  const suggestions = knownTerms
    .map(term => ({
      term,
      distance: natural.LevenshteinDistance(queryLower, term.toLowerCase()),
    }))
    .filter(({ distance }) => distance <= 3 && distance > 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions)
    .map(({ term }) => term);

  return suggestions;
}

/**
 * CachedSearchIndex - Manages a SearchIndex with automatic invalidation based on document changes.
 * Eliminates duplicated search caching logic across pattern sources.
 */
export class CachedSearchIndex<T extends SearchableDocument> {
  private searchIndex: SearchIndex<T> | null = null;
  private indexedPatternsHash: string | null = null;
  private fields: string[];

  constructor(fields: string[] = ['title', 'content', 'topics']) {
    this.fields = fields;
  }

  /**
   * Search patterns with automatic index caching.
   * Index is rebuilt only when patterns change (detected via hash).
   */
  search(
    patterns: T[],
    query: string,
    options: SearchOptions = {}
  ): T[] {
    const {
      fuzzy = 0.2,
      boost = { title: 2.5, topics: 1.8, content: 1 },
    } = options;

    // O(n) additive fingerprint — order-insensitive, no allocations
    let hash = 0;
    for (const p of patterns) {
      for (let i = 0; i < p.id.length; i++) {
        hash = (hash + p.id.charCodeAt(i) * (i + 1)) | 0;
      }
    }
    const patternsHash = `${patterns.length}:${hash}`;

    // Rebuild index only if patterns changed
    if (!this.searchIndex || this.indexedPatternsHash !== patternsHash) {
      this.searchIndex = new SearchIndex<T>(this.fields);
      this.searchIndex.addDocuments(patterns);
      this.indexedPatternsHash = patternsHash;
    }

    const results = this.searchIndex.search(query, { fuzzy, boost });

    // Normalize MiniSearch scores relative to the best result in this query.
    // This ensures the best match gets ~100 and poor matches scale down
    // proportionally, regardless of absolute MiniSearch score magnitude.
    const maxSearchScore = results.length > 0
      ? Math.max(...results.map(r => r.score))
      : 1;

    return results
      .map(result => {
        const normalizedSearch = maxSearchScore > 0
          ? (result.score / maxSearchScore) * 100
          : 0;
        const staticRelevance = (result.item as T & { relevanceScore: number }).relevanceScore;

        // 80% query-aware search score, 20% static quality
        let combined = Math.round(normalizedSearch * 0.8 + staticRelevance * 0.2);

        // Cap at 50 when raw search score is very low relative to best match —
        // prevents irrelevant content scoring high on static quality alone
        if (result.score < maxSearchScore * 0.1) {
          combined = Math.min(combined, 50);
        }

        return {
          ...result.item,
          relevanceScore: combined,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Invalidate the cached index (call after fetching new patterns)
   */
  invalidate(): void {
    this.searchIndex = null;
    this.indexedPatternsHash = null;
  }
}

