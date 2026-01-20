#!/usr/bin/env node

// src/cli/source-manager.ts

import 'dotenv/config';

import SourceManager from '../config/sources.js';

type SourceAction = 'list' | 'enable' | 'disable';

const sourceManager = new SourceManager();

function print(msg: string): void {
  console.log(msg);
}

function printUsage(): void {
  print('swift-patterns-mcp source\n');
  print('Usage:');
  print('  swift-patterns-mcp source list');
  print('  swift-patterns-mcp source enable <source-id>');
  print('  swift-patterns-mcp source disable <source-id>');
  print('  swift-patterns-mcp source --help');
}

function getStatusIcon(isEnabled: boolean, isConfigured: boolean): string {
  if (isEnabled && isConfigured) return '✅';
  if (isConfigured) return '⚙️';
  return '⬜';
}

function listSources(): void {
  const allSources = sourceManager.getAllSources();
  const freeSources = allSources.filter(source => source.type === 'free');
  const premiumSources = allSources.filter(source => source.type === 'premium');

  print('\n# Content Sources\n');

  print('## Free Sources (Always Available)');
  freeSources.forEach(source => {
    const status = getStatusIcon(source.isEnabled, source.isConfigured);
    print(`- ${status} **${source.name}** (${source.id}) - ${source.description}`);
  });

  print('\n## Premium Sources (Optional)');
  premiumSources.forEach(source => {
    const status = getStatusIcon(source.isEnabled, source.isConfigured);
    const setupNote = source.isConfigured ? '' : ' (Setup required)';
    print(`- ${status} **${source.name}** (${source.id}) - ${source.description}${setupNote}`);
  });

  print('\n## Legend');
  print('✅ Enabled | ⚙️ Configured but disabled | ⬜ Not configured');
}

function enableSource(sourceId?: string): void {
  if (!sourceId) {
    print('❌ Missing source ID.');
    printUsage();
    process.exit(1);
  }

  try {
    const source = sourceManager.getSource(sourceId);
    if (!source) {
      print(`❌ Unknown source: "${sourceId}"`);
      print('Run: swift-patterns-mcp source list');
      process.exit(1);
    }

    sourceManager.enableSource(sourceId);
    print(`✅ ${source.name} enabled.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    print(`❌ ${message}`);
    process.exit(1);
  }
}

function disableSource(sourceId?: string): void {
  if (!sourceId) {
    print('❌ Missing source ID.');
    printUsage();
    process.exit(1);
  }

  const source = sourceManager.getSource(sourceId);
  if (!source) {
    print(`❌ Unknown source: "${sourceId}"`);
    print('Run: swift-patterns-mcp source list');
    process.exit(1);
  }

  const success = sourceManager.disableSource(sourceId);
  if (!success) {
    print(`⚠️  ${source.name} is already disabled or not configured.`);
    process.exit(1);
  }

  print(`✅ ${source.name} disabled.`);
}

function parseArgs(args: string[]): { action?: SourceAction; sourceId?: string } {
  if (args.length === 0) {
    return {};
  }

  const [action, sourceId] = args;

  if (action === '--help' || action === '-h') {
    return {};
  }

  if (action === 'list' || action === 'enable' || action === 'disable') {
    return { action, sourceId };
  }

  return {};
}

const args = process.argv.slice(2);
const { action, sourceId } = parseArgs(args);

if (!action) {
  printUsage();
  process.exit(0);
}

switch (action) {
  case 'list':
    listSources();
    break;
  case 'enable':
    enableSource(sourceId);
    break;
  case 'disable':
    disableSource(sourceId);
    break;
  default:
    printUsage();
    process.exit(1);
}
