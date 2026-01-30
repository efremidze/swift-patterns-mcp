#!/usr/bin/env npx tsx
/**
 * Manual MCP query tester — probe any tool with any query.
 *
 * Usage:
 *   npx tsx scripts/test-query.ts <query>                    # search all tools
 *   npx tsx scripts/test-query.ts <query> --tool <tool>      # specific tool
 *   npx tsx scripts/test-query.ts <query> --code             # require code
 *   npx tsx scripts/test-query.ts <query> --min-quality 70   # quality floor
 *   npx tsx scripts/test-query.ts <query> --source sundell   # specific source
 *   npx tsx scripts/test-query.ts <query> --patreon          # Patreon only
 *   npx tsx scripts/test-query.ts <query> --direct           # bypass MCP, call PatreonSource directly
 *   npx tsx scripts/test-query.ts <query> --limit 10         # max results to display
 *   npx tsx scripts/test-query.ts <query> --json             # raw JSON output
 *   npx tsx scripts/test-query.ts --tools                    # just list tools
 *
 * Examples:
 *   npx tsx scripts/test-query.ts "Apple Books Hero Effect"
 *   npx tsx scripts/test-query.ts "SwiftUI navigation" --tool get_swift_pattern --min-quality 80
 *   npx tsx scripts/test-query.ts "async await" --code --source sundell
 *   npx tsx scripts/test-query.ts "LoopingScrollView" --patreon --direct
 */

import 'dotenv/config';
import { MCPTestClient } from '../src/integration/test-client.js';
import { PatreonSource } from '../src/sources/premium/patreon.js';

// ── CLI Parsing ──

interface Options {
  query: string;
  tool?: string;
  requireCode: boolean;
  minQuality: number;
  source?: string;
  patreonOnly: boolean;
  direct: boolean;
  limit: number;
  json: boolean;
  listTools: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {
    query: '',
    requireCode: false,
    minQuality: 0,
    patreonOnly: false,
    direct: false,
    limit: 5,
    json: false,
    listTools: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case '--tool':
        opts.tool = args[++i];
        break;
      case '--code':
        opts.requireCode = true;
        break;
      case '--min-quality':
        opts.minQuality = parseInt(args[++i], 10);
        break;
      case '--source':
        opts.source = args[++i];
        break;
      case '--patreon':
        opts.patreonOnly = true;
        break;
      case '--direct':
        opts.direct = true;
        break;
      case '--limit':
        opts.limit = parseInt(args[++i], 10);
        break;
      case '--json':
        opts.json = true;
        break;
      case '--tools':
        opts.listTools = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break; // eslint: no-fallthrough
      default:
        if (!arg.startsWith('--')) {
          opts.query = arg;
        }
        break;
    }
    i++;
  }

  if (!opts.query && !opts.listTools) {
    printUsage();
    process.exit(1);
  }

  return opts;
}

function printUsage() {
  console.log(`Usage: npx tsx scripts/test-query.ts <query> [options]

Options:
  --tool <name>        Call a specific tool (get_swift_pattern, search_swift_content, get_patreon_patterns)
  --code               Only return results with code examples
  --min-quality <n>    Minimum quality score (default: 0)
  --source <id>        Specific free source (sundell, vanderlee, nilcoalescing, pointfree)
  --patreon            Query Patreon source only
  --direct             Bypass MCP server, call PatreonSource directly
  --limit <n>          Max results to display (default: 5)
  --json               Output raw JSON
  --tools              Just list available tools
  -h, --help           Show this help`);
}

// ── Formatters ──

function printSeparator(title: string) {
  console.log(`\n═══ ${title} ═══\n`);
}

function printToolResult(name: string, text: string, limit: number) {
  // Truncate to roughly `limit` results by finding separator positions
  const lines = text.split('\n');
  let separatorCount = 0;
  let cutoff = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      separatorCount++;
      if (separatorCount >= limit) {
        cutoff = i;
        break;
      }
    }
  }
  const truncated = lines.slice(0, cutoff).join('\n');
  console.log(truncated);
  if (cutoff < lines.length) {
    console.log(`\n... (truncated to ${limit} results, use --limit to show more)`);
  }
}

