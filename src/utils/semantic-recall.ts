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

// Module-scope shared pipeline (survives across SemanticRecallIndex instances)
let sharedPipeline: any = null;
let pipelinePromise: Promise<any> | null = null;

async function getSharedPipeline(): Promise<any> {
  if (sharedPipeline) return sharedPipeline;
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = false;
      sharedPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        model_file_name: 'model_uint8.onnx',
      });
      return sharedPipeline;
    })();
  }
  return pipelinePromise;
}

/** Eagerly start loading the embedding model. Fire-and-forget, safe to call multiple times. */
export function prefetchEmbeddingModel(): void {
  getSharedPipeline().catch(() => {});
}

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
 * Uses extractIndexableContent to ensure hash matches embedding input
 */
function getContentHash(pattern: BasePattern): string {
  const content = extractIndexableContent(pattern);
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

interface IndexedPattern {
  pattern: BasePattern;
  embedding: Float32Array;
  cacheKey: string;
}

export class SemanticRecallIndex {
  private indexedMap: Map<string, IndexedPattern> = new Map();
  private cache: FileCache;
  private config: SemanticRecallConfig;

  constructor(config: SemanticRecallConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.cache = new FileCache('semantic-embeddings');
  }

  /**
   * Generate embedding for text using the shared module-scope pipeline
   */
  private async embed(text: string): Promise<Float32Array> {
    const pipe = await getSharedPipeline();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return output.data;
  }

  /**
   * Index patterns for semantic search.
   * Filters patterns by minRelevanceScore and caches embeddings.
   * Uses incremental indexing - only processes new/changed patterns.
   */
  async index(patterns: BasePattern[]): Promise<void> {
    // Filter patterns by relevance score
    const highQualityPatterns = patterns.filter(
      p => p.relevanceScore >= this.config.minRelevanceScore
    );

    // Build set of current cache keys to track what should remain
    const currentKeys = new Set<string>();

    // Index each pattern (incremental - skip unchanged patterns)
    for (const pattern of highQualityPatterns) {
      const contentHash = getContentHash(pattern);
      const cacheKey = `embedding::${pattern.id}::${contentHash}`;
      currentKeys.add(cacheKey);

      // Skip if already indexed with same content hash
      if (this.indexedMap.has(cacheKey)) {
        // Update pattern reference in case metadata changed (but content hash same)
        const existing = this.indexedMap.get(cacheKey)!;
        existing.pattern = pattern;
        continue;
      }

      // Try to load from file cache
      const embedding = await this.cache.get<number[]>(cacheKey);

      if (embedding) {
        // File cache hit - use cached embedding
        this.indexedMap.set(cacheKey, {
          pattern,
          embedding: new Float32Array(embedding),
          cacheKey,
        });
      } else {
        // Cache miss - compute embedding
        const content = extractIndexableContent(pattern);
        const embeddingArray = await this.embed(content);

        // Store in file cache (convert Float32Array to regular array for JSON serialization)
        await this.cache.set(cacheKey, Array.from(embeddingArray), 86400 * 7); // 7 days TTL

        this.indexedMap.set(cacheKey, {
          pattern,
          embedding: embeddingArray,
          cacheKey,
        });
      }
    }

    // Remove patterns no longer in the input set
    for (const key of this.indexedMap.keys()) {
      if (!currentKeys.has(key)) {
        this.indexedMap.delete(key);
      }
    }
  }

  /**
   * Search indexed patterns by semantic similarity.
   * Returns top-K patterns sorted by cosine similarity.
   */
  async search(query: string, limit: number): Promise<BasePattern[]> {
    if (this.indexedMap.size === 0) {
      return [];
    }

    // Generate query embedding
    const queryEmbedding = await this.embed(query);

    // Calculate cosine similarity for each indexed pattern
    const { similarity } = await import('ml-distance');

    const scored = Array.from(this.indexedMap.values()).map(({ pattern, embedding }) => ({
      pattern,
      similarity: similarity.cosine(queryEmbedding, embedding),
    }));

    // Sort by similarity descending and return top-K
    scored.sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, limit).map(s => s.pattern);
  }

  /**
   * Get the number of indexed patterns (for testing/debugging)
   */
  get size(): number {
    return this.indexedMap.size;
  }
}
