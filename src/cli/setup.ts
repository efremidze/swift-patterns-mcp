#!/usr/bin/env node

// src/cli/setup.ts
// Interactive onboarding wizard for MCP client setup

import 'dotenv/config';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

type InstallMode = 'npx' | 'local' | 'global';
type Client = 'cursor' | 'claude' | 'windsurf' | 'vscode';
type Scope = 'local' | 'global';

function printUsage(): void {
  console.log('swift-patterns-mcp setup\n');
  console.log('Interactive onboarding wizard for MCP client configuration.\n');
  console.log('Usage:');
  console.log('  swift-patterns-mcp setup');
  console.log('  swift-patterns-mcp onboarding');
  console.log('  swift-patterns-mcp setup --patreon    Alias for: swift-patterns-mcp patreon setup');
}

async function askChoice<T extends string>(
  rl: ReturnType<typeof createInterface>,
  question: string,
  choices: Array<{ value: T; label: string }>,
  defaultValue: T
): Promise<T> {
  console.log(`\n${question}`);
  choices.forEach((choice, index) => {
    const marker = choice.value === defaultValue ? ' (default)' : '';
    console.log(`  ${index + 1}. ${choice.label}${marker}`);
  });

  const answer = (await rl.question(`Select 1-${choices.length}: `)).trim();
  if (!answer) return defaultValue;

  const numeric = Number.parseInt(answer, 10);
  if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= choices.length) {
    return choices[numeric - 1].value;
  }

  const byValue = choices.find(choice => choice.value === answer.toLowerCase());
  return byValue?.value ?? defaultValue;
}

function getServerCommand(mode: InstallMode): { command: string; args: string[]; installHint?: string } {
  if (mode === 'local') {
    return {
      command: 'npx',
      args: ['swift-patterns-mcp'],
      installHint: 'npm install -D swift-patterns-mcp',
    };
  }

  if (mode === 'global') {
    return {
      command: 'swift-patterns-mcp',
      args: [],
      installHint: 'npm install -g swift-patterns-mcp',
    };
  }

  return {
    command: 'npx',
    args: ['-y', 'swift-patterns-mcp@latest'],
  };
}

function getConfigPath(client: Client, scope: Scope): string {
  if (scope === 'global') {
    if (client === 'cursor') return '~/.cursor/mcp.json';
    if (client === 'claude') return 'Claude Code global scope (use "claude mcp add")';
    if (client === 'windsurf') return 'Windsurf global MCP settings';
    return 'VS Code user-level MCP settings';
  }

  if (client === 'cursor') return '.cursor/mcp.json';
  if (client === 'claude') return '.mcp.json';
  if (client === 'windsurf') return '.windsurf/mcp.json';
  return '.vscode/mcp.json';
}

function buildSnippet(client: Client, command: string, args: string[]): string {
  const server = { command, args };

  if (client === 'vscode') {
    return JSON.stringify({
      mcp: {
        servers: {
          'swift-patterns': server,
        },
      },
    }, null, 2);
  }

  return JSON.stringify({
    mcpServers: {
      'swift-patterns': server,
    },
  }, null, 2);
}

function printVerificationSteps(): void {
  console.log('\nVerification:');
  console.log('  1. Restart your MCP client');
  console.log('  2. Ask: "list content sources"');
  console.log('  3. Ask: "Show me SwiftUI animation patterns"');
  console.log('  4. Optional local test: npm run build && npx tsx scripts/test-query.ts "swiftui navigation"');
}

async function runPatreonSetupAlias(): Promise<void> {
  console.log('\nRouting to Patreon setup...\n');
  process.argv = [...process.argv.slice(0, 2), 'setup'];
  await import('./patreon.js');
}

async function runWizard(): Promise<void> {
  const rl = createInterface({ input, output });

  try {
    console.log('\n# swift-patterns-mcp Setup Wizard\n');

    const installMode = await askChoice(rl, 'How should the MCP server run?', [
      { value: 'npx', label: 'Run with npx @latest (recommended)' },
      { value: 'local', label: 'Install in this project (dev dependency)' },
      { value: 'global', label: 'Install globally (npm -g)' },
    ], 'npx');

    const client = await askChoice(rl, 'Which MCP client are you configuring?', [
      { value: 'cursor', label: 'Cursor' },
      { value: 'claude', label: 'Claude Code' },
      { value: 'windsurf', label: 'Windsurf' },
      { value: 'vscode', label: 'VS Code' },
    ], 'cursor');

    const scope = await askChoice(rl, 'Configuration scope?', [
      { value: 'local', label: 'Local project only' },
      { value: 'global', label: 'Global for all projects' },
    ], 'local');

    const { command, args, installHint } = getServerCommand(installMode);
    const configPath = getConfigPath(client, scope);
    const snippet = buildSnippet(client, command, args);

    console.log('\n# Next Steps\n');
    if (installHint) {
      console.log(`Install command: ${installHint}`);
    } else {
      console.log('No install needed. The command runs on demand.');
    }

    if (client === 'claude' && scope === 'global') {
      console.log('Recommended command:');
      console.log('  claude mcp add swift-patterns -- npx -y swift-patterns-mcp@latest');
    } else {
      console.log(`Config file: ${configPath}`);
      console.log('Add this snippet:');
      console.log(`\n${snippet}\n`);
    }

    const wantsPatreon = await askChoice(rl, 'Set up Patreon premium integration now?', [
      { value: 'no', label: 'No, skip for now' },
      { value: 'yes', label: 'Yes, I want premium sources' },
    ], 'no');

    if (wantsPatreon === 'yes') {
      console.log('\nRun next: swift-patterns-mcp patreon setup');
    }

    printVerificationSteps();
    console.log('');
  } finally {
    rl.close();
  }
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

if (args.includes('--patreon')) {
  await runPatreonSetupAlias();
  process.exit(0);
}

if (!process.stdin.isTTY) {
  console.log('Non-interactive environment detected.');
  console.log('Run: swift-patterns-mcp setup');
  console.log('Or configure manually with: npx -y swift-patterns-mcp@latest');
  process.exit(0);
}

await runWizard();
process.exit(0);
