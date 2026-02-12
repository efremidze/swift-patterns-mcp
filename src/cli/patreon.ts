#!/usr/bin/env node

// src/cli/patreon.ts
// Patreon integration: setup, reset, status

import 'dotenv/config';
import readline from 'readline';
import { startOAuthFlow, loadTokens, clearPatreonAuth } from '../sources/premium/patreon-oauth.js';
import PatreonSource from '../sources/premium/patreon.js';
import SourceManager from '../config/sources.js';
import { withYouTube } from '../config/creators.js';
import logger from '../utils/logger.js';
import { PATREON_SEARCH_ENV_VARS, getMissingEnvVars } from '../utils/patreon-env.js';

type Action = 'setup' | 'reset' | 'status';

function printUsage(): void {
  console.log('swift-patterns-mcp patreon\n');
  console.log('Manage Patreon integration for premium content access.\n');
  console.log('Usage:');
  console.log('  swift-patterns-mcp patreon setup    Connect your Patreon account');
  console.log('  swift-patterns-mcp patreon reset    Clear authentication data');
  console.log('  swift-patterns-mcp patreon status   Check connection status');
}

async function showStatus(): Promise<void> {
  console.log('\n# Patreon Status\n');

  const tokens = await loadTokens();
  const sourceManager = new SourceManager();

  if (!tokens) {
    console.log('  Status: ⬜ Not configured\n');
    console.log('Run: swift-patterns-mcp patreon setup');
    return;
  }

  const isEnabled = sourceManager.isSourceConfigured('patreon');
  console.log(`  Status: ${isEnabled ? '✅ Connected' : '⚙️ Configured but disabled'}`);

  const creators = withYouTube();
  console.log(`  Creators: ${creators.length} configured`);
  for (const c of creators) {
    console.log(`    - ${c.name}`);
  }
  console.log('');
}

async function setup(): Promise<void> {
  console.log('\n# Patreon Setup\n');

  // Check required env vars
  const missing = getMissingEnvVars(PATREON_SEARCH_ENV_VARS);

  if (missing.length > 0) {
    console.log('Missing required environment variables:\n');
    for (const v of missing) {
      console.log(`  - ${v}`);
    }
    console.log('\nAdd these to your .env file:');
    console.log('  Patreon: https://www.patreon.com/portal/registration/register-clients');
    console.log('  YouTube: https://console.cloud.google.com/apis/credentials\n');
    process.exit(1);
  }

  // Check if already configured
  const existingTokens = await loadTokens();
  if (existingTokens) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>(resolve =>
      rl.question('Already configured. Reconfigure? (y/N): ', resolve)
    );
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('\nCancelled.\n');
      return;
    }
  }

  // OAuth flow
  console.log('Step 1/2: Authentication\n');
  const result = await startOAuthFlow(process.env.PATREON_CLIENT_ID!, process.env.PATREON_CLIENT_SECRET!);

  if (!result.success) {
    console.log(`\nAuthentication failed: ${result.error}\n`);
    process.exit(1);
  }

  console.log('Authenticated!\n');

  // Verify and show stats
  console.log('Step 2/2: Verifying...\n');

  const creators = withYouTube();
  console.log(`Configured creators (${creators.length}):`);
  for (const c of creators) {
    console.log(`  - ${c.name}`);
  }

  console.log('\nFetching content...\n');

  const patreon = new PatreonSource();
  const patterns = await patreon.fetchPatterns();

  const stats = new Map<string, { posts: number; withCode: number }>();
  for (const p of patterns) {
    if (!stats.has(p.creator)) {
      stats.set(p.creator, { posts: 0, withCode: 0 });
    }
    const s = stats.get(p.creator)!;
    s.posts++;
    if (p.hasCode) s.withCode++;
  }

  for (const [name, s] of stats) {
    console.log(`  ${name}: ${s.posts} posts (${s.withCode} with code)`);
  }

  // Mark configured
  const sourceManager = new SourceManager();
  sourceManager.markSourceConfigured('patreon');

  console.log(`\n✅ Setup complete! Found ${patterns.length} posts.\n`);
}

async function reset(): Promise<void> {
  console.log('\n# Reset Patreon\n');

  try {
    await clearPatreonAuth();
    console.log('Authentication data cleared.\n');
    console.log('Run: swift-patterns-mcp patreon setup\n');
  } catch (err) {
    console.log(`Failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

// Parse args
const args = process.argv.slice(2);
const action = args[0] as Action | undefined;

if (args.includes('--help') || args.includes('-h') || !action) {
  printUsage();
  process.exit(0);
}

async function main(): Promise<void> {
  switch (action) {
    case 'setup':
      await setup();
      break;
    case 'reset':
      await reset();
      break;
    case 'status':
      await showStatus();
      break;
    default:
      console.log(`Unknown command: ${action}\n`);
      printUsage();
      process.exit(1);
  }
}

await main().catch(err => {
  logger.error({ err }, 'Command failed');
  process.exit(1);
});
process.exit(0);
