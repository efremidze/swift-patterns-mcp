// src/integration/mcp-client.test.ts
// Integration tests for MCP protocol handshake and tool invocation
// Skipped on CI due to native dependency issues (keytar)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPTestClient, isCI } from './test-client.js';

const describeIntegration = isCI ? describe.skip : describe;

describeIntegration('MCP Server Integration', () => {
  let client: MCPTestClient;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.start();
  }, 10000);

  afterAll(async () => {
    await client.stop();
  });

  describe('Protocol Handshake', () => {
    it('should initialize with correct protocol version', async () => {
      const response = await client.initialize();

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as { protocolVersion: string; serverInfo: { name: string } };
      expect(result.protocolVersion).toBe('2024-11-05');
      expect(result.serverInfo.name).toBe('swift-mcp');
    });

    it('should list available tools', async () => {
      const response = await client.listTools();

      expect(response.error).toBeUndefined();

      const result = response.result as { tools: Array<{ name: string }> };
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThanOrEqual(4);

      const toolNames = result.tools.map(t => t.name);
      expect(toolNames).toContain('get_swift_pattern');
      expect(toolNames).toContain('search_swift_content');
      expect(toolNames).toContain('list_content_sources');
      expect(toolNames).toContain('enable_source');
    });
  });

  describe('Tool Invocation', () => {
    it('should call list_content_sources successfully', async () => {
      const response = await client.callTool('list_content_sources');

      expect(response.error).toBeUndefined();

      const result = response.result as { content: Array<{ type: string; text: string }> };
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Content Sources');
    });

    it('should call get_swift_pattern with topic', async () => {
      const response = await client.callTool('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 70,
      });

      expect(response.error).toBeUndefined();

      const result = response.result as { content: Array<{ type: string; text: string }> };
      expect(result.content).toBeDefined();
      expect(result.content[0].text.length).toBeGreaterThan(0);
    }, 60000);

    it('should handle enable_source with unknown source', async () => {
      const response = await client.callTool('enable_source', {
        source: 'unknown_source',
      });

      expect(response.error).toBeUndefined();

      const result = response.result as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain('Unknown source');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool gracefully', async () => {
      const response = await client.callTool('nonexistent_tool');

      const result = response.result as { content: Array<{ text: string }>; isError?: boolean };
      if (result.isError) {
        expect(result.content[0].text).toContain('Unknown tool');
      }
    });

    it('should handle missing required arguments gracefully', async () => {
      const response = await client.callTool('get_swift_pattern', {});

      expect(response.error).toBeUndefined();

      const result = response.result as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain('Missing required argument');
    }, 30000);
  });
});
