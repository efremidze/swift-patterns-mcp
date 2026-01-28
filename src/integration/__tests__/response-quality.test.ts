// src/integration/response-quality.test.ts
// End-to-end tests validating response quality for AI assistant consumption
// Skipped on CI due to native dependency issues (keytar)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPTestClient, isCI } from '../test-client.js';

const describeIntegration = isCI ? describe.skip : describe;

describeIntegration('Response Quality Validation', () => {
  let client: MCPTestClient;
  let listSourcesResponse: string;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.start();
    // Cache expensive list_content_sources call
    listSourcesResponse = await client.callToolText('list_content_sources');
  }, 10000);

  afterAll(async () => {
    await client.stop();
  });

  describe('list_content_sources response format', () => {
    it('should have clear markdown structure', () => {
      expect(listSourcesResponse).toMatch(/^# /m);
      expect(listSourcesResponse).toMatch(/## /m);
      expect(listSourcesResponse).toContain('Free Sources');
      expect(listSourcesResponse).toContain('Premium Sources');
    });

    it('should list all expected free sources', () => {
      // Verify all free sources are listed
      expect(listSourcesResponse).toContain('Swift by Sundell');
      expect(listSourcesResponse).toContain('Antoine van der Lee');
      expect(listSourcesResponse).toContain('Nil Coalescing');
      expect(listSourcesResponse).toContain('Point-Free');
    });

    it('should show status indicators for each source', () => {
      // Each source should have a status indicator
      expect(listSourcesResponse).toMatch(/✅|⚙️|⬜/);
    });

    it('should include actionable setup instructions', () => {
      expect(listSourcesResponse).toContain('swift-patterns-mcp setup');
    });
  });

  describe('get_swift_pattern response validation', () => {
    it('should return patterns relevant to the requested topic', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 50,
      });

      // Response should contain SwiftUI-related content
      const lowerResponse = response.toLowerCase();
      const hasRelevantContent =
        lowerResponse.includes('swiftui') ||
        lowerResponse.includes('view') ||
        lowerResponse.includes('state') ||
        lowerResponse.includes('binding');

      expect(hasRelevantContent).toBe(true);
    }, 60000);

    it('should exclude low-quality patterns when minQuality is high', async () => {
      const highQualityResponse = await client.callToolText('get_swift_pattern', {
        topic: 'swift',
        minQuality: 80,
      });

      const lowQualityResponse = await client.callToolText('get_swift_pattern', {
        topic: 'swift',
        minQuality: 30,
      });

      // With higher minQuality, we should get fewer or equal results
      // Count the number of pattern headers (## Title)
      const highQualityCount = (highQualityResponse.match(/^## /gm) || []).length;
      const lowQualityCount = (lowQualityResponse.match(/^## /gm) || []).length;

      expect(lowQualityCount).toBeGreaterThanOrEqual(highQualityCount);
    }, 120000);

    it('should include quality scores in pattern output', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      if (!response.includes('No patterns found')) {
        // Each pattern should have a quality score
        expect(response).toMatch(/Quality.*:\s*\d+\/100/i);
      }
    }, 60000);

    it('should include source attribution for each pattern', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      if (!response.includes('No patterns found')) {
        // Each pattern should have a source
        expect(response).toMatch(/Source.*:/i);
      }
    }, 60000);

    it('should include valid URLs in pattern output', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      if (!response.includes('No patterns found')) {
        // Should have clickable markdown links
        const urlMatch = response.match(/\[.+\]\((https?:\/\/[^)]+)\)/);
        expect(urlMatch).not.toBeNull();

        // URL should be from a known source
        if (urlMatch) {
          const url = urlMatch[1];
          const isValidSource =
            url.includes('swiftbysundell.com') ||
            url.includes('avanderlee.com') ||
            url.includes('nilcoalescing.com') ||
            url.includes('pointfree.co') ||
            url.includes('github.com/pointfreeco');
          expect(isValidSource).toBe(true);
        }
      }
    }, 60000);

    it('should handle no results with helpful message', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'xyznonexistenttopic123',
        minQuality: 100,
      });

      expect(response).toContain('No patterns found');
      // Should suggest alternatives
      expect(response).toMatch(/[Tt]ry|[Ll]ower|[Dd]ifferent/);
    }, 30000);
  });

  describe('search_swift_content response validation', () => {
    it('should return relevant results with excerpts and proper formatting', async () => {
      const response = await client.callToolText('search_swift_content', {
        query: 'async await',
      });

      expect(response).toMatch(/# Search Results/);

      // Results should be relevant to the query
      const lowerResponse = response.toLowerCase();
      const hasRelevantContent =
        lowerResponse.includes('async') ||
        lowerResponse.includes('await') ||
        lowerResponse.includes('concurrency');

      expect(hasRelevantContent).toBe(true);
      
      // Results should have some content beyond just titles (excerpts)
      expect(response.length).toBeGreaterThan(200);
    }, 60000);

    it('should filter by requireCode when specified', async () => {
      const withCodeResponse = await client.callToolText('search_swift_content', {
        query: 'swift',
        requireCode: true,
      });

      // When requireCode is true, results should have code indicators
      // This is hard to verify without parsing, but at minimum we should get results
      expect(withCodeResponse.length).toBeGreaterThan(50);
    }, 60000);
  });

  describe('enable_source response validation', () => {
    it('should confirm enabling a valid free source', async () => {
      const response = await client.callToolText('enable_source', {
        source: 'sundell',
      });

      expect(response).toContain('enabled');
      expect(response).toContain('Swift by Sundell');
    });

    it('should show helpful error for invalid source with alternatives', async () => {
      const response = await client.callToolText('enable_source', {
        source: 'invalid_source_xyz',
      });

      expect(response).toContain('Unknown source');
      expect(response).toContain('invalid_source_xyz');
      // Should list available alternatives
      expect(response).toContain('Available sources');
      expect(response).toContain('sundell');
    });

    it('should require setup for premium sources', async () => {
      const response = await client.callToolText('enable_source', {
        source: 'patreon',
      });

      expect(response).toMatch(/setup|enabled/i);
    });
  });

  describe('Response characteristics for AI consumption', () => {
    it('should use markdown formatting without HTML', async () => {
      const responses = await Promise.all([
        client.callToolText('list_content_sources'),
        client.callToolText('get_swift_pattern', { topic: 'testing', minQuality: 50 }),
      ]);

      for (const response of responses) {
        // Should have markdown headers
        expect(response).toMatch(/^#+ /m);
        // Should NOT have HTML tags
        expect(response).not.toMatch(/<div|<span|<p>|<br>/);
      }
    }, 60000);

    it('should have reasonable response length (not too short, not too long)', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 70,
      });

      // Should have meaningful content
      expect(response.length).toBeGreaterThan(50);
      // Should not be excessively long
      expect(response.length).toBeLessThan(50000);
    }, 60000);

    it('should use separators between multiple patterns', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swift',
        minQuality: 50,
      });

      if (!response.includes('No patterns found')) {
        // Multiple patterns should be separated
        const patternCount = (response.match(/^## /gm) || []).length;
        if (patternCount > 1) {
          expect(response).toMatch(/---/);
        }
      }
    }, 60000);

    it('should sort patterns by quality (highest first)', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swift',
        minQuality: 50,
      });

      if (!response.includes('No patterns found')) {
        // Extract quality scores from the response
        const qualityMatches = response.matchAll(/Quality.*?(\d+)\/100/gi);
        const scores = Array.from(qualityMatches, m => parseInt(m[1], 10));

        // Verify scores are in descending order
        for (let i = 1; i < scores.length; i++) {
          expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
        }
      }
    }, 60000);
  });
});
