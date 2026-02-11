// src/utils/__tests__/cache.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fsp from 'fs/promises';
import path from 'path';
import { FileCache } from '../cache.js';
import { getCacheDir } from '../paths.js';

let namespaceCounter = 0;
function uniqueNamespace(): string {
  namespaceCounter += 1;
  return `cache-test-${Date.now()}-${namespaceCounter}`;
}

function toCacheFilename(key: string): string {
  if (key.length > 100) {
    // 32 chars md5 hex length used by FileCache implementation.
    return `${'x'.repeat(32)}.json`;
  }
  return `${key.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
}

function getCacheNamespace(cache: FileCache): string {
  const cacheDir = (cache as unknown as { cacheDir: string }).cacheDir;
  return path.basename(cacheDir);
}

describe('FileCache', () => {
  let cache: FileCache;

  beforeEach(() => {
    cache = new FileCache(uniqueNamespace(), 50);
  });

  afterEach(async () => {
    await cache.clear();
  });

  // ─── get / set basics ───

  describe('get/set basics', () => {
    it('should return null for non-existent key', async () => {
      const result = await cache.get('missing');
      expect(result).toBeNull();
    });

    it('should store and retrieve a string value', async () => {
      await cache.set('key1', 'hello');
      const result = await cache.get<string>('key1');
      expect(result).toBe('hello');
    });

    it('should store and retrieve complex objects', async () => {
      const complex = {
        name: 'test',
        nested: { a: 1, b: [2, 3] },
        tags: ['swift', 'swiftui'],
      };
      await cache.set('complex', complex);
      const result = await cache.get<typeof complex>('complex');
      expect(result).toEqual(complex);
    });

    it('should return null after TTL expires', async () => {
      vi.useFakeTimers();
      try {
        await cache.set('ttl-key', 'value', 1); // 1 second TTL

        // Still valid immediately
        const before = await cache.get('ttl-key');
        expect(before).toBe('value');

        // Advance past TTL
        vi.advanceTimersByTime(2000);

        const after = await cache.get('ttl-key');
        expect(after).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // ─── memory vs file cache ───

  describe('memory vs file cache', () => {
    it('should serve from memory on repeated get', async () => {
      await cache.set('mem-key', 'data');

      // First get populates memory from set()
      const first = await cache.get('mem-key');
      expect(first).toBe('data');

      // Second get should still return the same value (from memory)
      const second = await cache.get('mem-key');
      expect(second).toBe('data');
    });

    it('should fall back to file cache when memory misses', async () => {
      const ns = uniqueNamespace();
      const cache1 = new FileCache(ns, 50);

      await cache1.set('persist', 'file-data');

      // Create new instance with same namespace — empty memory, same file dir
      const cache2 = new FileCache(ns, 50);
      const result = await cache2.get<string>('persist');

      expect(result).toBe('file-data');

      await cache1.clear();
    });

    it('should evict expired entries from memory on get', async () => {
      vi.useFakeTimers();
      try {
        await cache.set('expire-mem', 'old', 1); // 1 second TTL

        // Still in memory
        expect(await cache.get('expire-mem')).toBe('old');

        // Advance past expiry
        vi.advanceTimersByTime(2000);

        // Should return null (expired in memory)
        expect(await cache.get('expire-mem')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // ─── getOrFetch ───

  describe('getOrFetch', () => {
    it('should call fetcher on cache miss and cache the result', async () => {
      let called = false;
      const result = await cache.getOrFetch('fetch-key', async () => {
        called = true;
        return 42;
      });

      expect(called).toBe(true);
      expect(result).toBe(42);

      // Should now be cached
      const cached = await cache.get<number>('fetch-key');
      expect(cached).toBe(42);
    });

    it('should return cached value without calling fetcher', async () => {
      await cache.set('pre-cached', 'existing');

      let called = false;
      const result = await cache.getOrFetch('pre-cached', async () => {
        called = true;
        return 'new';
      });

      expect(called).toBe(false);
      expect(result).toBe('existing');
    });

    it('should deduplicate concurrent identical fetches', async () => {
      let fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        await new Promise(r => setTimeout(r, 50));
        return 'deduped';
      };

      const promises = Array.from({ length: 5 }, () =>
        cache.getOrFetch('dedup-key', fetcher)
      );

      const results = await Promise.all(promises);

      expect(fetchCount).toBe(1);
      results.forEach(r => expect(r).toBe('deduped'));
    });

    it('should fetch separately for different keys', async () => {
      let fetchCount = 0;
      const fetcher = (id: string) => async () => {
        fetchCount++;
        await new Promise(r => setTimeout(r, 30));
        return id;
      };

      const [a, b] = await Promise.all([
        cache.getOrFetch('key-a', fetcher('a')),
        cache.getOrFetch('key-b', fetcher('b')),
      ]);

      expect(fetchCount).toBe(2);
      expect(a).toBe('a');
      expect(b).toBe('b');
    });
  });

  // ─── clear ───

  describe('clear', () => {
    it('should remove all entries', async () => {
      await cache.set('c1', 'v1');
      await cache.set('c2', 'v2');

      await cache.clear();

      expect(await cache.get('c1')).toBeNull();
      expect(await cache.get('c2')).toBeNull();
    });
  });

  // ─── clearExpired ───

  describe('clearExpired', () => {
    it('should remove expired entries and return count', async () => {
      vi.useFakeTimers();
      try {
        await cache.set('exp1', 'a', 1);
        await cache.set('exp2', 'b', 1);
        await cache.set('fresh', 'c', 3600);

        vi.advanceTimersByTime(2000);

        const cleared = await cache.clearExpired();
        expect(cleared).toBeGreaterThanOrEqual(2);

        // Fresh entry should remain
        expect(await cache.get('fresh')).toBe('c');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should keep non-expired entries', async () => {
      await cache.set('keep1', 'x', 3600);
      await cache.set('keep2', 'y', 3600);

      const cleared = await cache.clearExpired();
      expect(cleared).toBe(0);

      expect(await cache.get('keep1')).toBe('x');
      expect(await cache.get('keep2')).toBe('y');
    });
  });

  // ─── key handling ───

  describe('key handling', () => {
    it('should sanitize special characters in keys', async () => {
      await cache.set('key/with:special chars!', 'sanitized');
      const result = await cache.get<string>('key/with:special chars!');
      expect(result).toBe('sanitized');
    });

    it('should hash keys longer than 100 characters', async () => {
      const longKey = 'a'.repeat(150);
      await cache.set(longKey, 'hashed');
      const result = await cache.get<string>(longKey);
      expect(result).toBe('hashed');
    });

    it('documents sanitization collisions for different raw keys', async () => {
      const keyA = 'team/a';
      const keyB = 'team:a';

      await cache.set(keyA, 'first');
      await cache.set(keyB, 'second');

      const a = await cache.get<string>(keyA);
      const b = await cache.get<string>(keyB);

      expect(a).toBe('first');
      expect(b).toBe('second');

      await cache.clear();
      const namespace = getCacheNamespace(cache);
      const collisionPath = path.join(getCacheDir(namespace), toCacheFilename('team/a'));
      await fsp.writeFile(collisionPath, JSON.stringify({ data: 'from-file', timestamp: Date.now(), ttl: 3600 }));

      const rehydrated = new FileCache(namespace, 50);
      const aFromFile = await rehydrated.get<string>(keyA);
      const bFromFile = await rehydrated.get<string>(keyB);

      expect(aFromFile).toBe('from-file');
      expect(bFromFile).toBe('from-file');
      await rehydrated.clear();
    });
  });

  describe('corrupt and unreadable cache files', () => {
    it('returns null for corrupt JSON cache file', async () => {
      const namespace = getCacheNamespace(cache);
      const cachePath = path.join(getCacheDir(namespace), toCacheFilename('corrupt-key'));

      await fsp.writeFile(cachePath, '{not-valid-json');

      await expect(cache.get('corrupt-key')).resolves.toBeNull();
    });

    it('returns null when cache path points to unreadable entry type', async () => {
      const namespace = getCacheNamespace(cache);
      const cachePath = path.join(getCacheDir(namespace), toCacheFilename('unreadable-key'));

      await fsp.mkdir(cachePath, { recursive: true });

      await expect(cache.get('unreadable-key')).resolves.toBeNull();
    });
  });
});