function printPatreonPattern(p: { relevanceScore: number; title: string; url: string; hasCode: boolean; topics: string[]; content?: string; creator?: string }) {
  console.log(`  [Score: ${p.relevanceScore}] ${p.title}`);
  if (p.creator) console.log(`    Creator: ${p.creator}`);
  console.log(`    URL: ${p.url}`);
  console.log(`    Code: ${p.hasCode}, Topics: ${p.topics.join(', ') || 'none'}`);
  if (p.content && p.content.length > 100) {
    console.log(`    Preview: ${p.content.substring(0, 200).replace(/\n/g, ' ')}...`);
  }
  console.log();
}

// ── Main ──

async function main() {
  const opts = parseArgs();

  // Direct PatreonSource mode — no MCP server needed
  if (opts.direct) {
    printSeparator(`Direct PatreonSource: "${opts.query}"`);
    const patreon = new PatreonSource();
    if (!patreon.isAvailable()) {
      console.log('PatreonSource not available (missing PATREON_CLIENT_ID/SECRET)');
      return;
    }
    const patterns = await patreon.searchPatterns(opts.query);
    let filtered = opts.requireCode ? patterns.filter(p => p.hasCode) : patterns;
    filtered = filtered.filter(p => p.relevanceScore >= opts.minQuality);

    console.log(`Found ${filtered.length} patterns${opts.requireCode ? ' (code only)' : ''}:\n`);

    if (opts.json) {
      console.log(JSON.stringify(filtered.slice(0, opts.limit), null, 2));
    } else {
      for (const p of filtered.slice(0, opts.limit)) {
        printPatreonPattern(p);
      }
    }
    return;
  }

  // MCP server mode
  const client = new MCPTestClient();
  console.log('Starting MCP server...');
  await client.start();
  await client.initialize();

  try {
    // List tools
    const toolsResp = await client.listTools();
    const result = toolsResp.result as { tools: Array<{ name: string }> };
    const tools = result.tools.map(t => t.name);

    if (opts.listTools) {
      printSeparator('Available Tools');
      for (const t of tools) console.log(`  - ${t}`);
      return;
    }

    // Determine which tools to call
    const toolsToCall: Array<{ name: string; args: Record<string, unknown> }> = [];

    if (opts.tool) {
      // Specific tool
      const args: Record<string, unknown> = {};
      if (['get_swift_pattern', 'get_patreon_patterns'].includes(opts.tool)) {
        args.topic = opts.query;
      } else {
        args.query = opts.query;
      }
      if (opts.minQuality > 0) args.minQuality = opts.minQuality;
      if (opts.requireCode) args.requireCode = true;
      if (opts.source) args.source = opts.source;
      toolsToCall.push({ name: opts.tool, args });
    } else if (opts.patreonOnly) {
      // Patreon only
      if (!tools.includes('get_patreon_patterns')) {
        console.log('get_patreon_patterns not available. Tools:', tools.join(', '));
        return;
      }
      toolsToCall.push({
        name: 'get_patreon_patterns',
        args: {
          topic: opts.query,
          ...(opts.minQuality > 0 && { minQuality: opts.minQuality }),
          ...(opts.requireCode && { requireCode: true }),
        },
      });
    } else {
      // All relevant tools
      toolsToCall.push({
        name: 'get_swift_pattern',
        args: {
          topic: opts.query,
          minQuality: opts.minQuality,
          ...(opts.source && { source: opts.source }),
        },
      });
      toolsToCall.push({
        name: 'search_swift_content',
        args: {
          query: opts.query,
          ...(opts.requireCode && { requireCode: true }),
        },
      });
      if (tools.includes('get_patreon_patterns')) {
        toolsToCall.push({
          name: 'get_patreon_patterns',
          args: {
            topic: opts.query,
            ...(opts.minQuality > 0 && { minQuality: opts.minQuality }),
            ...(opts.requireCode && { requireCode: true }),
          },
        });
      }
    }

    // Execute
    for (const { name, args } of toolsToCall) {
      printSeparator(`${name}: "${opts.query}"`);
      try {
        if (opts.json) {
          const resp = await client.callTool(name, args);
          console.log(JSON.stringify(resp.result, null, 2));
        } else {
          const text = await client.callToolText(name, args);
          printToolResult(name, text, opts.limit);
        }
      } catch (e: unknown) {
        console.log(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } finally {
    await client.stop();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
