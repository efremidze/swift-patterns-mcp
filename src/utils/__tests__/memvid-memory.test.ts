// src/utils/memvid-memory.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemvidMemoryManager } from '../memvid-memory.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { getSwiftMcpDir } from '../paths.js';

const TEST_MEMORY_FILE = 'test-memory.mv2';

describe('MemvidMemoryManager', () => {
  let manager: MemvidMemoryManager;
  const testMemoryPath = join(getSwiftMcpDir(), TEST_MEMORY_FILE);

  // Clean up test memory file before and after tests
  beforeEach(() => {
    try {
      unlinkSync(testMemoryPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  afterEach(async () => {
    if (manager) {
      await manager.close();
    }
    try {
      unlinkSync(testMemoryPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  const samplePattern: BasePattern = {
    id: 'test-pattern-1',
    title: 'SwiftUI Animation Patterns',
    url: 'https://example.com/pattern-1',
    publishDate: '2024-01-15',
    excerpt: 'Learn how to create smooth animations in SwiftUI',
    content: 'SwiftUI provides powerful animation APIs including withAnimation and transition modifiers.',
    topics: ['swiftui', 'animation', 'ios'],
    hasCode: true,
    relevanceScore: 85,
  };

  it('should initialize successfully', async () => {
    manager = new MemvidMemoryManager(testMemoryPath);
    await expect(manager.initialize()).resolves.not.toThrow();
  });

  it('should store a single pattern', async () => {
    manager = new MemvidMemoryManager(testMemoryPath);
    await manager.initialize();

    await expect(
      manager.storePattern(samplePattern, { sourceName: 'test' })
    ).resolves.not.toThrow();

    const stats = await manager.getStats();
    expect(stats.frameCount).toBeGreaterThan(0);
  });

  it('should store multiple patterns in bulk', async () => {
    manager = new MemvidMemoryManager(testMemoryPath);
    await manager.initialize();

    const patterns: BasePattern[] = [
      samplePattern,
      {
        ...samplePattern,
        id: 'test-pattern-2',
        title: 'Async/Await in Swift',
        content: 'Modern concurrency with async/await',
        topics: ['swift', 'concurrency'],
      },
    ];

    await expect(
      manager.storePatterns(patterns, { sourceName: 'test' })
    ).resolves.not.toThrow();

    const stats = await manager.getStats();
    expect(stats.frameCount).toBeGreaterThanOrEqual(2);
  });

  it('should search stored patterns', async () => {
    manager = new MemvidMemoryManager(testMemoryPath);
    await manager.initialize();

    // Store patterns first
    await manager.storePattern(samplePattern, { sourceName: 'test' });
    await manager.storePattern(
      {
        ...samplePattern,
        id: 'test-pattern-3',
        title: 'SwiftUI Layout System',
        content: 'Understanding HStack, VStack, and ZStack',
        topics: ['swiftui', 'layout'],
      },
      { sourceName: 'test' }
    );

    // Search for patterns
    const results = await manager.search('swiftui', { k: 5 });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('title');
    expect(results[0]).toHaveProperty('topics');
  });

  it('should reconstruct original URLs and IDs from stored patterns', async () => {
    manager = new MemvidMemoryManager(testMemoryPath);
    await manager.initialize();

    const pattern: BasePattern = {
      id: 'sundell-patterns-https://www.swiftbysundell.com/articles/animation',
      title: 'SwiftUI Animation',
      url: 'https://www.swiftbysundell.com/articles/animation',
      publishDate: '2024-01-15',
      excerpt: 'Animation patterns',
      content: 'SwiftUI animation content',
      topics: ['swiftui', 'animation'],
      hasCode: true,
      relevanceScore: 85,
    };

    await manager.storePattern(pattern, { sourceName: 'sundell' });

    const results = await manager.search('animation', { k: 5 });

    expect(results.length).toBeGreaterThan(0);
    const hit = results[0];

    // URL should be the real URL, not an mv2:// internal URI
    expect(hit.url).not.toContain('mv2://');
    expect(hit.url).toContain('https://');

    // ID should contain the original pattern ID prefix
    expect(hit.id).toContain('sundell-patterns');
  });

  it('should handle search with no results gracefully', async () => {
    manager = new MemvidMemoryManager(testMemoryPath);
    await manager.initialize();

    const results = await manager.search('nonexistent-topic-xyz', { k: 5 });

    expect(results).toBeDefined();
    expect(results.length).toBe(0);
  });

  it('should get memory statistics', async () => {
    manager = new MemvidMemoryManager(testMemoryPath);
    await manager.initialize();

    const stats = await manager.getStats();

    expect(stats).toHaveProperty('frameCount');
    expect(stats).toHaveProperty('sizeBytes');
    expect(typeof stats.frameCount).toBe('number');
    expect(typeof stats.sizeBytes).toBe('number');
  });

  it('should close memory successfully', async () => {
    manager = new MemvidMemoryManager(testMemoryPath);
    await manager.initialize();

    await expect(manager.close()).resolves.not.toThrow();
  });

  it('should handle errors gracefully when storing fails', async () => {
    manager = new MemvidMemoryManager(testMemoryPath);
    // Don't initialize - should handle gracefully
    
    // This should not throw but log a warning
    await expect(
      manager.storePattern(samplePattern, { sourceName: 'test' })
    ).resolves.not.toThrow();
  });
});
