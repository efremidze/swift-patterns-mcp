// src/integration/test-client.ts
// Shared MCP test client for integration tests

import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import * as path from 'path';

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export class MCPTestClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (reason: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private rl: readline.Interface | null = null;
  private initialized = false;

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
          clearTimeout(pending.timeout);
          pending.resolve(response);
        }
      } catch {
        // Ignore non-JSON lines
      }
    });

    // Consume stderr to prevent blocking
    this.process.stderr?.on('data', () => {});

    this.process.on('exit', (code, signal) => {
      const reason = new Error(`MCP server exited (code=${code}, signal=${signal})`);
      for (const [, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(reason);
      }
      this.pendingRequests.clear();
      this.initialized = false;
    });

    // Explicit readiness handshake instead of fixed sleep.
    const response = await this.initialize();
    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }
    this.initialized = true;
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
    this.initialized = false;
  }

  async send(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    if (!this.process) {
      throw new Error('Client not started');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

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
    const response = await this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });
    if (!response.error) {
      this.initialized = true;
    }
    return response;
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

// Skip integration tests on CI
export const isCI = process.env.CI === 'true';
