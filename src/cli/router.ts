// src/cli/router.ts

/**
 * CLI subcommand routing - detects and routes to CLI commands before starting MCP server.
 * Returns true if a CLI command was handled (process should exit), false if server should start.
 */

const CLI_COMMANDS: Record<string, string> = {
  sources: './sources.js',
  patreon: './patreon.js',
  setup: './setup.js',
  onboarding: './setup.js',
};

const SERVER_FLAGS = new Set(['--server', '--stdio', 'serve', 'server']);

/**
 * Route CLI commands and detect interactive wizard.
 * @returns true if CLI command/wizard was handled, false if MCP server should start
 */
export async function routeCli(): Promise<boolean> {
  const subcommand = process.argv[2];

  // Handle explicit subcommands
  if (subcommand && subcommand in CLI_COMMANDS) {
    // Strip the subcommand from argv so CLI modules see correct args
    // e.g. "swift-patterns-mcp sources list" → argv becomes [..., "list"]
    process.argv.splice(2, 1);
    await import(CLI_COMMANDS[subcommand]);
    return true;
  }

  // Check for interactive wizard
  const args = process.argv.slice(2);
  const forceServerMode = args.some(arg => SERVER_FLAGS.has(arg));
  const shouldRunInteractiveWizard =
    !forceServerMode &&
    args.length === 0 &&
    process.stdin.isTTY &&
    process.stdout.isTTY &&
    process.env.SWIFT_PATTERNS_SKIP_WIZARD !== '1';

  if (shouldRunInteractiveWizard) {
    await import('./setup.js');
    return true;
  }

  // No CLI command or wizard - server should start
  return false;
}
