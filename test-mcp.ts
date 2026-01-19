// test-mcp.ts - Manual MCP handler testing script
// Run with: npx tsx test-mcp.ts

import SourceManager from './src/config/sources.js';
import { getSwiftPatternHandler } from './src/tools/handlers/getSwiftPattern.js';
import { searchSwiftContentHandler } from './src/tools/handlers/searchSwiftContent.js';
import { listContentSourcesHandler } from './src/tools/handlers/listContentSources.js';
import type { ToolContext } from './src/tools/types.js';

// Create context
const sourceManager = new SourceManager();
const context: ToolContext = {
  sourceManager,
  patreonSource: null,
};

async function testListSources() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: list_content_sources');
  console.log('='.repeat(60));

  const result = await listContentSourcesHandler({}, context);
  console.log(result.content[0].text);
}

async function testGetSwiftPattern(topic: string, options: Record<string, unknown> = {}) {
  console.log('\n' + '='.repeat(60));
  console.log(`TEST: get_swift_pattern (topic="${topic}")`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  const result = await getSwiftPatternHandler({ topic, ...options }, context);
  const elapsed = Date.now() - startTime;

  console.log(`[Completed in ${elapsed}ms]`);
  console.log(result.content[0].text);
}

async function testSearchContent(query: string, options: Record<string, unknown> = {}) {
  console.log('\n' + '='.repeat(60));
  console.log(`TEST: search_swift_content (query="${query}")`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  const result = await searchSwiftContentHandler({ query, ...options }, context);
  const elapsed = Date.now() - startTime;

  console.log(`[Completed in ${elapsed}ms]`);
  console.log(result.content[0].text);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           MCP Handler Manual Test Suite                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Test 1: List content sources
    await testListSources();

    // Test 2: Get Swift patterns for common topics
    await testGetSwiftPattern('swiftui');
    await testGetSwiftPattern('concurrency', { minQuality: 50 });
    await testGetSwiftPattern('testing', { source: 'sundell' });

    // Test 3: Search content
    await testSearchContent('async await');
    await testSearchContent('view modifier', { requireCode: true });

    // Test 4: Edge cases
    console.log('\n' + '='.repeat(60));
    console.log('TEST: Edge Cases');
    console.log('='.repeat(60));

    // Non-existent topic
    await testGetSwiftPattern('nonexistenttopic12345', { minQuality: 90 });

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
