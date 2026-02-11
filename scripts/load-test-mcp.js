#!/usr/bin/env node
/* global console, process */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { MCPTestClient } from '../build/integration/test-client.js';

const DEFAULT_CONCURRENCY = 10;
const DEFAULT_MAX_P90_MS = 500;
const DEFAULT_MIN_SUCCESS_RATE = 1;

const REQUEST_SCENARIOS = [
  { name: 'list sources', tool: 'list_content_sources', args: {} },
  { name: 'search async await', tool: 'search_swift_content', args: { query: 'async await', requireCode: true } },
  { name: 'get swiftui pattern', tool: 'get_swift_pattern', args: { topic: 'swiftui', minQuality: 70 } },
  { name: 'enable invalid source', tool: 'enable_source', args: { source: 'invalid_source_xyz' } },
];

function parseArgs() {
  const args = process.argv.slice(2);
  let concurrency = DEFAULT_CONCURRENCY;
  let maxP90Ms = DEFAULT_MAX_P90_MS;
  let minSuccessRate = DEFAULT_MIN_SUCCESS_RATE;
  let outPath;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--concurrency') {
      concurrency = Number.parseInt(args[i + 1] ?? '', 10);
      i += 1;
    } else if (arg === '--max-p90') {
      maxP90Ms = Number.parseFloat(args[i + 1] ?? '');
      i += 1;
    } else if (arg === '--min-success-rate') {
      minSuccessRate = Number.parseFloat(args[i + 1] ?? '');
      i += 1;
    } else if (arg === '--out') {
      outPath = args[i + 1];
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/load-test-mcp.js [--concurrency N] [--max-p90 MS] [--min-success-rate RATE] [--out PATH]');
      process.exit(0);
    }
  }

  if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new Error(`Invalid --concurrency value: ${concurrency}`);
  }
  if (!Number.isFinite(maxP90Ms) || maxP90Ms <= 0) {
    throw new Error(`Invalid --max-p90 value: ${maxP90Ms}`);
  }
  if (!Number.isFinite(minSuccessRate) || minSuccessRate < 0 || minSuccessRate > 1) {
    throw new Error(`Invalid --min-success-rate value: ${minSuccessRate}`);
  }

  return { concurrency, maxP90Ms, minSuccessRate, outPath };
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[idx].toFixed(2));
}

function defaultOutPath() {
  return path.join('docs', 'benchmarks', 'load-latest.json');
}

async function runSingle(client, scenario) {
  const startedAt = performance.now();
  const response = await client.callTool(scenario.tool, scenario.args);
  const durationMs = Number((performance.now() - startedAt).toFixed(2));
  return {
    scenario: scenario.name,
    tool: scenario.tool,
    durationMs,
    ok: !response.error,
    error: response.error ? response.error.message : null,
  };
}

async function main() {
  const { concurrency, maxP90Ms, minSuccessRate, outPath } = parseArgs();
  const reportPath = outPath ?? defaultOutPath();

  const client = new MCPTestClient();
  await client.start();

  try {
    await client.callTool('list_content_sources', {});

    for (const scenario of REQUEST_SCENARIOS) {
      try {
        await client.callTool(scenario.tool, scenario.args);
      } catch {
        // Warm-up calls should not fail the test directly.
      }
    }

    const requests = Array.from({ length: concurrency }, (_, index) => {
      const scenario = REQUEST_SCENARIOS[index % REQUEST_SCENARIOS.length];
      return runSingle(client, scenario);
    });

    const results = await Promise.all(requests);
    const successful = results.filter((result) => result.ok);
    const durations = successful.map((result) => result.durationMs);
    const p50 = percentile(durations, 50);
    const p90 = percentile(durations, 90);
    const successRate = Number((successful.length / results.length).toFixed(4));

    const report = {
      createdAt: new Date().toISOString(),
      concurrency,
      threshold: {
        maxP90Ms,
        minSuccessRate,
      },
      summary: {
        totalRequests: results.length,
        successfulRequests: successful.length,
        failedRequests: results.length - successful.length,
        successRate,
        p50Ms: p50,
        p90Ms: p90,
      },
      results,
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

    console.log(`Load test complete: ${successful.length}/${results.length} succeeded`);
    console.log(`Latency p50=${p50 ?? 'n/a'}ms p90=${p90 ?? 'n/a'}ms`);
    console.log(`Saved report: ${reportPath}`);

    if (successRate < minSuccessRate) {
      throw new Error(`Success rate below threshold (${successRate} < ${minSuccessRate})`);
    }
    if (p90 != null && p90 > maxP90Ms) {
      throw new Error(`p90 latency above threshold (${p90}ms > ${maxP90Ms}ms)`);
    }
  } finally {
    await client.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
