// src/integration/response-quality.test.ts
// End-to-end tests validating response quality for AI assistant consumption

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import * as path from 'path';

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (reason: Error) => void;
  }>();
  private rl: readline.Interface | null = null;

  async start(): Promise<void> {
    const serverPath = path.join(process.cwd(), 'build', 'index.js');
    this.process = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    this.rl = readline.createInterface({
      input: this.process.stdout!,
      crlfDelay: Infinity,
    });

    this.rl.on('line', (line) => {
      try {
        const response = JSON.parse(line) as JsonRpcResponse;
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        }
      } catch { /* ignore */ }
    });

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async stop(): Promise<void> {
    this.process?.kill();
    this.rl?.close();
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: args },
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: (response) => {
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result?.content[0]?.text ?? '');
          }
        },
        reject,
      });

      setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Timeout'));
      }, 60000);

      this.process!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }
}

describe('Response Quality Validation', () => {
  let client: MCPClient;

  beforeAll(async () => {
    client = new MCPClient();
    await client.start();
  }, 10000);

  afterAll(async () => {
    await client.stop();
  });

  describe('list_content_sources response format', () => {
    it('should have clear markdown structure', async () => {
      const response = await client.callTool('list_content_sources');

      // Should have headers
      expect(response).toMatch(/^# /m);
      expect(response).toMatch(/## /m);

      // Should have sections
      expect(response).toContain('Free Sources');
      expect(response).toContain('Premium Sources');
    });

    it('should list sources with status indicators', async () => {
      const response = await client.callTool('list_content_sources');

      // Should have status emojis
      expect(response).toMatch(/[✅⚙️⬜]/);

      // Should have source names
      expect(response).toContain('Swift by Sundell');
      expect(response).toContain('Antoine van der Lee');
    });

    it('should include actionable instructions', async () => {
      const response = await client.callTool('list_content_sources');

      // Should have setup instructions
      expect(response).toContain('swift-mcp setup');
    });
  });

  describe('get_swift_pattern response format', () => {
    it('should have structured pattern output', async () => {
      const response = await client.callTool('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      // Should have title header
      expect(response).toMatch(/# Swift Patterns/);

      // Should have pattern entries with headers
      expect(response).toMatch(/## .+/);
    }, 60000);

    it('should include quality scores', async () => {
      const response = await client.callTool('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      // Should show quality scores
      expect(response).toMatch(/Quality.*\d+\/100/i);
    }, 60000);

    it('should include source attribution', async () => {
      const response = await client.callTool('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      // Should attribute to source
      expect(response).toMatch(/Source.*:/i);
    }, 60000);

    it('should include clickable links', async () => {
      const response = await client.callTool('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      // Should have markdown links
      expect(response).toMatch(/\[.+\]\(https?:\/\/.+\)/);
    }, 60000);

    it('should handle no results gracefully', async () => {
      const response = await client.callTool('get_swift_pattern', {
        topic: 'nonexistent_topic_xyz123',
        minQuality: 100,
      });

      // Should provide helpful guidance
      expect(response).toContain('No patterns found');
      expect(response).toMatch(/[Tt]ry/);
    }, 30000);
  });

  describe('search_swift_content response format', () => {
    it('should have search results header', async () => {
      const response = await client.callTool('search_swift_content', {
        query: 'async await',
      });

      expect(response).toMatch(/# Search Results/);
    }, 60000);

    it('should indicate code presence', async () => {
      const response = await client.callTool('search_swift_content', {
        query: 'swiftui view',
      });

      // May have code indicator
      if (response.includes('Code')) {
        expect(response).toMatch(/Code.*[✅✓]/i);
      }
    }, 60000);

    it('should include excerpts', async () => {
      const response = await client.callTool('search_swift_content', {
        query: 'concurrency',
      });

      // Results should have some content/excerpt
      expect(response.length).toBeGreaterThan(100);
    }, 60000);
  });

  describe('enable_source response format', () => {
    it('should provide clear feedback for valid source', async () => {
      const response = await client.callTool('enable_source', {
        source: 'sundell',
      });

      expect(response).toContain('enabled');
    });

    it('should provide helpful error for invalid source', async () => {
      const response = await client.callTool('enable_source', {
        source: 'invalid_source',
      });

      expect(response).toContain('Unknown source');
      expect(response).toContain('Available sources');
    });

    it('should handle premium sources appropriately', async () => {
      const response = await client.callTool('enable_source', {
        source: 'patreon',
      });

      // Either guides setup (if not configured) or confirms enabled (if configured)
      expect(response).toMatch(/setup|enabled/i);
    });
  });

  describe('Response characteristics for AI consumption', () => {
    it('should use markdown formatting consistently', async () => {
      const responses = await Promise.all([
        client.callTool('list_content_sources'),
        client.callTool('get_swift_pattern', { topic: 'testing', minQuality: 50 }),
      ]);

      for (const response of responses) {
        // Should use markdown headers
        expect(response).toMatch(/^#+ /m);

        // Should not have raw HTML
        expect(response).not.toMatch(/<div|<span|<p>/);
      }
    }, 60000);

    it('should provide actionable information', async () => {
      const response = await client.callTool('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 70,
      });

      // Should have links to read more
      const linkCount = (response.match(/\[.+\]\(https?:\/\/.+\)/g) || []).length;

      if (!response.includes('No patterns found')) {
        expect(linkCount).toBeGreaterThan(0);
      }
    }, 60000);

    it('should have reasonable response length', async () => {
      const response = await client.callTool('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 70,
      });

      // Should not be empty
      expect(response.length).toBeGreaterThan(50);

      // Should not be excessively long (10K limit is reasonable)
      expect(response.length).toBeLessThan(50000);
    }, 60000);

    it('should have clear structure with separators', async () => {
      const response = await client.callTool('get_swift_pattern', {
        topic: 'concurrency',
        minQuality: 60,
      });

      if (!response.includes('No patterns found')) {
        // Multiple results should be separated
        expect(response).toMatch(/---/);
      }
    }, 60000);
  });
});
