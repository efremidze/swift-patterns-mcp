// src/utils/memvid-memory.ts
// Memvid integration for persistent semantic memory and caching

import { use, type Memvid } from '@memvid/sdk';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { getSwiftMcpDir } from './paths.js';
import logger from './logger.js';
import type { BasePattern } from '../sources/free/rssPatternSource.js';

const MEMORY_FILE = 'swift-patterns-memory.mv2';

// Score scaling constant for converting memvid scores (0-1) to pattern scores (0-100)
const SCORE_SCALE_FACTOR = 10;

/**
 * Extended pattern with source and author for memvid storage
 */
interface ExtendedPattern extends BasePattern {
  source?: string;
  author?: string;
}

/**
 * Helper to enrich patterns with source information for storage
 */
function enrichPatternWithSource(pattern: BasePattern, sourceName: string): ExtendedPattern {
  return {
    ...pattern,
    source: sourceName,
  };
}

/**
 * Options for storing patterns in memvid
 */
export interface MemvidStoreOptions {
  enableEmbedding?: boolean;
  embeddingModel?: string;
  sourceName?: string; // Source identifier to tag patterns
}

/**
 * Options for searching memvid memory
 */
export interface MemvidSearchOptions {
  k?: number;
  mode?: 'lex' | 'sem' | 'auto';
  snippetChars?: number;
}

/**
 * MemvidMemoryManager - Manages persistent memory storage using memvid
 * 
 * Features:
 * - Persistent storage of patterns with full-text and semantic search
 * - Automatic deduplication based on pattern IDs
 * - Cross-session memory that evolves over time
 * - Semantic similarity search for improved recall
 */
export class MemvidMemoryManager {
  private memoryPath: string;
  private memory: Memvid | null = null;
  private initialized = false;

  constructor() {
    this.memoryPath = join(getSwiftMcpDir(), MEMORY_FILE);
  }

