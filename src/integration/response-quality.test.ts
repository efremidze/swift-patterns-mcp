// src/integration/response-quality.test.ts
// End-to-end tests validating response quality for AI assistant consumption
// Skipped on CI due to native dependency issues (keytar)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPTestClient, isCI } from './test-client.js';

const describeIntegration = isCI ? describe.skip : describe;

describeIntegration('Response Quality Validation', () => {
  let client: MCPTestClient;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.start();
  }, 10000);

  afterAll(async () => {
    await client.stop();
  });

  describe('list_content_sources response format', () => {
    it('should have clear markdown structure', async () => {
      const response = await client.callToolText('list_content_sources');

      expect(response).toMatch(/^# /m);
      expect(response).toMatch(/## /m);
      expect(response).toContain('Free Sources');
      expect(response).toContain('Premium Sources');
    });

    it('should list sources with status indicators', async () => {
      const response = await client.callToolText('list_content_sources');

      expect(response).toMatch(/[✅⚙️⬜]/);
      expect(response).toContain('Swift by Sundell');
      expect(response).toContain('Antoine van der Lee');
    });

    it('should include actionable instructions', async () => {
      const response = await client.callToolText('list_content_sources');

      expect(response).toContain('swift-patterns-mcp setup');
    });
  });

  describe('get_swift_pattern response format', () => {
    it('should have structured pattern output', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      expect(response).toMatch(/# Swift Patterns/);
      expect(response).toMatch(/## .+/);
    }, 60000);

    it('should include quality scores', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      expect(response).toMatch(/Quality.*\d+\/100/i);
    }, 60000);

    it('should include source attribution', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      expect(response).toMatch(/Source.*:/i);
    }, 60000);

    it('should include clickable links', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      expect(response).toMatch(/\[.+\]\(https?:\/\/.+\)/);
    }, 60000);

    it('should handle no results gracefully', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'nonexistent_topic_xyz123',
        minQuality: 100,
      });

      expect(response).toContain('No patterns found');
      expect(response).toMatch(/[Tt]ry/);
    }, 30000);
  });

  describe('search_swift_content response format', () => {
    it('should have search results header', async () => {
      const response = await client.callToolText('search_swift_content', {
        query: 'async await',
      });

      expect(response).toMatch(/# Search Results/);
    }, 60000);

    it('should include excerpts', async () => {
      const response = await client.callToolText('search_swift_content', {
        query: 'concurrency',
      });

      expect(response.length).toBeGreaterThan(100);
    }, 60000);
  });

  describe('enable_source response format', () => {
    it('should provide clear feedback for valid source', async () => {
      const response = await client.callToolText('enable_source', {
        source: 'sundell',
      });

      expect(response).toContain('enabled');
    });

    it('should provide helpful error for invalid source', async () => {
      const response = await client.callToolText('enable_source', {
        source: 'invalid_source',
      });

      expect(response).toContain('Unknown source');
      expect(response).toContain('Available sources');
    });

    it('should handle premium sources appropriately', async () => {
      const response = await client.callToolText('enable_source', {
        source: 'patreon',
      });

      expect(response).toMatch(/setup|enabled/i);
    });
  });

  describe('Response characteristics for AI consumption', () => {
    it('should use markdown formatting consistently', async () => {
      const responses = await Promise.all([
        client.callToolText('list_content_sources'),
        client.callToolText('get_swift_pattern', { topic: 'testing', minQuality: 50 }),
      ]);

      for (const response of responses) {
        expect(response).toMatch(/^#+ /m);
        expect(response).not.toMatch(/<div|<span|<p>/);
      }
    }, 60000);

    it('should have reasonable response length', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 70,
      });

      expect(response.length).toBeGreaterThan(50);
      expect(response.length).toBeLessThan(50000);
    }, 60000);

    it('should have clear structure with separators', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'concurrency',
        minQuality: 60,
      });

      if (!response.includes('No patterns found')) {
        expect(response).toMatch(/---/);
      }
    }, 60000);
  });
});
