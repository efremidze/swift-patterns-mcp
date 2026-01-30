#!/usr/bin/env npx tsx
/**
 * Manual test: Query Patreon source for "Apple Books Hero Effect"
 */

import 'dotenv/config';
import { MCPTestClient } from '../src/integration/test-client.js';
import { PatreonSource } from '../src/sources/premium/patreon.js';

async function main() {
  const client = new MCPTestClient();
  console.log('Starting MCP server...');
  await client.start();
  await client.initialize();

  // 1. List tools
  console.log('\n═══ Available Tools ═══');
  const toolsResp = await client.listTools();
  const tools = (toolsResp.result as any).tools.map((t: any) => t.name);
  console.log(tools.join(', '));

  // 2. Query free sources
  console.log('\n═══ Free Sources: "Apple Books Hero Effect" ═══');
  try {
    const freeText = await client.callToolText('get_swift_pattern', {
      topic: 'Apple Books Hero Effect',
      minQuality: 0,
    });
    console.log(freeText.substring(0, 2000));
  } catch (e: any) {
    console.log('Error:', e.message);
  }

  // 3. Search
  console.log('\n═══ Search: "Apple Books Hero Effect SwiftUI" ═══');
  try {
    const searchText = await client.callToolText('search_swift_content', {
      query: 'Apple Books Hero Effect SwiftUI',
      requireCode: true,
    });
    console.log(searchText.substring(0, 2000));
  } catch (e: any) {
    console.log('Error:', e.message);
  }

  // 4. Patreon source if available
  if (tools.includes('get_patreon_patterns')) {
    console.log('\n═══ Patreon: "Apple Books Hero Effect" ═══');
    try {
      const patreonText = await client.callToolText('get_patreon_patterns', {
        topic: 'Apple Books Hero Effect',
        minQuality: 0,
      });
      console.log(patreonText.substring(0, 3000));
    } catch (e: any) {
      console.log('Error:', e.message);
    }
  } else {
    console.log('\n═══ Patreon tool not registered ═══');
    console.log('Attempting to enable patreon source...');
    try {
      const enableText = await client.callToolText('enable_source', { source: 'patreon' });
      console.log(enableText);
    } catch (e: any) {
      console.log('Enable error:', e.message);
    }
  }

  // 5. Direct PatreonSource
  console.log('\n═══ Direct PatreonSource.searchPatterns("Apple Books Hero Effect") ═══');
  try {
    const patreon = new PatreonSource();

    if (!patreon.isAvailable()) {
      console.log('PatreonSource not available (missing PATREON_CLIENT_ID/SECRET)');
    } else {
      const patterns = await patreon.searchPatterns('Apple Books Hero Effect');
      console.log(`Found ${patterns.length} patterns:`);
      for (const p of patterns.slice(0, 5)) {
        console.log(`\n  [Score: ${p.relevanceScore}] ${p.title}`);
        console.log(`    URL: ${p.url}`);
        console.log(`    Code: ${p.hasCode}, Topics: ${p.topics.join(', ')}`);
        if (p.content && p.content.length > 100) {
          console.log(`    Content preview: ${p.content.substring(0, 200)}...`);
        }
      }
    }
  } catch (e: any) {
    console.log('Direct PatreonSource error:', e.message);
  }

  await client.stop();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
