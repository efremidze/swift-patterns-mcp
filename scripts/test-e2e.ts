#!/usr/bin/env npx tsx
/**
 * End-to-end CLI test suite.
 *
 * Covers representative MCP flows:
 * 1) get_swift_pattern happy path
 * 2) search_swift_content happy path
 * 3) Patreon routing guidance from get_swift_pattern
 * 4) get_patreon_patterns (when Patreon credentials are configured)
 * 5) Error handling for invalid source
 */

import 'dotenv/config';
import { MCPTestClient } from '../src/integration/test-client.js';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  skipped?: boolean;
  durationMs: number;
}

const results: TestResult[] = [];

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function runTest(
  name: string,
  fn: () => Promise<void>,
  options?: { skip?: boolean; skipReason?: string }
): Promise<void> {
  const start = Date.now();
  if (options?.skip) {
    const durationMs = Date.now() - start;
    results.push({
      name,
      passed: true,
      skipped: true,
      details: options.skipReason ?? 'skipped',
      durationMs,
    });
    console.log(`SKIP ${name} (${options.skipReason ?? 'skipped'})`);
    return;
  }

  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs });
    console.log(`PASS ${name} (${durationMs}ms)`);
  } catch (error) {
    const durationMs = Date.now() - start;
    const details = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, details, durationMs });
    console.log(`FAIL ${name} (${durationMs}ms)`);
    console.log(`  ${details}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function extractCount(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isNaN(value) ? null : value;
}

function preview(text: string): string {
  const firstNonEmptyLine = text.split('\n').find(line => line.trim().length > 0) ?? '';
  return firstNonEmptyLine.length > 120
    ? `${firstNonEmptyLine.slice(0, 117)}...`
    : firstNonEmptyLine;
}

async function main(): Promise<void> {
  const client = new MCPTestClient();
  console.log('Starting MCP server...');
  await client.start();

  try {
    await runTest('get_swift_pattern happy path', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'swiftui navigation',
        minQuality: 70,
      });

      assert(hasText(response), 'Expected non-empty response');
      assert(!response.includes('No patterns found'), 'Expected at least one pattern result');
      assert(response.includes('## '), 'Expected markdown pattern sections');

      const count = extractCount(response, /Found\s+(\d+)\s+results?/i);
      const shown = count ?? (response.match(/^## /gm) || []).length;
      console.log(`  get_swift_pattern returned ${shown} result(s)`);
      console.log(`  preview: ${preview(response)}`);
    });

    await runTest('search_swift_content happy path', async () => {
      const response = await client.callToolText('search_swift_content', {
        query: 'async await',
        requireCode: true,
      });

      assert(hasText(response), 'Expected non-empty response');
      assert(!response.includes('No results found'), 'Expected at least one search result');
      assert(response.includes('# Search Results'), 'Expected search results markdown');

      const count = extractCount(response, /Found\s+(\d+)\s+results?/i);
      const shown = count ?? (response.match(/^## /gm) || []).length;
      console.log(`  search_swift_content returned ${shown} result(s)`);
      console.log(`  preview: ${preview(response)}`);
    });

    await runTest('creator source routes to Patreon tool', async () => {
      const response = await client.callToolText('get_swift_pattern', {
        topic: 'dynamic island animation',
        source: 'kavsoft',
      });

      assert(response.includes('Patreon creator'), 'Expected Patreon creator guidance');
      assert(response.includes('get_patreon_patterns'), 'Expected get_patreon_patterns guidance');
      console.log(`  routing preview: ${preview(response)}`);
    });

    const hasPatreonEnv = Boolean(
      process.env.PATREON_CLIENT_ID &&
      process.env.PATREON_CLIENT_SECRET &&
      process.env.YOUTUBE_API_KEY
    );

    await runTest(
      'get_patreon_patterns flow',
      async () => {
        const response = await client.callToolText('get_patreon_patterns', {
          topic: 'Apple Stocks looping ScrollView',
          minQuality: 60,
          requireCode: true,
        });

        assert(hasText(response), 'Expected non-empty response');
        assert(!response.toLowerCase().includes('unknown tool'), 'Patreon tool should be available');
        console.log(`  patreon preview: ${preview(response)}`);
      },
      {
        skip: !hasPatreonEnv,
        skipReason: 'PATREON_CLIENT_ID/PATREON_CLIENT_SECRET/YOUTUBE_API_KEY not all set',
      }
    );

    await runTest('invalid source returns actionable error', async () => {
      const response = await client.callToolText('enable_source', {
        source: 'invalid_source_xyz',
      });

      assert(response.includes('Unknown source'), 'Expected unknown source error');
      assert(response.includes('Available sources'), 'Expected available sources in error message');
      console.log(`  error preview: ${preview(response)}`);
    });
  } finally {
    await client.stop();
  }

  const failed = results.filter(r => !r.passed);
  const skipped = results.filter(r => r.skipped);
  const passed = results.length - failed.length;

  console.log('\nSummary');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Skipped: ${skipped.length}`);

  if (failed.length > 0) {
    console.log('\nFailed tests:');
    for (const test of failed) {
      console.log(`  - ${test.name}: ${test.details ?? 'no details'}`);
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal test runner error:', error);
  process.exit(1);
});
