// src/utils/semantic-recall.ts
// Semantic recall fallback for lexical search using embeddings

import { createHash } from 'crypto';
import { FileCache } from './cache.js';
import type { BasePattern } from '../sources/free/rssPatternSource.js';

export interface SemanticRecallConfig {
  enabled: boolean;
  minLexicalScore: number;
  minRelevanceScore: number;
}

export const DEFAULT_CONFIG: SemanticRecallConfig = {
  enabled: false,
  minLexicalScore: 0.35,
  minRelevanceScore: 70,
};

/**
 * Extract indexable content from pattern (title + excerpt only, not full content)
 */
function extractIndexableContent(pattern: BasePattern): string {
  const title = pattern.title || '';
  const excerpt = pattern.excerpt || pattern.content?.substring(0, 500) || '';

  // Concatenate title and excerpt for embedding
  return `${title} ${excerpt}`.trim();
}

/**
 * Generate content hash for cache key
 */
function getContentHash(pattern: BasePattern): string {
  const title = pattern.title || '';
  const excerpt = pattern.excerpt || pattern.content?.substring(0, 500) || '';
  const content = `${title}${excerpt}`;

  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

interface IndexedPattern {
  pattern: BasePattern;
  embedding: Float32Array;
}

export class SemanticRecallIndex {
  private indexed: IndexedPattern[] = [];
  private cache: FileCache;
  private pipeline: any = null; // Lazy-loaded transformer pipeline
  private config: SemanticRecallConfig;

  constructor(config: SemanticRecallConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.cache = new FileCache('semantic-embeddings');
  }

  /**
   * Lazy-load the transformer pipeline
   */
  private async getEmbeddingPipeline() {
    if (!this.pipeline) {
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = false; // Use remote models only
      this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return this.pipeline;
  }

  /**
   * Generate embedding for text
   */
  private async embed(text: string): Promise<Float32Array> {
    const pipe = await this.getEmbeddingPipeline();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return output.data;
  }

  /**
   * Index patterns for semantic search.
   * Filters patterns by minRelevanceScore and caches embeddings.
   */
  async index(patterns: BasePattern[]): Promise<void> {
    // Clear existing index
    this.indexed = [];

    // Filter patterns by relevance score
    const highQualityPatterns = patterns.filter(
      p => p.relevanceScore >= this.config.minRelevanceScore
    );

    // Index each pattern
    for (const pattern of highQualityPatterns) {
      const contentHash = getContentHash(pattern);
      const cacheKey = `embedding::${pattern.id}::${contentHash}`;

      // Try to load from cache
      const embedding = await this.cache.get<number[]>(cacheKey);

      if (embedding) {
        // Cache hit - use cached embedding
        this.indexed.push({
          pattern,
          embedding: new Float32Array(embedding),
        });
      } else {
        // Cache miss - compute embedding
        const content = extractIndexableContent(pattern);
        const embeddingArray = await this.embed(content);

        // Store in cache (convert Float32Array to regular array for JSON serialization)
        await this.cache.set(cacheKey, Array.from(embeddingArray), 86400 * 7); // 7 days TTL

        this.indexed.push({
          pattern,
          embedding: embeddingArray,
        });
      }
    }
  }

  /**
   * Search indexed patterns by semantic similarity.
   * Returns top-K patterns sorted by cosine similarity.
   */
  async search(query: string, limit: number): Promise<BasePattern[]> {
    if (this.indexed.length === 0) {
      return [];
    }

    // Generate query embedding
    const queryEmbedding = await this.embed(query);

    // Calculate cosine similarity for each indexed pattern
    const { similarity } = await import('ml-distance');

    const scored = this.indexed.map(({ pattern, embedding }) => ({
      pattern,
      similarity: similarity.cosine(queryEmbedding, embedding),
    }));

    // Sort by similarity descending and return top-K
    scored.sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, limit).map(s => s.pattern);
  }
}
