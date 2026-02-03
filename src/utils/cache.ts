// src/utils/cache.ts

import fs from 'fs';
import fsp from 'fs/promises';
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
  private inFlightFetches: Map<string, Promise<unknown>> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(namespace: string = 'default', maxMemoryEntries: number = DEFAULT_MAX_MEMORY_ENTRIES) {
    this.cacheDir = getCacheDir(namespace);
    this.memoryCache = new QuickLRU({ maxSize: maxMemoryEntries });
    this.ensureCacheDir();
    // Clean expired entries on startup (fire-and-forget)
    this.clearExpired().catch(() => {});
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  private startPeriodicCleanup(): void {
    // Avoid multiple intervals if constructor is called multiple times
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      this.clearExpired().catch(() => {});
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
    if (memEntry) {
      if (!this.isExpired(memEntry)) {
        return memEntry.data;
      }
      // Remove expired entry from memory cache
      this.memoryCache.delete(key);
    }

    // Check file cache
    const cachePath = this.getCachePath(key);
    try {
      const content = await fsp.readFile(cachePath, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry<T>;

      if (!this.isExpired(entry)) {
        // Populate memory cache
        this.memoryCache.set(key, entry);
        return entry.data;
      } else {
        // Clean up expired entry
        fsp.unlink(cachePath).catch(() => {});
      }
    } catch {
      // Cache read failed (file doesn't exist or is corrupted), return null
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

    // Set in file cache (async I/O, non-blocking to event loop)
    const cachePath = this.getCachePath(key);
    try {
      await fsp.writeFile(cachePath, JSON.stringify(entry));
    } catch {
      // Cache write failed, continue without caching
    }
  }

  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
    // Check cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check if a fetch is already in progress for this key
    const inFlight = this.inFlightFetches.get(key) as Promise<T> | undefined;
    if (inFlight) {
      return inFlight;
    }

    // Start a new fetch and track it
    const fetchPromise = (async () => {
      try {
        const data = await fetcher();
        await this.set(key, data, ttl);
        return data;
      } finally {
        // Remove from in-flight map when complete (success or failure)
        this.inFlightFetches.delete(key);
      }
    })();

    this.inFlightFetches.set(key, fetchPromise);
    return fetchPromise;
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    const age = (Date.now() - entry.timestamp) / 1000; // age in seconds
    return age > entry.ttl;
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      const files = await fsp.readdir(this.cacheDir);
      await Promise.allSettled(
        files.map(file => fsp.unlink(path.join(this.cacheDir, file)))
      );
    } catch {
      // Ignore errors during clear
    }
  }

  async clearExpired(): Promise<number> {
    let cleared = 0;

    // Clear expired from memory
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        cleared++;
      }
    }

    // Clear expired from files (async, parallel)
    try {
      const files = await fsp.readdir(this.cacheDir);
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const filePath = path.join(this.cacheDir, file);
          try {
            const content = await fsp.readFile(filePath, 'utf-8');
            const entry = JSON.parse(content) as CacheEntry<unknown>;
            if (this.isExpired(entry)) {
              await fsp.unlink(filePath);
              return 1;
            }
          } catch {
            // Skip files that can't be read or parsed — don't delete them
            // as they may be mid-write by another operation
            return 0;
          }
          return 0;
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') cleared += r.value;
      }
    } catch {
      // Directory may not exist
    }

    return cleared;
  }
}

// Shared cache instances
export const rssCache = new FileCache('rss');
export const articleCache = new FileCache('articles');