  /**
   * Initialize memvid memory (create or open existing)
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.memory) {
      return;
    }

    try {
      // Ensure the directory exists
      const dir = dirname(this.memoryPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Try to open existing memory, or create if it doesn't exist
      if (existsSync(this.memoryPath)) {
        this.memory = await use('basic', this.memoryPath, { mode: 'open' });
      } else {
        const { create } = await import('@memvid/sdk');
        this.memory = await create(this.memoryPath);
      }
      
      this.initialized = true;
      logger.info({ path: this.memoryPath }, 'Memvid memory initialized');
    } catch (error) {
      logger.error({ err: error, path: this.memoryPath }, 'Failed to initialize memvid memory');
      throw error;
    }
  }

  /**
   * Store a single pattern in memvid memory
   */
  async storePattern(
    pattern: BasePattern,
    options: MemvidStoreOptions = {}
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      // Enrich with source if provided in options
      const enriched = options.sourceName 
        ? enrichPatternWithSource(pattern, options.sourceName)
        : pattern as ExtendedPattern;
      const source = enriched.source || 'unknown';
      const uri = `mv2://patterns/${source}/${pattern.id}`;

      // Store pattern with searchable content
      await this.memory!.put({
        title: pattern.title,
        label: source,
        text: `${pattern.title}\n\n${pattern.excerpt || pattern.content}`,
        uri,
        metadata: {
          id: pattern.id,
          source: source,
          author: enriched.author || '',
          publishDate: pattern.publishDate,
          relevanceScore: pattern.relevanceScore,
          hasCode: pattern.hasCode,
          url: pattern.url,
        },
        tags: pattern.topics,
        enableEmbedding: options.enableEmbedding,
        embeddingModel: options.embeddingModel,
      });
    } catch (error) {
      logger.warn({ err: error, patternId: pattern.id }, 'Failed to store pattern in memvid');
      // Don't throw - memvid failures shouldn't break the main flow
    }
  }

  /**
   * Store multiple patterns in bulk (more efficient)
   */
  async storePatterns(
    patterns: BasePattern[],
    options: MemvidStoreOptions = {}
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const documents = patterns.map(pattern => {
        // Enrich with source if provided in options
        const enriched = options.sourceName 
          ? enrichPatternWithSource(pattern, options.sourceName)
          : pattern as ExtendedPattern;
        const source = enriched.source || 'unknown';
        
        return {
          title: pattern.title,
          label: source,
          text: `${pattern.title}\n\n${pattern.excerpt || pattern.content}`,
          uri: `mv2://patterns/${source}/${pattern.id}`,
          metadata: {
            id: pattern.id,
            source: source,
            author: enriched.author || '',
            publishDate: pattern.publishDate,
            relevanceScore: pattern.relevanceScore,
            hasCode: pattern.hasCode,
            url: pattern.url,
          },
          tags: pattern.topics,
          enableEmbedding: options.enableEmbedding,
          embeddingModel: options.embeddingModel,
        };
      });

      await this.memory!.putMany(documents);
      logger.info({ count: patterns.length }, 'Stored patterns in memvid memory');
    } catch (error) {
      logger.warn({ err: error, count: patterns.length }, 'Failed to store patterns in memvid');
      // Don't throw - memvid failures shouldn't break the main flow
    }
  }

  /**
   * Search memvid memory for relevant patterns
   * Note: Returns reconstructed BasePattern objects using snippet and tags
   */
  async search(
    query: string,
    options: MemvidSearchOptions = {}
  ): Promise<BasePattern[]> {
    await this.ensureInitialized();

    try {
      const results = await this.memory!.find(query, {
        k: options.k || 10,
        mode: options.mode || 'auto',
        snippetChars: options.snippetChars || 240,
      });

      // Convert memvid hits back to BasePattern format
      // Note: We use snippet as content since full text isn't returned
      // hasCode detection: check for common code indicators in snippet
      const codePatterns = /```|`\w+`|func |class |struct |let |var |import /;
      
      return results.hits.map(hit => ({
        id: hit.uri?.split('/').pop() || '',
        title: hit.title || '',
        url: hit.uri || '',
        publishDate: hit.created_at || '',
        excerpt: hit.snippet || '',
        content: hit.snippet || '', // Use snippet as content for search results
        topics: hit.tags || [],
        // Heuristic: detect code in snippet for better hasCode accuracy
        hasCode: codePatterns.test(hit.snippet || ''),
        // Scale memvid score (0-1 range) to pattern relevanceScore (0-100 range)
        relevanceScore: Math.round(hit.score * SCORE_SCALE_FACTOR),
      }));
    } catch (error) {
      logger.warn({ err: error, query }, 'Failed to search memvid memory');
      return []; // Return empty on error
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{ frameCount: number; sizeBytes: number }> {
    await this.ensureInitialized();

    try {
      const stats = await this.memory!.stats();
      return {
        frameCount: stats.frame_count || 0,
        sizeBytes: stats.size_bytes || 0,
      };
    } catch (error) {
      logger.warn({ err: error }, 'Failed to get memvid stats');
      return { frameCount: 0, sizeBytes: 0 };
    }
  }

  /**
   * Close memvid memory
   */
  async close(): Promise<void> {
    if (this.memory) {
      try {
        await this.memory.seal();
        this.memory = null;
        this.initialized = false;
        logger.info('Memvid memory closed');
      } catch (error) {
        logger.warn({ err: error }, 'Failed to close memvid memory');
      }
    }
  }

  /**
   * Ensure memvid is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized || !this.memory) {
      await this.initialize();
    }
  }
}

// Singleton instance
let memoryManager: MemvidMemoryManager | null = null;

/**
 * Get the singleton memvid memory manager
 */
export function getMemvidMemory(): MemvidMemoryManager {
  if (!memoryManager) {
    memoryManager = new MemvidMemoryManager();
  }
  return memoryManager;
}

/**
 * Close the memvid memory manager (for cleanup)
 */
export async function closeMemvidMemory(): Promise<void> {
  if (memoryManager) {
    await memoryManager.close();
    memoryManager = null;
  }
}
