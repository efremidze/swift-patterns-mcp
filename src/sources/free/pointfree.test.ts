// src/sources/free/pointfree.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PointFreeSource from './pointfree.js';

const mockFetch = vi.fn();

vi.mock('../../utils/cache.js', () => ({
  rssCache: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  },
  articleCache: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
  },
}));

function createResponse(body: string | Record<string, unknown>, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('PointFreeSource', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and parses patterns from GitHub content', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/repos/pointfreeco/pointfreeco')) {
        if (url.includes('/git/trees/')) {
          return Promise.resolve(createResponse({
            tree: [
              { path: 'README.md', type: 'blob' },
              { path: 'Sources/PointFree/Episodes/001-Intro.md', type: 'blob' },
              { path: 'Sources/PointFree/Utilities/Helper.swift', type: 'blob' },
            ],
          }));
        }
        return Promise.resolve(createResponse({ default_branch: 'main' }));
      }
      if (url.includes('README.md')) {
        return Promise.resolve(createResponse('# Point-Free\n\nSwiftUI patterns and architecture tips.'));
      }
      if (url.includes('001-Intro.md')) {
        return Promise.resolve(createResponse('# Episode 1\n\nLearn composable architecture.\n\n```swift\nstruct App {}\n```'));
      }
      return Promise.resolve(createResponse(''));
    });

    const source = new PointFreeSource();
    const patterns = await source.fetchPatterns();

    expect(patterns).toHaveLength(2);
    expect(patterns[0].title).toBe('Point-Free');
    expect(patterns[1].title).toContain('Episode 1');
    expect(patterns[1].topics).toContain('architecture');
    expect(patterns[1].hasCode).toBe(true);
  });

  it('searchPatterns returns relevant results', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/repos/pointfreeco/pointfreeco')) {
        if (url.includes('/git/trees/')) {
          return Promise.resolve(createResponse({
            tree: [
              { path: 'README.md', type: 'blob' },
            ],
          }));
        }
        return Promise.resolve(createResponse({ default_branch: 'main' }));
      }
      if (url.includes('README.md')) {
        return Promise.resolve(createResponse('# Point-Free\n\nSwiftUI guide for reducers.'));
      }
      return Promise.resolve(createResponse(''));
    });

    const source = new PointFreeSource();
    const results = await source.searchPatterns('swiftui');

    expect(results[0].title).toMatch(/Point-Free/i);
    expect(results[0].topics).toContain('swiftui');
  });
});
