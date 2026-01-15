// src/cli/setup.ts

import 'dotenv/config';

import readline from 'readline';
import { startOAuthFlow, loadTokens } from '../sources/premium/patreon-oauth.js';
import PatreonSource from '../sources/premium/patreon.js';
import SourceManager from '../config/sources.js';

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

  if (!clientId || !clientSecret) {
    print('❌ Missing Patreon credentials.\n');
    print('Please set these environment variables:');
    print('  PATREON_CLIENT_ID=your_client_id');
    print('  PATREON_CLIENT_SECRET=your_client_secret\n');
    print('Get credentials at: https://www.patreon.com/portal/registration/register-clients');
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
  print('Step 1/3: Authentication');
  const result = await startOAuthFlow(clientId, clientSecret);

  if (!result.success) {
    print(`\n❌ Authorization failed: ${result.error}`);
    rl.close();
    process.exit(1);
  }

  print('✓ Authenticated successfully!\n');

  // Step 2: Detect creators
  print('Step 2/3: Detecting Swift/iOS Creators');
  print('Scanning your subscriptions...\n');

  const patreon = new PatreonSource();
  const allCreators = await patreon.getSubscribedCreators();
  const swiftCreators = allCreators.filter(c => c.isSwiftRelated);

  if (allCreators.length === 0) {
    print('No Patreon subscriptions found.');
    print('Subscribe to iOS/Swift creators on Patreon, then run setup again.');
    rl.close();
    return;
  }

  // Display creators with pre-selection
  const selected = new Set(swiftCreators.map(c => c.id));

  print(`Found ${allCreators.length} subscriptions:\n`);

  function displayCreators(): void {
    allCreators.forEach((c, i) => {
      const check = selected.has(c.id) ? '✓' : ' ';
      const swift = c.isSwiftRelated ? ' (Swift/iOS)' : '';
      print(`  ${check} [${i + 1}] ${c.name}${swift}`);
    });
  }

  displayCreators();

  print('\nToggle numbers to change selection, or press Enter to confirm.');

  while (true) {
    const input = await question('\nToggle (or Enter to confirm): ');

    if (input.trim() === '') {
      break;
    }

    const nums = input.split(/[\s,]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

    for (const num of nums) {
      if (num >= 1 && num <= allCreators.length) {
        const creator = allCreators[num - 1];
        if (selected.has(creator.id)) {
          selected.delete(creator.id);
        } else {
          selected.add(creator.id);
        }
      }
    }

    print('\nUpdated selection:');
    displayCreators();
  }

  if (selected.size === 0) {
    print('\n⚠️  No creators selected. You can run setup again later.');
    rl.close();
    return;
  }

  // Save selected creators
  patreon.saveEnabledCreators(Array.from(selected));

  // Step 3: Initial sync
  print('\nStep 3/3: Initial Sync');
  print(`Fetching content from ${selected.size} creator(s)...\n`);

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

  for (const [creatorId, stats] of creatorStats) {
    const creator = allCreators.find(c => c.id === creatorId);
    print(`  ${creator?.name || creatorId}: ${stats.posts} posts (${stats.withCode} with code)`);
  }

  // Mark as configured
  const sourceManager = new SourceManager();
  sourceManager.markSourceConfigured('patreon');

  print('\n✅ Setup complete!\n');
  print(`Found ${patterns.length} posts across ${selected.size} creator(s).`);
  print("Use 'get_patreon_patterns' in your AI assistant to search them.\n");

  rl.close();
}

// Parse args
const args = process.argv.slice(2);

if (args.includes('--patreon') || args.includes('-p')) {
  setupPatreon().catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
} else if (args.includes('--help') || args.includes('-h')) {
  print('swift-mcp setup\n');
  print('Usage:');
  print('  swift-mcp setup --patreon    Set up Patreon integration');
  print('  swift-mcp setup --help       Show this help');
  process.exit(0);
} else {
  print('swift-mcp setup\n');
  print('Available options:');
  print('  --patreon    Set up Patreon integration');
  print('\nRun: swift-mcp setup --patreon');
  process.exit(0);
}
