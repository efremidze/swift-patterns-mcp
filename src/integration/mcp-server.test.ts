// src/integration/mcp-server.test.ts
// Integration tests for MCP server - protocol and response quality

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import * as path from 'path';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

class MCPTestClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (reason: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private rl: readline.Interface | null = null;
  private stopped = false;

  async start(): Promise<void> {
    const serverPath = path.join(process.cwd(), 'build', 'index.js');
    this.stopped = false;

    this.process = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    // Handle process errors
    this.process.on('error', (err) => {
      this.rejectAllPending(err);
    });

    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        this.rejectAllPending(new Error(`Server exited with code ${code}`));
      }
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
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        }
      } catch {
        // Ignore non-JSON lines
      }
    });

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private rejectAllPending(err: Error): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.rejectAllPending(new Error('Client stopped'));

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  async send(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    if (this.stopped || !this.process || !this.process.stdin || this.process.stdin.destroyed) {
      throw new Error('Client not available');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        this.process!.stdin!.write(JSON.stringify(request) + '\n', (err) => {
          if (err) {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(err);
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  async initialize(): Promise<JsonRpcResponse> {
    return this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
  }

  async listTools(): Promise<JsonRpcResponse> {
    return this.send('tools/list', {});
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    return this.send('tools/call', { name, arguments: args });
  }

  async callToolText(name: string, args: Record<string, unknown> = {}): Promise<string> {
    const response = await this.callTool(name, args);
    if (response.error) throw new Error(response.error.message);
    const result = response.result as { content: Array<{ text: string }> };
    return result.content[0]?.text ?? '';
  }
}

describe('MCP Server Integration', () => {
  let client: MCPTestClient;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.start();
  }, 10000);

  afterAll(async () => {
    await client.stop();
  });

  // ============================================================
  // Protocol Tests
  // ============================================================

  describe('Protocol', () => {
    it('should initialize with correct protocol version', async () => {
      const response = await client.initialize();

      expect(response.error).toBeUndefined();
      const result = response.result as { protocolVersion: string; serverInfo: { name: string } };
      expect(result.protocolVersion).toBe('2024-11-05');
      expect(result.serverInfo.name).toBe('swift-mcp');
    });

    it('should list core tools', async () => {
      const response = await client.listTools();

      expect(response.error).toBeUndefined();
      const result = response.result as { tools: Array<{ name: string }> };
      const toolNames = result.tools.map(t => t.name);

      expect(toolNames).toContain('get_swift_pattern');
      expect(toolNames).toContain('search_swift_content');
      expect(toolNames).toContain('list_content_sources');
      expect(toolNames).toContain('enable_source');
    });

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

  // ============================================================
  // Tool Response Tests
  // ============================================================

  describe('list_content_sources', () => {
    it('should return markdown with sources', async () => {
      const text = await client.callToolText('list_content_sources');

      expect(text).toMatch(/^# /m);
      expect(text).toContain('Free Sources');
      expect(text).toContain('Premium Sources');
      expect(text).toContain('Swift by Sundell');
      expect(text).toMatch(/[✅⚙️⬜]/);
    });
  });

  describe('get_swift_pattern', () => {
    it('should return structured patterns with quality scores', async () => {
      const text = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 60,
      });

      expect(text).toMatch(/# Swift Patterns/);
      expect(text).toMatch(/## .+/);
      expect(text).toMatch(/Quality.*\d+\/100/i);
      expect(text).toMatch(/Source.*:/i);
      expect(text).toMatch(/\[.+\]\(https?:\/\/.+\)/);
    }, 60000);

    it('should handle no results gracefully', async () => {
      const text = await client.callToolText('get_swift_pattern', {
        topic: 'nonexistent_xyz123',
        minQuality: 100,
      });

      expect(text).toContain('No patterns found');
      expect(text).toMatch(/[Tt]ry/);
    }, 30000);
  });

  describe('search_swift_content', () => {
    it('should return search results with excerpts', async () => {
      const text = await client.callToolText('search_swift_content', {
        query: 'async await',
      });

      expect(text).toMatch(/# Search Results/);
      expect(text.length).toBeGreaterThan(100);
    }, 60000);
  });

  describe('enable_source', () => {
    it('should provide feedback for valid source', async () => {
      const text = await client.callToolText('enable_source', { source: 'sundell' });
      expect(text).toContain('enabled');
    });

    it('should list available sources for invalid source', async () => {
      const text = await client.callToolText('enable_source', { source: 'invalid' });
      expect(text).toContain('Unknown source');
      expect(text).toContain('Available sources');
    });
  });

  // ============================================================
  // Response Quality Tests
  // ============================================================

  describe('Response Quality', () => {
    it('should use markdown formatting consistently', async () => {
      const responses = await Promise.all([
        client.callToolText('list_content_sources'),
        client.callToolText('get_swift_pattern', { topic: 'testing', minQuality: 50 }),
      ]);

      for (const text of responses) {
        expect(text).toMatch(/^#+ /m);
        expect(text).not.toMatch(/<div|<span|<p>/);
      }
    }, 60000);

    it('should have reasonable response length', async () => {
      const text = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 70,
      });

      expect(text.length).toBeGreaterThan(50);
      expect(text.length).toBeLessThan(50000);
    }, 60000);

    it('should separate multiple results clearly', async () => {
      const text = await client.callToolText('get_swift_pattern', {
        topic: 'concurrency',
        minQuality: 60,
      });

      if (!text.includes('No patterns found')) {
        expect(text).toMatch(/---/);
      }
    }, 60000);
  });
});
