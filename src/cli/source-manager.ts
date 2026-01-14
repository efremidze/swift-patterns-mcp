// src/cli/source-manager.ts

import SourceManager from '../config/sources.js';

function print(msg: string): void {
  console.log(msg);
}

function printUsage(): void {
  print('swift-mcp source\n');
  print('Usage:');
  print('  swift-mcp source list              List all sources and their status');
  print('  swift-mcp source enable <id>       Enable a source');
  print('  swift-mcp source disable <id>      Disable a source');
  print('  swift-mcp source help              Show this help');
}

async function listSources(): Promise<void> {
  const manager = new SourceManager();
  const sources = manager.getAllSources();
  
  print('\n📚 Available Content Sources\n');
  print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Free sources
  print('Free Sources (Always Available):');
  const freeSources = sources.filter(s => s.type === 'free');
  for (const source of freeSources) {
    const status = source.isEnabled ? '✅' : '⬜';
    print(`  ${status} ${source.id.padEnd(20)} ${source.name}`);
    print(`     ${source.description}`);
  }
  
  print('\nPremium Sources (Require Setup):');
  const premiumSources = sources.filter(s => s.type === 'premium');
  for (const source of premiumSources) {
    const status = source.isConfigured && source.isEnabled ? '✅' : 
                   source.isConfigured ? '⚙️' : '⬜';
    const statusText = source.isConfigured ? (source.isEnabled ? 'Enabled' : 'Disabled') : 'Not configured';
    print(`  ${status} ${source.id.padEnd(20)} ${source.name} (${statusText})`);
    print(`     ${source.description}`);
  }
  
  print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  print('\nLegend: ✅ Enabled | ⚙️ Configured but disabled | ⬜ Not configured/disabled');
  print('\nTo enable a premium source, first run: swift-mcp setup --<source-id>');
}

async function enableSource(sourceId: string): Promise<void> {
  const manager = new SourceManager();
  const source = manager.getSource(sourceId);
  
  if (!source) {
    print(`❌ Unknown source: "${sourceId}"`);
    print('\nAvailable sources:');
    const sources = manager.getAllSources();
    for (const s of sources) {
      print(`  - ${s.id}: ${s.name}`);
    }
    process.exit(1);
  }
  
  if (source.requiresAuth && !manager.isSourceConfigured(sourceId)) {
    print(`⚠️  ${source.name} requires setup first.`);
    print(`\nRun: swift-mcp setup --${sourceId}`);
    process.exit(1);
  }
  
  try {
    manager.enableSource(sourceId);
    print(`✅ ${source.name} enabled!`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    print(`❌ Failed to enable source: ${errorMessage}`);
    process.exit(1);
  }
}

async function disableSource(sourceId: string): Promise<void> {
  const manager = new SourceManager();
  const source = manager.getSource(sourceId);
  
  if (!source) {
    print(`❌ Unknown source: "${sourceId}"`);
    process.exit(1);
  }
  
  const success = manager.disableSource(sourceId);
  
  if (success) {
    print(`✅ ${source.name} disabled.`);
  } else {
    print(`⚠️  Source "${sourceId}" was already disabled.`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const sourceId = args[1];

(async () => {
  try {
    switch (command) {
      case 'list':
      case 'ls':
        await listSources();
        break;
      
      case 'enable':
        if (!sourceId) {
          print('❌ Error: Source ID is required');
          print('\nUsage: swift-mcp source enable <source-id>');
          process.exit(1);
        }
        await enableSource(sourceId);
        break;
      
      case 'disable':
        if (!sourceId) {
          print('❌ Error: Source ID is required');
          print('\nUsage: swift-mcp source disable <source-id>');
          process.exit(1);
        }
        await disableSource(sourceId);
        break;
      
      case 'help':
      case '--help':
      case '-h':
        printUsage();
        break;
      
      default:
        if (command) {
          print(`❌ Unknown command: "${command}"\n`);
        }
        printUsage();
        process.exit(command ? 1 : 0);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
