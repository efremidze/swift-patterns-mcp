#!/usr/bin/env node
/* global console, process */
/**
 * MCP benchmark runner for local baseline tracking.
 *
 * Usage:
 *   node scripts/benchmark-mcp.js
 *   node scripts/benchmark-mcp.js --runs 5 --out docs/benchmarks/latest.json
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import { MCPTestClient } from '../build/integration/test-client.js';

const DEFAULT_RUNS = 5;

const SCENARIOS = [
  { name: 'list sources', tool: 'list_content_sources', args: {} },
  { name: 'enable unknown source (error path)', tool: 'enable_source', args: { source: 'invalid_source_xyz' } },
  { name: 'search swift content', tool: 'search_swift_content', args: { query: 'async await' } },
  { name: 'get swift pattern', tool: 'get_swift_pattern', args: { topic: 'swiftui', minQuality: 70 } },
];

function parseArgs() {
  const args = process.argv.slice(2);
  let runs = DEFAULT_RUNS;
  let outPath;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--runs') {
      runs = Number.parseInt(args[i + 1] ?? '', 10);
      i++;
    } else if (arg === '--out') {
      outPath = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/benchmark-mcp.js [--runs N] [--out PATH]');
      process.exit(0);
    }
  }

  if (!Number.isFinite(runs) || runs <= 0) {
    throw new Error(`Invalid --runs value: ${runs}`);
  }

  return { runs, outPath };
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[idx].toFixed(2));
}

function mean(values) {
  if (values.length === 0) return null;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}

function min(values) {
  return values.length === 0 ? null : Number(Math.min(...values).toFixed(2));
}

function max(values) {
  return values.length === 0 ? null : Number(Math.max(...values).toFixed(2));
}

function getCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

async function runSingle(client, scenario) {
  const start = performance.now();
  await client.callToolText(scenario.tool, scenario.args);
  return Number((performance.now() - start).toFixed(2));
}

function summarize(scenario, runs, timings, errors) {
  return {
    scenario,
    runs,
    successes: timings.length,
    failures: errors.length,
    p50_ms: percentile(timings, 50),
    p90_ms: percentile(timings, 90),
    p99_ms: percentile(timings, 99),
    min_ms: min(timings),
    max_ms: max(timings),
    mean_ms: mean(timings),
    errors,
  };
}

async function runCold(runs) {
  const results = [];

  for (const scenario of SCENARIOS) {
    const timings = [];
    const errors = [];

    for (let i = 0; i < runs; i++) {
      const client = new MCPTestClient();
      try {
        await client.start();
        const ms = await runSingle(client, scenario);
        timings.push(ms);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      } finally {
        await client.stop();
      }
    }

    results.push(summarize(scenario, runs, timings, errors));
  }

  return results;
}

async function runWarm(runs) {
  const client = new MCPTestClient();
  const results = [];
  await client.start();

  try {
    for (const scenario of SCENARIOS) {
      const timings = [];
      const errors = [];

      for (let i = 0; i < runs; i++) {
        try {
          const ms = await runSingle(client, scenario);
          timings.push(ms);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }

      results.push(summarize(scenario, runs, timings, errors));
    }
  } finally {
    await client.stop();
  }

  return results;
}

function defaultOutPath() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return path.join('docs', 'benchmarks', `${yyyy}-${mm}-${dd}.json`);
}

function printSummary(label, results) {
  console.log(`\n${label}`);
  const formatMs = (value) => (value == null ? 'n/a' : `${value}ms`);
  for (const r of results) {
    console.log(
      `- ${r.scenario.tool} (${r.scenario.name}): ` +
      `ok=${r.successes}/${r.runs} ` +
      `p50=${formatMs(r.p50_ms)} p90=${formatMs(r.p90_ms)} p99=${formatMs(r.p99_ms)}`
    );
  }
}

async function main() {
  const { runs, outPath } = parseArgs();
  const reportPath = outPath ?? defaultOutPath();

  console.log(`Running MCP benchmarks (${runs} runs/scenario)...`);
  const cold = await runCold(runs);
  const warm = await runWarm(runs);

  const report = {
    createdAt: new Date().toISOString(),
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    commit: getCommit(),
    runsPerScenario: runs,
    cold,
    warm,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

  printSummary('Cold start results', cold);
  printSummary('Warm process results', warm);
  console.log(`\nSaved baseline: ${reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
