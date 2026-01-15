// src/utils/paths.ts

import path from 'path';

/**
 * Get the base directory for swift-mcp configuration and data
 * @returns The absolute path to ~/.swift-mcp directory
 */
export function getSwiftMcpDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(home, '.swift-mcp');
}

/**
 * Get the configuration file path
 * @returns The absolute path to the config.json file
 */
export function getConfigPath(): string {
  return path.join(getSwiftMcpDir(), 'config.json');
}

/**
 * Get the cache directory path
 * @param namespace Optional namespace for cache isolation
 * @returns The absolute path to the cache directory
 */
export function getCacheDir(namespace?: string): string {
  if (namespace) {
    return path.join(getSwiftMcpDir(), 'cache', namespace);
  }
  return path.join(getSwiftMcpDir(), 'cache');
}

/**
 * Get the Patreon content download directory
 * @returns The absolute path to the patreon-content directory
 */
export function getPatreonContentDir(): string {
  return path.join(getSwiftMcpDir(), 'patreon-content');
}

/**
 * Get the Patreon creators configuration path
 * @returns The absolute path to the patreon-creators.json file
 */
export function getPatreonCreatorsPath(): string {
  return path.join(getSwiftMcpDir(), 'patreon-creators.json');
}
