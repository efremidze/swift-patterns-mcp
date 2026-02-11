export type InstallMode = 'npx' | 'local' | 'global';
export type Client = 'cursor' | 'claude' | 'windsurf' | 'vscode';
export type Scope = 'local' | 'global';

export interface SetupOptions {
  clients?: Client[];
  scope?: Scope;
}

export function getServerCommand(mode: InstallMode): { command: string; args: string[]; installHint?: string } {
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

export function getConfigPath(client: Client, scope: Scope): string {
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

export function buildSnippet(client: Client, command: string, args: string[]): string {
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

export function parseOptions(args: string[]): SetupOptions {
  const has = (flag: string) => args.includes(flag);
  const scope: Scope | undefined = has('--global') || has('-g')
    ? 'global'
    : has('--local') || has('-l')
      ? 'local'
      : undefined;

  const selectedClients: Client[] = [];
  if (has('--cursor')) selectedClients.push('cursor');
  if (has('--claude')) selectedClients.push('claude');
  if (has('--windsurf')) selectedClients.push('windsurf');
  if (has('--vscode')) selectedClients.push('vscode');
  if (has('--all')) {
    return {
      clients: ['cursor', 'claude', 'windsurf', 'vscode'],
      scope,
    };
  }

  return {
    clients: selectedClients.length > 0 ? selectedClients : undefined,
    scope,
  };
}

export function shouldRunNonInteractive(options: SetupOptions): boolean {
  return !!(options.clients?.length || options.scope);
}
