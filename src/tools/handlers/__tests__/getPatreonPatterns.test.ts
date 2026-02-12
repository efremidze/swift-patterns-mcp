// src/tools/handlers/__tests__/getPatreonPatterns.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPatreonPatternsHandler } from '../getPatreonPatterns.js';
import type { ToolContext, PatreonPattern, PatreonSourceInstance } from '../../types.js';
import {
  createPatreonPattern,
  PATREON_PATTERNS_MIXED,
  PATREON_PATTERNS_TWELVE,
  PATREON_PATTERNS_WITH_CODE,
} from '../../../__tests__/fixtures/patterns.js';
import {
  REQUIRED_PATREON_ENV_VARS,
  clearPatreonEnvVars,
  restoreEnvVars,
  saveEnvVars,
  setPatreonEnvVars,
} from './harness.js';

// ─── Test fixtures ───

// ─── Mock PatreonSource class ───

function createMockPatreonSource(opts: {
  searchResult?: PatreonPattern[];
  fetchResult?: PatreonPattern[];
} = {}) {
  const searchPatterns = vi.fn().mockResolvedValue(opts.searchResult ?? PATREON_PATTERNS_WITH_CODE);
  const fetchPatterns = vi.fn().mockResolvedValue(opts.fetchResult ?? PATREON_PATTERNS_WITH_CODE);

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

// ─── Tests ───

describe('getPatreonPatternsHandler', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save original env vars
    Object.assign(savedEnv, saveEnvVars(REQUIRED_PATREON_ENV_VARS));
  });

  afterEach(() => {
    // Restore original env vars
    restoreEnvVars(savedEnv);
    vi.restoreAllMocks();
  });

  // ─── Environment validation ───

  describe('environment validation', () => {
    it('should list all missing env vars when none are set', async () => {
      clearPatreonEnvVars();
      const result = await getPatreonPatternsHandler({}, createContext());
      const text = result.content[0].text;

      REQUIRED_PATREON_ENV_VARS.forEach(v => {
        expect(text).toContain(v);
      });
      expect(text).toContain('missing required environment variables');
    });

    it('should list only the specific missing vars', async () => {
      clearPatreonEnvVars();
      process.env.YOUTUBE_API_KEY = 'set';
      // PATREON_CLIENT_ID and PATREON_CLIENT_SECRET still missing

      const result = await getPatreonPatternsHandler({}, createContext());
      const text = result.content[0].text;

      expect(text).not.toContain('YOUTUBE_API_KEY');
      expect(text).toContain('PATREON_CLIENT_ID');
      expect(text).toContain('PATREON_CLIENT_SECRET');
    });

    it('should include setup URL in error message', async () => {
      clearPatreonEnvVars();
      const result = await getPatreonPatternsHandler({}, createContext());
      const text = result.content[0].text;

      expect(text).toContain('github.com/efremidze/swift-patterns-mcp');
    });
  });

  // ─── Patreon module availability ───

  describe('patreon module availability', () => {
    it('should return error when patreonSource is null', async () => {
      setPatreonEnvVars();
      const result = await getPatreonPatternsHandler({}, createContext(null));
      const text = result.content[0].text;

      expect(text).toContain('not available');
    });
  });

  // ─── Topic search vs fetch all ───

  describe('topic search vs fetch all', () => {
    it('should call searchPatterns when topic is provided', async () => {
      setPatreonEnvVars();
      const { MockClass, searchPatterns, fetchPatterns } = createMockPatreonSource();

      await getPatreonPatternsHandler({ topic: 'SwiftUI scrollview' }, createContext(MockClass));

      expect(searchPatterns).toHaveBeenCalledWith('SwiftUI scrollview', { mode: 'deep' });
      expect(fetchPatterns).not.toHaveBeenCalled();
    });

    it('should call fetchPatterns when no topic is provided', async () => {
      setPatreonEnvVars();
      const { MockClass, searchPatterns, fetchPatterns } = createMockPatreonSource();

      await getPatreonPatternsHandler({}, createContext(MockClass));

      expect(fetchPatterns).toHaveBeenCalled();
      expect(searchPatterns).not.toHaveBeenCalled();
    });
  });

  // ─── requireCode filtering ───

  describe('requireCode filtering', () => {
    it('should filter to hasCode patterns when requireCode=true', async () => {
      setPatreonEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: PATREON_PATTERNS_MIXED });

      const result = await getPatreonPatternsHandler(
        { topic: 'test', requireCode: true },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('With Code');
      expect(text).not.toContain('No Code');
    });

    it('should return all patterns when requireCode is not set', async () => {
      setPatreonEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: PATREON_PATTERNS_MIXED });

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
      setPatreonEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: [] });

      const result = await getPatreonPatternsHandler(
        { topic: 'nonexistent' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('No Patreon patterns found');
    });

    it('should include topic in "No patterns found" message', async () => {
      setPatreonEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: [] });

      const result = await getPatreonPatternsHandler(
        { topic: 'marquee animation' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('"marquee animation"');
    });

    it('should format patterns with creator, date, topics, excerpt, URL', async () => {
      setPatreonEnvVars();
      const pattern = createPatreonPattern({
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
      setPatreonEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: PATREON_PATTERNS_TWELVE });

      const result = await getPatreonPatternsHandler(
        { topic: 'test' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).toContain('Showing top 10 of 12');
    });

    it('should not show "Showing top 10" when 10 or fewer results', async () => {
      setPatreonEnvVars();
      const { MockClass } = createMockPatreonSource({ searchResult: PATREON_PATTERNS_WITH_CODE });

      const result = await getPatreonPatternsHandler(
        { topic: 'test' },
        createContext(MockClass),
      );
      const text = result.content[0].text;

      expect(text).not.toContain('Showing top');
    });
  });

  // ─── YouTube error surfacing removed (unreliable module-level state eliminated) ───

  describe('YouTube error surfacing', () => {
    it('should not include YouTube warnings (feature removed)', async () => {
      setPatreonEnvVars();
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
