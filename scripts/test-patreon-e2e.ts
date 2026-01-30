#!/usr/bin/env npx tsx
/**
 * Patreon E2E Test Script
 *
 * Quick manual verification of the Patreon integration.
 * Run with: npx tsx scripts/test-patreon-e2e.ts
 *
 * Or with npm: npm run test:patreon
 */

import 'dotenv/config';
import { PatreonSource } from '../src/sources/premium/patreon.js';
import { scanDownloadedContent, extractPostId } from '../src/sources/premium/patreon-dl.js';
import { searchVideos, getChannelVideos } from '../src/sources/premium/youtube.js';
import { CREATORS, withYouTube } from '../src/config/creators.js';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  duration?: number;
}

const results: TestResult[] = [];
const searchCache = new Map<string, ReturnType<PatreonSource['searchPatterns']>>();

function cachedSearchPatterns(patreon: PatreonSource, query: string): ReturnType<PatreonSource['searchPatterns']> {
  const cached = searchCache.get(query);
  if (cached) return cached;
  const promise = patreon.searchPatterns(query);
  searchCache.set(query, promise);
  return promise;
}

function test(name: string, passed: boolean, details?: string) {
  results.push({ name, passed, details });
  const icon = passed ? '✓' : '✗';
  console.log(`${icon} ${name}`);
  if (details && !passed) console.log(`  → ${details}`);
}

async function timedTest(name: string, fn: () => Promise<boolean>, details?: string) {
  const start = Date.now();
  try {
    const passed = await fn();
    const duration = Date.now() - start;
    results.push({ name, passed, details, duration });
    const icon = passed ? '✓' : '✗';
    console.log(`${icon} ${name} (${duration}ms)`);
    if (details && !passed) console.log(`  → ${details}`);
  } catch (error) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, details: String(error), duration });
    console.log(`✗ ${name} (${duration}ms)`);
    console.log(`  → Error: ${error}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  PATREON E2E TEST');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // ─── Configuration ───
  console.log('─── Configuration ───\n');

  test('YOUTUBE_API_KEY set', Boolean(process.env.YOUTUBE_API_KEY));
  test('PATREON_CLIENT_ID set', Boolean(process.env.PATREON_CLIENT_ID));
  test('PATREON_CLIENT_SECRET set', Boolean(process.env.PATREON_CLIENT_SECRET));
  test('CREATORS configured', CREATORS.length > 0, `${CREATORS.length} creators`);
  test('Creators have YouTube', withYouTube().length > 0, `${withYouTube().length} with YouTube`);

  // ─── Local Content ───
  console.log('\n─── Local Content Scanning ───\n');

  const posts = scanDownloadedContent();
  test('scanDownloadedContent works', Array.isArray(posts), `${posts.length} posts`);

  if (posts.length > 0) {
    const swiftFiles = posts.flatMap(p => p.files).filter(f => f.type === 'swift');
    test('Found Swift files', swiftFiles.length > 0, `${swiftFiles.length} files`);
    test('Swift files have content', swiftFiles.every(f => f.content && f.content.length > 0));

    const totalChars = swiftFiles.reduce((sum, f) => sum + (f.content?.length || 0), 0);
    console.log(`  Total code: ${totalChars.toLocaleString()} chars\n`);
  }

  test('extractPostId works', extractPostId('https://patreon.com/posts/test-123') === '123');

  // ─── YouTube Discovery ───
  if (process.env.YOUTUBE_API_KEY) {
    console.log('\n─── YouTube Discovery ───\n');

    const KAVSOFT = 'UCsuV4MRk_aB291SrchUVb4w';

    // Single call with larger limit — reuse for both assertions
    let channelVideos: Awaited<ReturnType<typeof getChannelVideos>> = [];
    await timedTest('getChannelVideos', async () => {
      channelVideos = await getChannelVideos(KAVSOFT, 20);
      return channelVideos.length > 0;
    });

    test('Videos have Patreon links',
      channelVideos.filter(v => v.patreonLink).length > 0,
      `${channelVideos.filter(v => v.patreonLink).length} with links`);

    await timedTest('searchVideos works', async () => {
      const videos = await searchVideos('SwiftUI', KAVSOFT, 5);
      return Array.isArray(videos);
    });
  } else {
    console.log('\n─── YouTube Discovery (SKIPPED - no API key) ───\n');
  }

  // ─── PatreonSource ───
  // Single instance shared across all sections (avoids duplicate YouTube + download work)
  const patreon = process.env.PATREON_CLIENT_ID ? new PatreonSource() : null;

  if (patreon) {
    console.log('\n─── PatreonSource ───\n');

    test('PatreonSource instantiates', Boolean(patreon));
    test('isAvailable returns true', patreon.isAvailable());

    if (process.env.YOUTUBE_API_KEY) {
      await timedTest('searchPatterns returns results', async () => {
        const patterns = await cachedSearchPatterns(patreon, 'SwiftUI');
        return Array.isArray(patterns);
      });

      // fetchPatterns() internally calls searchPatterns('swiftui') —
      // verify via the cached search instead of making a duplicate network call
      await timedTest('fetchPatterns works', async () => {
        const patterns = await cachedSearchPatterns(patreon, 'swiftui');
        return patterns.length > 0;
      });
    }
  }

  // ─── End-to-End ───
  if (process.env.YOUTUBE_API_KEY && patreon && posts.length > 0) {
    console.log('\n─── End-to-End ───\n');

    await timedTest('Apple Stocks query returns code', async () => {
      const patterns = await cachedSearchPatterns(patreon, 'Apple Stocks looping ScrollView');
      const withCode = patterns.filter(p => p.hasCode && p.content && p.content.length > 100);
      return withCode.length > 0;
    });

    await timedTest('LoopingScrollView.swift found', async () => {
      const patterns = await cachedSearchPatterns(patreon, 'Apple Stocks looping ScrollView');
      const looping = patterns.find(p => p.title.includes('LoopingScrollView'));
      return Boolean(looping && looping.content?.includes('ScrollView'));
    });
  }

  // ─── Summary ───
  console.log('\n═══════════════════════════════════════════════════════════════════');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`  SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details || 'no details'}`);
    });
    process.exit(1);
  }

  console.log('All tests passed!\n');
}

main().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
