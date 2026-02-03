#!/usr/bin/env node

// src/cli/sources.ts
// Lists all content sources and their status

import 'dotenv/config';
import SourceManager from '../config/sources.js';

const sourceManager = new SourceManager();

function getStatusIcon(isEnabled: boolean, isConfigured: boolean): string {
  if (isEnabled && isConfigured) return '✅';
  if (isConfigured) return '⚙️';
  return '⬜';
}

function listSources(): void {
  const allSources = sourceManager.getAllSources();
  const freeSources = allSources.filter(source => source.type === 'free');
  const premiumSources = allSources.filter(source => source.type === 'premium');

  console.log('\n# Content Sources\n');

  console.log('## Free Sources');
  for (const source of freeSources) {
    const status = getStatusIcon(source.isEnabled, source.isConfigured);
    console.log(`  ${status} ${source.name} - ${source.description}`);
  }

  console.log('\n## Premium Sources');
  for (const source of premiumSources) {
    const status = getStatusIcon(source.isEnabled, source.isConfigured);
    const note = source.isConfigured ? '' : ' (run: swift-patterns-mcp patreon setup)';
    console.log(`  ${status} ${source.name} - ${source.description}${note}`);
  }

  console.log('\n✅ Enabled | ⚙️ Disabled | ⬜ Not configured\n');
}

// Show help or list sources
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('swift-patterns-mcp sources\n');
  console.log('Lists all available content sources and their status.\n');
  console.log('Usage:');
  console.log('  swift-patterns-mcp sources');
  process.exit(0);
}

listSources();
process.exit(0);
