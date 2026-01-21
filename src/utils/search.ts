// src/utils/search.ts
// Advanced search utilities with fuzzy matching and smart stemming

import MiniSearch from 'minisearch';
import natural from 'natural';

// Porter Stemmer for English
const stemmer = natural.PorterStemmer;

// Common stopwords to filter out
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
  'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
  'i', 'my', 'me', 'he', 'she', 'him', 'her', 'his', 'who', 'what', 'which',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'same',
  'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there'
]);

// Swift-specific terms that shouldn't be stemmed (preserve technical accuracy)
// NOTE: If you add hyphenated terms here (e.g. "objective-c"), the tokenizer will now respect them.
const PRESERVE_TERMS = new Set([
  'swift', 'swiftui', 'uikit', 'combine', 'async', 'await', 'actor',
  'struct', 'class', 'enum', 'protocol', 'extension', 'func', 'var', 'let',
  'mvvm', 'viper', 'mvc', 'tca', 'xctest', 'xcode', 'ios', 'macos',
  'watchos', 'tvos', 'ipados', 'appkit', 'foundation', 'coredata',
  'cloudkit', 'urlsession', 'codable', 'observable', 'published',
  'stateobject', 'observedobject', 'environmentobject', 'binding', 'state'
]);

export interface SearchableDocument {
  id: string;
  title: string;
  content: string;
  topics: string[];
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matches: string[];
}

export interface SearchOptions {
  fuzzy?: number;           // Fuzzy matching threshold (0-1, default 0.2)
  boost?: Record<string, number>;  // Field boosting
  minScore?: number;        // Minimum score threshold
}

// Custom tokenizer with smart hyphen handling
function tokenize(text: string): string[] {
  // 1. Clean text but keep hyphens temporarily
  const rawTokens = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') 
    .split(/\s+/)
    .filter(t => t.length > 0);

  const finalTokens: string[] = [];

  for (const token of rawTokens) {
    // 2. Check if the full token is a preserved term (e.g., if you added "objective-c")
    if (PRESERVE_TERMS.has(token)) {
      finalTokens.push(token);
      continue;
    }

    // 3. If not preserved, split on hyphens to separate words like "async-await" -> "async", "await"
    const subTokens = token.split('-');

    for (const sub of subTokens) {
      if (sub.length <= 1 || STOPWORDS.has(sub)) continue;

      // 4. Check sub-tokens against preserved terms or stem them
      if (PRESERVE_TERMS.has(sub)) {
        finalTokens.push(sub);
      } else {
        finalTokens.push(stemmer.stem(sub));
      }
    }
  }

  return finalTokens;
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
  searchWeight: number = 0.6
): number {
  // Normalize search score (MiniSearch scores can vary widely)
  const normalizedSearch = Math.min(searchScore / 10, 1) * 100;

  // Weighted combination
  return Math.round(
    normalizedSearch * searchWeight +
    staticRelevance * (1 - searchWeight)
  );
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

    // Simple hash based on length and sorted IDs
    const patternsHash = `${patterns.length}-${patterns.map(p => p.id).sort().join(',')}`;

    // Rebuild index only if patterns changed
    if (!this.searchIndex || this.indexedPatternsHash !== patternsHash) {
      this.searchIndex = new SearchIndex<T>(this.fields);
      this.searchIndex.addDocuments(patterns);
      this.indexedPatternsHash = patternsHash;
    }

    const results = this.searchIndex.search(query, { fuzzy, boost });

    return results
      .map(result => ({
        ...result.item,
        relevanceScore: combineScores(result.score, (result.item as T & { relevanceScore: number }).relevanceScore),
      }))
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

export default SearchIndex;
