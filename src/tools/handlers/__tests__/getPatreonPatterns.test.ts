// src/tools/handlers/__tests__/getPatreonPatterns.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPatreonPatternsHandler } from '../getPatreonPatterns.js';
import type { ToolContext, PatreonPattern, PatreonSourceInstance } from '../../types.js';

// Mock getYouTubeStatus
const mockGetYouTubeStatus = vi.fn().mockReturnValue({ lastError: null, lastErrorTime: null });
vi.mock('../../../sources/premium/youtube.js', () => ({
  getYouTubeStatus: (...args: unknown[]) => mockGetYouTubeStatus(...args),
}));

// ─── Test fixtures ───

function makePattern(overrides: Partial<PatreonPattern> = {}): PatreonPattern {
  return {
    id: `pat-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Pattern',
    url: 'https://patreon.com/posts/test-123',
    publishDate: '2024-06-15T00:00:00Z',
    excerpt: 'A test excerpt about SwiftUI',
    content: 'Full test content',
    creator: 'TestCreator',
    topics: ['swiftui'],
    relevanceScore: 80,
    hasCode: true,
    ...overrides,
  };
}

const PATTERNS_WITH_CODE = [
  makePattern({ title: 'Pattern A', hasCode: true }),
  makePattern({ title: 'Pattern B', hasCode: true }),
];

const PATTERNS_MIXED = [
  makePattern({ title: 'With Code', hasCode: true }),
  makePattern({ title: 'No Code', hasCode: false }),
];

const PATTERNS_12 = Array.from({ length: 12 }, (_, i) =>
  makePattern({ title: `Pattern ${i + 1}`, creator: `Creator ${i + 1}` })
);

// ─── Mock PatreonSource class ───

function createMockPatreonSource(opts: {
  searchResult?: PatreonPattern[];
  fetchResult?: PatreonPattern[];
} = {}) {
  const searchPatterns = vi.fn().mockResolvedValue(opts.searchResult ?? PATTERNS_WITH_CODE);
  const fetchPatterns = vi.fn().mockResolvedValue(opts.fetchResult ?? PATTERNS_WITH_CODE);

  class MockPatreonSource implements PatreonSourceInstance {
    isConfigured = vi.fn().mockResolvedValue(true);
    isAvailable = vi.fn().mockReturnValue(true);
    searchPatterns = searchPatterns;
    fetchPatterns = fetchPatterns;
  }

  return { MockClass: MockPatreonSource, searchPatterns, fetchPatterns };
}

function createContext(patreonSource: unknown = null): ToolContext {
  return {
    sourceManager: {} as any,
    patreonSource: patreonSource as any,
  };
}

// ─── Env var helpers ───

const REQUIRED_VARS = ['YOUTUBE_API_KEY', 'PATREON_CLIENT_ID', 'PATREON_CLIENT_SECRET'];

function setAllEnvVars() {
  REQUIRED_VARS.forEach(v => { process.env[v] = `test_${v.toLowerCase()}`; });
}

function clearAllEnvVars() {
  REQUIRED_VARS.forEach(v => { delete process.env[v]; });
}

// ─── Tests ───

describe('getPatreonPatternsHandler', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save original env vars
    REQUIRED_VARS.forEach(v => { savedEnv[v] = process.env[v]; });
    mockGetYouTubeStatus.mockReturnValue({ lastError: null, lastErrorTime: null });
  });

  afterEach(() => {
    // Restore original env vars
    REQUIRED_VARS.forEach(v => {
      if (savedEnv[v] !== undefined) {
        process.env[v] = savedEnv[v];
      } else {
        delete process.env[v];
      }
    });
    vi.restoreAllMocks();
  });

  // ─── Environment validation ───

  describe('environment validation', () => {
    it('should list all missing env vars when none are set', async () => {
      clearAllEnvVars();
      const result = await getPatreonPatternsHandler({}, createContext());
      const text = result.content[0].text;

      REQUIRED_VARS.forEach(v => {
        expect(text).toContain(v);
      });
      expect(text).toContain('missing required environment variables');
    });

    it('should list only the specific missing vars', async () => {
      clearAllEnvVars();
      process.env.YOUTUBE_API_KEY = 'set';
      // PATREON_CLIENT_ID and PATREON_CLIENT_SECRET still missing

      const result = await getPatreonPatternsHandler({}, createContext());
      const text = result.content[0].text;

      expect(text).not.toContain('YOUTUBE_API_KEY');
      expect(text).toContain('PATREON_CLIENT_ID');
      expect(text).toContain('PATREON_CLIENT_SECRET');
    });

    it('should include setup URL in error message', async () => {
      clearAllEnvVars();
      const result = await getPatreonPatternsHandler({}, createContext());
      const text = result.content[0].text;

      expect(text).toContain('github.com/efremidze/swift-patterns-mcp');
    });
  });

  // ─── Patreon module availability ───

  describe('patreon module availability', () => {
    it('should return error when patreonSource is null', async () => {
      setAllEnvVars();
      const result = await getPatreonPatternsHandler({}, createContext(null));
      const text = result.content[0].text;

      expect(text).toContain('not available');
    });
  });

  // ─── Topic search vs fetch all ───

  describe('topic search vs fetch all', () => {
    it('should call searchPatterns when topic is provided', async () => {
      setAllEnvVars();
      const { MockClass, searchPatterns, fetchPatterns } = createMockPatreonSource();

      await getPatreonPatternsHandler({ topic: 'SwiftUI scrollview' }, createContext(MockClass));

      expect(searchPatterns).toHaveBeenCalledWith('SwiftUI scrollview');
      expect(fetchPatterns).not.toHaveBeenCalled();
    });

    it('should call fetchPatterns when no topic is provided', async () => {
      setAllEnvVars();
      const { MockClass, searchPatterns, fetchPatterns } = createMockPatreonSource();

      await getPatreonPatternsHandler({}, createContext(MockClass));

      expect(fetchPatterns).toHaveBeenCalled();
      expect(searchPatterns).not.toHaveBeenCalled();
    });
  });

  // ─── requireCode filtering ───

  describe('requireCode filtering', () => {
    it('should filter to hasCode patterns when requireCode=true', async () => {
      setAllEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: PATTERNS_MIXED });

      const result = await getPatreonPatternsHandler(
        { topic: 'test', requireCode: true },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('With Code');
      expect(text).not.toContain('No Code');
    });

    it('should return all patterns when requireCode is not set', async () => {
      setAllEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: PATTERNS_MIXED });

      const result = await getPatreonPatternsHandler(
        { topic: 'test' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('With Code');
      expect(text).toContain('No Code');
    });
  });

  // ─── Response formatting ───

  describe('response formatting', () => {
    it('should return "No patterns found" when 0 results', async () => {
      setAllEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: [] });

      const result = await getPatreonPatternsHandler(
        { topic: 'nonexistent' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('No Patreon patterns found');
    });

    it('should include topic in "No patterns found" message', async () => {
      setAllEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: [] });

      const result = await getPatreonPatternsHandler(
        { topic: 'marquee animation' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('"marquee animation"');
    });

    it('should format patterns with creator, date, topics, excerpt, URL', async () => {
      setAllEnvVars();
      const pattern = makePattern({
        title: 'LoopingScrollView',
        creator: 'Kavsoft',
        topics: ['swiftui', 'animation'],
        excerpt: 'Auto-scrolling ticker',
        url: 'https://patreon.com/posts/looping-123',
      });
      const { MockClass } = createMockPatreonSource({ searchResult: [pattern] });

      const result = await getPatreonPatternsHandler(
        { topic: 'scroll' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('LoopingScrollView');
      expect(text).toContain('Kavsoft');
      expect(text).toContain('swiftui, animation');
      expect(text).toContain('Auto-scrolling ticker');
      expect(text).toContain('https://patreon.com/posts/looping-123');
    });

    it('should show "Showing top 10" when more than 10 results', async () => {
      setAllEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: PATTERNS_12 });

      const result = await getPatreonPatternsHandler(
        { topic: 'test' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('Showing top 10 of 12');
    });

    it('should not show "Showing top 10" when 10 or fewer results', async () => {
      setAllEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: PATTERNS_WITH_CODE });

      const result = await getPatreonPatternsHandler(
        { topic: 'test' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).not.toContain('Showing top');
    });
  });

  // ─── YouTube error surfacing ───

  describe('YouTube error surfacing', () => {
    it('should include warning when YouTube had a recent error', async () => {
      setAllEnvVars();
      mockGetYouTubeStatus.mockReturnValue({
        lastError: 'HTTP 403',
        lastErrorTime: Date.now() - 60_000, // 1 minute ago
      });
      const { MockClass } = createMockPatreonSource();

      const result = await getPatreonPatternsHandler(
        { topic: 'test' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('YouTube API error');
      expect(text).toContain('HTTP 403');
      expect(text).toContain('Some results may be missing');
    });

    it('should not include warning when YouTube error is stale (>5 min)', async () => {
      setAllEnvVars();
      mockGetYouTubeStatus.mockReturnValue({
        lastError: 'HTTP 500',
        lastErrorTime: Date.now() - 400_000, // ~6.7 minutes ago
      });
      const { MockClass } = createMockPatreonSource();

      const result = await getPatreonPatternsHandler(
        { topic: 'test' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).not.toContain('YouTube API error');
    });

    it('should not include warning when YouTube has no errors', async () => {
      setAllEnvVars();
      mockGetYouTubeStatus.mockReturnValue({ lastError: null, lastErrorTime: null });
      const { MockClass } = createMockPatreonSource();

      const result = await getPatreonPatternsHandler(
        { topic: 'test' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).not.toContain('YouTube API error');
      expect(text).not.toContain('Note:');
    });
  });
});
