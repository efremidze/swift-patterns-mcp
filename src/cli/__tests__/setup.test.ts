import { describe, expect, it } from 'vitest';
import {
  buildSnippet,
  getConfigPath,
  getServerCommand,
  parseOptions,
  shouldRunNonInteractive,
} from '../setup-utils.js';

describe('setup-utils', () => {
  it('returns npx latest command for on-demand install mode', () => {
    expect(getServerCommand('npx')).toEqual({
      command: 'npx',
      args: ['-y', 'swift-patterns-mcp@latest'],
    });
  });

  it('returns local install command and hint', () => {
    expect(getServerCommand('local')).toEqual({
      command: 'npx',
      args: ['swift-patterns-mcp'],
      installHint: 'npm install -D swift-patterns-mcp',
    });
  });

  it('returns global install command and hint', () => {
    expect(getServerCommand('global')).toEqual({
      command: 'swift-patterns-mcp',
      args: [],
      installHint: 'npm install -g swift-patterns-mcp',
    });
  });

  it('resolves client config paths for local and global scopes', () => {
    expect(getConfigPath('cursor', 'local')).toBe('.cursor/mcp.json');
    expect(getConfigPath('claude', 'local')).toBe('.mcp.json');
    expect(getConfigPath('windsurf', 'local')).toBe('.windsurf/mcp.json');
    expect(getConfigPath('vscode', 'local')).toBe('.vscode/mcp.json');
    expect(getConfigPath('cursor', 'global')).toBe('~/.cursor/mcp.json');
    expect(getConfigPath('claude', 'global')).toContain('claude mcp add');
    expect(getConfigPath('windsurf', 'global')).toContain('Windsurf');
    expect(getConfigPath('vscode', 'global')).toContain('VS Code');
  });

  it('builds VS Code snippet with mcp.servers shape', () => {
    const snippet = JSON.parse(buildSnippet('vscode', 'npx', ['-y', 'swift-patterns-mcp@latest']));
    expect(snippet).toEqual({
      mcp: {
        servers: {
          'swift-patterns': {
            command: 'npx',
            args: ['-y', 'swift-patterns-mcp@latest'],
          },
        },
      },
    });
  });

  it('builds non-VS Code snippet with mcpServers shape', () => {
    const snippet = JSON.parse(buildSnippet('cursor', 'npx', ['-y', 'swift-patterns-mcp@latest']));
    expect(snippet).toEqual({
      mcpServers: {
        'swift-patterns': {
          command: 'npx',
          args: ['-y', 'swift-patterns-mcp@latest'],
        },
      },
    });
  });

  it('parses --all and scope flags correctly', () => {
    expect(parseOptions(['--all', '--global'])).toEqual({
      clients: ['cursor', 'claude', 'windsurf', 'vscode'],
      scope: 'global',
    });
    expect(parseOptions(['--all', '-l'])).toEqual({
      clients: ['cursor', 'claude', 'windsurf', 'vscode'],
      scope: 'local',
    });
  });

  it('parses selected client flags without --all', () => {
    expect(parseOptions(['--cursor', '--vscode'])).toEqual({
      clients: ['cursor', 'vscode'],
      scope: undefined,
    });
    expect(parseOptions(['--claude', '--windsurf', '-g'])).toEqual({
      clients: ['claude', 'windsurf'],
      scope: 'global',
    });
  });

  it('detects non-interactive mode when clients or scope are provided', () => {
    expect(shouldRunNonInteractive({ clients: ['cursor'] })).toBe(true);
    expect(shouldRunNonInteractive({ scope: 'global' })).toBe(true);
    expect(shouldRunNonInteractive({ clients: ['cursor'], scope: 'local' })).toBe(true);
    expect(shouldRunNonInteractive({})).toBe(false);
  });
});
