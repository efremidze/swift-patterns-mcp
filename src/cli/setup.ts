// src/cli/setup.ts

import 'dotenv/config';

import readline from 'readline';
import { startOAuthFlow, loadTokens } from '../sources/premium/patreon-oauth.js';
import PatreonSource from '../sources/premium/patreon.js';
import SourceManager from '../config/sources.js';
import { withYouTube } from '../config/creators.js';
import logger from '../utils/logger.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function print(msg: string): void {
  console.log(msg);
}

async function setupPatreon(): Promise<void> {
  print('\n🔐 Patreon Setup');
  print('━━━━━━━━━━━━━━━━\n');

  const clientId = process.env.PATREON_CLIENT_ID;
  const clientSecret = process.env.PATREON_CLIENT_SECRET;
  const youtubeKey = process.env.YOUTUBE_API_KEY;

  // Check all required env vars
  const missing: string[] = [];
  if (!clientId) missing.push('PATREON_CLIENT_ID');
  if (!clientSecret) missing.push('PATREON_CLIENT_SECRET');
  if (!youtubeKey) missing.push('YOUTUBE_API_KEY');

  if (missing.length > 0) {
    print('❌ Missing required environment variables:\n');
    for (const v of missing) {
      print(`  - ${v}`);
    }
    print('\nAdd these to your .env file or environment.');
    print('Get Patreon credentials at: https://www.patreon.com/portal/registration/register-clients');
    print('Get YouTube API key at: https://console.cloud.google.com/apis/credentials');
    rl.close();
    process.exit(1);
  }

  // Check if already configured
  const existingTokens = await loadTokens();
  if (existingTokens) {
    const answer = await question('Patreon is already configured. Reconfigure? (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      print('\nSetup cancelled.');
      rl.close();
      return;
    }
  }

  // Step 1: OAuth
  print('Step 1/2: Authentication');
  const result = await startOAuthFlow(clientId!, clientSecret!);

  if (!result.success) {
    print(`\n❌ Authorization failed: ${result.error}`);
    rl.close();
    process.exit(1);
  }

  print('✓ Authenticated successfully!\n');

  // Step 2: Show configured creators and test
  print('Step 2/2: Verifying Setup');

  const creatorsWithYouTube = withYouTube();
  print(`\nConfigured creators (${creatorsWithYouTube.length}):`);
  for (const creator of creatorsWithYouTube) {
    print(`  ✓ ${creator.name}`);
  }

  print('\nTesting content fetch...\n');

  const patreon = new PatreonSource();
  const patterns = await patreon.fetchPatterns();

  const creatorStats = new Map<string, { posts: number; withCode: number }>();
  for (const p of patterns) {
    if (!creatorStats.has(p.creator)) {
      creatorStats.set(p.creator, { posts: 0, withCode: 0 });
    }
    const stats = creatorStats.get(p.creator)!;
    stats.posts++;
    if (p.hasCode) stats.withCode++;
  }

  for (const [creatorName, stats] of creatorStats) {
    print(`  ${creatorName}: ${stats.posts} posts (${stats.withCode} with code)`);
  }

  // Mark as configured
  const sourceManager = new SourceManager();
  sourceManager.markSourceConfigured('patreon');

  print('\n✅ Setup complete!\n');
  print(`Found ${patterns.length} posts from ${creatorStats.size} creator(s).`);
  print("Use 'get_patreon_patterns' in your AI assistant to search them.\n");

  rl.close();
  process.exit(0);
}

// Parse args
const args = process.argv.slice(2);

if (args.includes('--patreon') || args.includes('-p')) {
  setupPatreon().catch(err => {
    logger.error({ err }, 'Setup failed');
    process.exit(1);
  });
} else if (args.includes('--help') || args.includes('-h')) {
  print('swift-patterns-mcp setup\n');
  print('Usage:');
  print('  swift-patterns-mcp setup --patreon    Set up Patreon integration');
  print('  swift-patterns-mcp setup --help       Show this help');
  process.exit(0);
} else {
  print('swift-patterns-mcp setup\n');
  print('Available options:');
  print('  --patreon    Set up Patreon integration');
  print('\nRun: swift-patterns-mcp setup --patreon');
  process.exit(0);
}
