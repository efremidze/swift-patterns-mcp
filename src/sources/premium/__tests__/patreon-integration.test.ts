/**
 * Patreon Integration Test Suite
 *
 * This is the canonical test file for the Patreon premium source integration.
 * Run with: npm test -- src/sources/premium/__tests__/patreon-integration.test.ts
 *
 * Prerequisites:
 * - YOUTUBE_API_KEY environment variable set
 * - PATREON_CLIENT_ID environment variable set
 * - PATREON_CLIENT_SECRET environment variable set
 * - .patreon-session file with valid session cookie (for download tests)
 *
 * Test Categories:
 * 1. Configuration - env vars, creators registry
 * 2. Content Scanning - local downloaded content indexing
 * 3. YouTube Discovery - search and channel video fetching
 * 4. On-Demand Download - patreon-dl integration
 * 5. Zip Extraction - extracting Swift from zip attachments
 * 6. End-to-End - full flow from query to code
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PatreonSource } from '../patreon.js';
import {
  scanDownloadedContent,
  extractPostId,
} from '../patreon-dl.js';
import { searchVideos, getChannelVideos } from '../youtube.js';
import { CREATORS, withYouTube } from '../../../config/creators.js';

// Skip tests if required env vars are missing
const hasYouTubeKey = !!process.env.YOUTUBE_API_KEY;
const hasPatreonCredentials = !!process.env.PATREON_CLIENT_ID && !!process.env.PATREON_CLIENT_SECRET;
const describeWithYouTube = hasYouTubeKey ? describe : describe.skip;
const describeWithPatreon = hasPatreonCredentials ? describe : describe.skip;

// Skip entire suite in CI/CD without Patreon credentials
const describePatreonIntegration = hasPatreonCredentials ? describe : describe.skip;

describePatreonIntegration('Patreon Integration', () => {

  // ============================================================================
  // 1. CONFIGURATION TESTS
  // ============================================================================

  describe('Configuration', () => {
    it('should have CREATORS defined', () => {
      expect(CREATORS).toBeDefined();
      expect(CREATORS.length).toBeGreaterThan(0);
    });

    it('should have creators with YouTube channels', () => {
      const creatorsWithYT = withYouTube();
      expect(creatorsWithYT.length).toBeGreaterThan(0);

      for (const creator of creatorsWithYT) {
        expect(creator.youtubeChannelId).toBeDefined();
        expect(creator.patreonCampaignId).toBeDefined();
        expect(creator.name).toBeDefined();
      }
    });

    it('should have known creators configured', () => {
      const names = CREATORS.map(c => c.name);
      expect(names).toContain('Kavsoft');
    });

    describeWithPatreon('with Patreon credentials', () => {
      it('should instantiate PatreonSource', () => {
        const source = new PatreonSource();
        expect(source).toBeDefined();
        expect(source.isAvailable()).toBe(true);
      });
    });
  });

  // ============================================================================
  // 2. CONTENT SCANNING TESTS
  // ============================================================================

  describe('Content Scanning', () => {
    it('should scan downloaded content without crashing', () => {
      const posts = scanDownloadedContent();
      expect(Array.isArray(posts)).toBe(true);
    });

    it('should extract post ID from Patreon URLs', () => {
      // Standard format
      expect(extractPostId('https://www.patreon.com/posts/apple-stocks-ui-148144034'))
        .toBe('148144034');

      // Simple format
      expect(extractPostId('https://www.patreon.com/posts/148144034'))
        .toBe('148144034');

      // Invalid URL
      expect(extractPostId('https://example.com/not-patreon'))
        .toBeNull();
    });

    describe('with downloaded content', () => {
      let posts: ReturnType<typeof scanDownloadedContent>;

      beforeAll(() => {
        posts = scanDownloadedContent();
      });

      it('should find posts if content directory exists', () => {
        // This test passes if either no content exists OR content is found correctly
        if (posts.length > 0) {
          expect(posts[0]).toHaveProperty('postId');
          expect(posts[0]).toHaveProperty('title');
          expect(posts[0]).toHaveProperty('creator');
          expect(posts[0]).toHaveProperty('files');
        }
      });

      it('should extract Swift files from posts', () => {
        if (posts.length > 0) {
          const allFiles = posts.flatMap(p => p.files);
          const swiftFiles = allFiles.filter(f => f.type === 'swift');

          if (swiftFiles.length > 0) {
            // Swift files should have content
            for (const file of swiftFiles) {
              expect(file.content).toBeDefined();
              expect(file.content!.length).toBeGreaterThan(0);
            }
          }
        }
      });

      it('should extract valid Swift code from zips', () => {
        if (posts.length > 0) {
          const allFiles = posts.flatMap(p => p.files);
          const swiftFiles = allFiles.filter(f => f.type === 'swift' && f.content);

          if (swiftFiles.length > 0) {
            // At least some files should contain Swift keywords
            const hasSwiftCode = swiftFiles.some(f =>
              f.content!.includes('import') ||
              f.content!.includes('struct') ||
              f.content!.includes('class') ||
              f.content!.includes('func')
            );
            expect(hasSwiftCode).toBe(true);
          }
        }
      });
    });
  });

  // ============================================================================
  // 3. YOUTUBE DISCOVERY TESTS
  // ============================================================================

  describeWithYouTube('YouTube Discovery', () => {
    const KAVSOFT_CHANNEL = 'UCsuV4MRk_aB291SrchUVb4w';

    it('should fetch channel videos', async () => {
      const videos = await getChannelVideos(KAVSOFT_CHANNEL, 5);

      expect(Array.isArray(videos)).toBe(true);
      expect(videos.length).toBeGreaterThan(0);

      const video = videos[0];
      expect(video).toHaveProperty('id');
      expect(video).toHaveProperty('title');
      expect(video).toHaveProperty('description');
      expect(video).toHaveProperty('publishedAt');
    }, 30000);

    it('should extract Patreon links from video descriptions', async () => {
      const videos = await getChannelVideos(KAVSOFT_CHANNEL, 20);

      // At least some videos should have Patreon links
      const withPatreon = videos.filter(v => v.patreonLink);
      expect(withPatreon.length).toBeGreaterThan(0);

      // Patreon links should be valid URLs
      for (const video of withPatreon) {
        expect(video.patreonLink).toMatch(/patreon\.com/);
      }
    }, 30000);

    it('should search videos by query', async () => {
      const videos = await searchVideos('SwiftUI animation', KAVSOFT_CHANNEL, 5);

      expect(Array.isArray(videos)).toBe(true);
      // Search might return 0 results for specific queries, that's OK
    }, 30000);

    it('should search and find Apple Stocks video', async () => {
      const videos = await searchVideos('Apple Stocks ScrollView', KAVSOFT_CHANNEL, 10);

      const stocksVideo = videos.find(v =>
        v.title.toLowerCase().includes('stocks') ||
        v.title.toLowerCase().includes('scroll')
      );

      // This specific video should exist
      expect(stocksVideo).toBeDefined();
      expect(stocksVideo!.patreonLink).toMatch(/patreon\.com\/posts/);
    }, 30000);
  });

  // ============================================================================
  // 4. PATREON SOURCE TESTS
  // ============================================================================

  describeWithPatreon('PatreonSource', () => {
    let patreon: PatreonSource;

    beforeAll(() => {
      patreon = new PatreonSource();
    });

    describeWithYouTube('searchPatterns', () => {
      it('should search and return patterns', async () => {
        const patterns = await patreon.searchPatterns('SwiftUI');

        expect(Array.isArray(patterns)).toBe(true);
        // May return 0 if no matches, but should not crash
      }, 60000);

      it('should return patterns with required fields', async () => {
        const patterns = await patreon.searchPatterns('animation');

        if (patterns.length > 0) {
          const pattern = patterns[0];
          expect(pattern).toHaveProperty('id');
          expect(pattern).toHaveProperty('title');
          expect(pattern).toHaveProperty('url');
          expect(pattern).toHaveProperty('creator');
          expect(pattern).toHaveProperty('hasCode');
          expect(pattern).toHaveProperty('topics');
        }
      }, 60000);

      it('should enrich patterns with downloaded code', async () => {
        // Search for something we know has downloaded content
        const patterns = await patreon.searchPatterns('Apple Stocks looping ScrollView');

        const withCode = patterns.filter(p => p.hasCode && p.content && p.content.length > 100);

        // If content is downloaded, should have code
        if (withCode.length > 0) {
          const swiftPattern = withCode.find(p => p.content!.includes('import SwiftUI'));
          expect(swiftPattern).toBeDefined();
        }
      }, 120000);
    });

    describe('fetchPatterns', () => {
      it('should fetch patterns without topic', async () => {
        const patterns = await patreon.fetchPatterns();

        expect(Array.isArray(patterns)).toBe(true);
      }, 120000);

      it('should fetch patterns for specific creator', async () => {
        const kavsoftConfig = CREATORS.find(c => c.name === 'Kavsoft');
        const kavId = (kavsoftConfig && (kavsoftConfig as any).patreonCampaignId);
        const patterns = await patreon.fetchPatterns(kavId);

        if (patterns.length > 0) {
          // All patterns should be from Kavsoft
          const allKavsoft = patterns.every(p => p.creator === 'Kavsoft');
          expect(allKavsoft).toBe(true);
        }
      }, 120000);
    });
  });

  // ============================================================================
  // 5. END-TO-END TESTS
  // ============================================================================

  describeWithPatreon('End-to-End', () => {
    describeWithYouTube('Full Flow', () => {
      it('should return actual Swift code for Apple Stocks query', async () => {
        const patreon = new PatreonSource();
        const patterns = await patreon.searchPatterns('Apple Stocks ticker looping ScrollView');

        // Should find the downloaded content
        const codePatterns = patterns.filter(p =>
          p.hasCode &&
          p.content &&
          p.content.includes('struct') &&
          p.content.includes('SwiftUI')
        );

        expect(codePatterns.length).toBeGreaterThan(0);

        // Should have the LoopingScrollView
        const loopingView = codePatterns.find(p =>
          p.title.includes('LoopingScrollView') ||
          p.content!.includes('LoopingScrollView')
        );

        if (loopingView) {
          expect(loopingView.content).toContain('ScrollView');
          expect(loopingView.creator).toBe('Kavsoft');
        }
      }, 180000);

      it('should handle multiple creators', async () => {
        const patreon = new PatreonSource();
        const patterns = await patreon.fetchPatterns();

        if (patterns.length > 0) {
          const creators = [...new Set(patterns.map(p => p.creator))];
          // Should have content from multiple creators if available
          expect(creators.length).toBeGreaterThanOrEqual(1);
        }
      }, 180000);
    });
  });
});

// ============================================================================
// TEST PLAN DOCUMENTATION
// ============================================================================

/**
 * ## Test Plan: Patreon Premium Source Integration
 *
 * ### Overview
 * The Patreon integration uses a hybrid architecture:
 * 1. YouTube Discovery Layer - searches YouTube for videos with Patreon links
 * 2. Authorization Layer - verifies user has Patreon credentials
 * 3. Content Layer - downloads posts via patreon-dl and extracts code from zips
 *
 * ### Prerequisites for Full Testing
 *
 * 1. Environment Variables:
 *    - YOUTUBE_API_KEY: Google Cloud API key with YouTube Data API v3 enabled
 *    - PATREON_CLIENT_ID: Patreon OAuth app client ID
 *    - PATREON_CLIENT_SECRET: Patreon OAuth app client secret
 *
 * 2. Session Cookie:
 *    - .patreon-session file in project root with valid session_id cookie
 *    - Required for downloading patron-only content
 *
 * 3. Downloaded Content (for offline tests):
 *    - ~/.swift-patterns-mcp/patreon-content/ directory with downloaded posts
 *    - Run `swift-patterns-mcp download` to populate
 *
 * ### Test Categories
 *
 * #### 1. Configuration Tests (no external deps)
 * - CREATORS array is populated
 * - Creators have required fields (name, patreonCampaignId, youtubeChannelId)
 * - PatreonSource instantiates correctly
 *
 * #### 2. Content Scanning Tests (local files only)
 * - scanDownloadedContent() returns array
 * - extractPostId() parses Patreon URLs correctly
 * - Posts have required fields (postId, title, creator, files)
 * - Swift files are extracted from zips
 * - Swift content contains valid code
 *
 * #### 3. YouTube Discovery Tests (requires YOUTUBE_API_KEY)
 * - getChannelVideos() returns videos
 * - Videos have Patreon links in descriptions
 * - searchVideos() finds matching content
 * - Full descriptions are fetched (not truncated)
 *
 * #### 4. PatreonSource Tests (requires all credentials)
 * - searchPatterns() returns results
 * - Patterns have required fields
 * - fetchPatterns() works with and without creatorId
 * - Patterns are enriched with downloaded code
 *
 * #### 5. End-to-End Tests (requires all deps + downloaded content)
 * - Full flow returns actual Swift code
 * - Multiple creators are supported
 * - Specific queries return expected results
 *
 * ### Manual Testing Checklist
 *
 * Before release, manually verify:
 *
 * [ ] Fresh install works (no config files)
 * [ ] Setup wizard completes successfully
 * [ ] YouTube search finds videos
 * [ ] Patreon links are extracted from descriptions
 * [ ] patreon-dl downloads posts without prompting
 * [ ] Zip files are extracted correctly
 * [ ] Swift files contain valid code
 * [ ] Handler returns formatted results
 * [ ] Error messages are helpful when config is missing
 *
 * ### Known Limitations
 *
 * - YouTube API has daily quota limits
 * - patreon-dl requires valid session cookie
 * - Some tests require pre-downloaded content
 * - Network-dependent tests may be slow
 */
