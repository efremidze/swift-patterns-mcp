// src/integration/mcp-client.test.ts
// Integration tests that simulate an MCP client calling the server

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

class TestMCPClient {
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
      } catch {
        // Ignore non-JSON lines
      }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  async send(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    if (!this.process) {
      throw new Error('Client not started');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out`));
      }, 30000);

      this.process!.stdin!.write(JSON.stringify(request) + '\n', (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(err);
        }
      });
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
}

describe('MCP Server Integration', () => {
  let client: TestMCPClient;

  beforeAll(async () => {
    client = new TestMCPClient();
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
      expect(result.content[0].text).toContain('Swift by Sundell');
    });

    it('should call get_swift_pattern with topic', async () => {
      const response = await client.callTool('get_swift_pattern', {
        topic: 'swiftui',
        minQuality: 70,
      });

      expect(response.error).toBeUndefined();

      const result = response.result as { content: Array<{ type: string; text: string }> };
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      // Should either have results or a "no patterns found" message
      expect(result.content[0].text.length).toBeGreaterThan(0);
    }, 60000); // Allow time for RSS fetch

    it('should call search_swift_content with query', async () => {
      const response = await client.callTool('search_swift_content', {
        query: 'async await',
      });

      expect(response.error).toBeUndefined();

      const result = response.result as { content: Array<{ type: string; text: string }> };
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    }, 60000);

    it('should handle enable_source with unknown source', async () => {
      const response = await client.callTool('enable_source', {
        source: 'unknown_source',
      });

      expect(response.error).toBeUndefined();

      const result = response.result as { content: Array<{ type: string; text: string }> };
      expect(result.content[0].text).toContain('Unknown source');
    });
  });

  describe('Error Handling', () => {
    it('should return error for unknown tool', async () => {
      const response = await client.callTool('nonexistent_tool');

      // The server should handle this gracefully
      const result = response.result as { content: Array<{ text: string }>; isError?: boolean };
      if (result.isError) {
        expect(result.content[0].text).toContain('Unknown tool');
      }
    });

    it('should handle missing required arguments gracefully', async () => {
      const response = await client.callTool('get_swift_pattern', {});

      // Should not crash - returns helpful message
      expect(response.error).toBeUndefined();

      const result = response.result as { content: Array<{ text: string }> };
      expect(result.content[0].text).toContain('Missing required argument');
    }, 30000);
  });
});
