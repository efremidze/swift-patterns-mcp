// src/utils/cache.ts

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import QuickLRU from 'quick-lru';
import { getCacheDir } from './paths.js';

const DEFAULT_TTL = 86400; // 24 hours in seconds
const DEFAULT_MAX_MEMORY_ENTRIES = 100;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class FileCache {
  private cacheDir: string;
  private memoryCache: QuickLRU<string, CacheEntry<unknown>>;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(namespace: string = 'default', maxMemoryEntries: number = DEFAULT_MAX_MEMORY_ENTRIES) {
    this.cacheDir = getCacheDir(namespace);
    this.memoryCache = new QuickLRU({ maxSize: maxMemoryEntries });
    this.ensureCacheDir();
    // Clean expired entries on startup
    this.clearExpired();
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  private startPeriodicCleanup(): void {
    // Avoid multiple intervals if constructor is called multiple times
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      this.clearExpired();
    }, CLEANUP_INTERVAL_MS);
    // Don't keep the process alive just for cleanup
    this.cleanupInterval.unref();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCacheKey(key: string): string {
    // Hash long keys to avoid filesystem issues
    if (key.length > 100) {
      return createHash('md5').update(key).digest('hex');
    }
    // Sanitize key for filesystem
    return key.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${this.getCacheKey(key)}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.data;
    }

    // Check file cache
    const cachePath = this.getCachePath(key);
    try {
      if (fs.existsSync(cachePath)) {
        const content = fs.readFileSync(cachePath, 'utf-8');
        const entry = JSON.parse(content) as CacheEntry<T>;

        if (!this.isExpired(entry)) {
          // Populate memory cache
          this.memoryCache.set(key, entry);
          return entry.data;
        } else {
          // Clean up expired entry
          fs.unlinkSync(cachePath);
        }
      }
    } catch {
      // Cache read failed, return null
    }

    return null;
  }

  async set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
    };

    // Set in memory cache
    this.memoryCache.set(key, entry);

    // Set in file cache
    const cachePath = this.getCachePath(key);
    try {
      fs.writeFileSync(cachePath, JSON.stringify(entry));
    } catch {
      // Cache write failed, continue without caching
    }
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    const age = (Date.now() - entry.timestamp) / 1000; // age in seconds
    return age > entry.ttl;
  }

  clear(): void {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear file cache
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
    } catch {
      // Ignore errors during clear
    }
  }

  clearExpired(): number {
    let cleared = 0;

    // Clear expired from memory
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        cleared++;
      }
    }

    // Clear expired from files
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          const filePath = path.join(this.cacheDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const entry = JSON.parse(content) as CacheEntry<unknown>;
            if (this.isExpired(entry)) {
              fs.unlinkSync(filePath);
              cleared++;
            }
          } catch {
            // Remove corrupted cache files
            fs.unlinkSync(filePath);
            cleared++;
          }
        }
      }
    } catch {
      // Ignore errors during cleanup
    }

    return cleared;
  }
}

// Shared cache instances
export const rssCache = new FileCache('rss');
export const articleCache = new FileCache('articles');
