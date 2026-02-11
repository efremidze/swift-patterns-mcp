import type { ToolContext } from '../../types.js';
import { createToolContext } from '../../../__tests__/fixtures/tool-context.js';

export const REQUIRED_PATREON_ENV_VARS = [
  'YOUTUBE_API_KEY',
  'PATREON_CLIENT_ID',
  'PATREON_CLIENT_SECRET',
] as const;

export function createHandlerContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return createToolContext(overrides);
}

export function saveEnvVars(vars: readonly string[]): Record<string, string | undefined> {
  const snapshot: Record<string, string | undefined> = {};

  vars.forEach((name) => {
    snapshot[name] = process.env[name];
  });

  return snapshot;
}

export function restoreEnvVars(snapshot: Record<string, string | undefined>): void {
  Object.entries(snapshot).forEach(([name, value]) => {
    if (value === undefined) {
      delete process.env[name];
      return;
    }

    process.env[name] = value;
  });
}

export function setPatreonEnvVars(): void {
  REQUIRED_PATREON_ENV_VARS.forEach((name) => {
    process.env[name] = `test_${name.toLowerCase()}`;
  });
}

export function clearPatreonEnvVars(): void {
  REQUIRED_PATREON_ENV_VARS.forEach((name) => {
    delete process.env[name];
  });
}
