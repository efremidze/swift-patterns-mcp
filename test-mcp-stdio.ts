// test-mcp-stdio.ts - Test MCP server via stdio transport (JSON-RPC)
// Run with: npx tsx test-mcp-stdio.ts

import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';

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

class MCPClient {
  private process: ChildProcess;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (reason: Error) => void;
  }>();
  private rl: readline.Interface;

  constructor() {
    // Spawn the MCP server
    this.process = spawn('node', ['build/index.js'], {
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
        // Ignore non-JSON lines (e.g., startup messages)
      }
    });

    this.process.stderr?.on('data', (data) => {
      console.log('[Server stderr]:', data.toString().trim());
    });
  }

  async send(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
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

      this.process.stdin!.write(JSON.stringify(request) + '\n', (err) => {
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
      clientInfo: {
        name: 'test-client',
        version: '1.0.0',
      },
    });
  }

  async listTools(): Promise<JsonRpcResponse> {
    return this.send('tools/list', {});
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<JsonRpcResponse> {
    return this.send('tools/call', { name, arguments: args });
  }

  close() {
    this.process.kill();
    this.rl.close();
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           MCP Server STDIO Transport Test                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const client = new MCPClient();

  try {
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: Initialize
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: Initialize');
    console.log('='.repeat(60));
    const initResult = await client.initialize();
    console.log('Server info:', JSON.stringify(initResult.result, null, 2));

    // Test 2: List Tools
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: List Tools');
    console.log('='.repeat(60));
    const toolsResult = await client.listTools();
    const tools = (toolsResult.result as { tools: Array<{ name: string; description: string }> }).tools;
    console.log(`Found ${tools.length} tools:`);
    tools.forEach(t => console.log(`  - ${t.name}: ${t.description.substring(0, 60)}...`));

    // Test 3: Call list_content_sources
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Call list_content_sources');
    console.log('='.repeat(60));
    const sourcesResult = await client.callTool('list_content_sources', {});
    const content = (sourcesResult.result as { content: Array<{ text: string }> }).content;
    console.log(content[0].text);

    // Test 4: Call get_swift_pattern
    console.log('\n' + '='.repeat(60));
    console.log('TEST 4: Call get_swift_pattern (topic: swiftui)');
    console.log('='.repeat(60));
    const startTime = Date.now();
    const patternResult = await client.callTool('get_swift_pattern', {
      topic: 'swiftui',
      minQuality: 80,
    });
    const patternContent = (patternResult.result as { content: Array<{ text: string }> }).content;
    console.log(`[Completed in ${Date.now() - startTime}ms]`);
    // Only show first 1000 chars to keep output manageable
    const text = patternContent[0].text;
    console.log(text.length > 1500 ? text.substring(0, 1500) + '\n...(truncated)' : text);

    // Test 5: Call search_swift_content
    console.log('\n' + '='.repeat(60));
    console.log('TEST 5: Call search_swift_content (query: async await)');
    console.log('='.repeat(60));
    const searchStart = Date.now();
    const searchResult = await client.callTool('search_swift_content', {
      query: 'async await',
      requireCode: true,
    });
    const searchContent = (searchResult.result as { content: Array<{ text: string }> }).content;
    console.log(`[Completed in ${Date.now() - searchStart}ms]`);
    const searchText = searchContent[0].text;
    console.log(searchText.length > 1500 ? searchText.substring(0, 1500) + '\n...(truncated)' : searchText);

    console.log('\n✅ All STDIO tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
