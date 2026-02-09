// src/utils/patreon-env.ts
// Shared Patreon environment variable helpers.

export const PATREON_CORE_ENV_VARS = [
  'PATREON_CLIENT_ID',
  'PATREON_CLIENT_SECRET',
] as const;

export const PATREON_SEARCH_ENV_VARS = [
  'YOUTUBE_API_KEY',
  ...PATREON_CORE_ENV_VARS,
] as const;

export function getMissingEnvVars(requiredVars: readonly string[]): string[] {
  return requiredVars.filter((key) => !process.env[key]);
}

export function formatEnvExportHints(missingVars: readonly string[]): string[] {
  return missingVars.map((name) => `export ${name}="your_${name.toLowerCase()}"`);
}
