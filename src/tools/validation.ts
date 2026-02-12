// src/tools/validation.ts

import { createTextResponse } from '../utils/response-helpers.js';
import type { ToolResponse } from './types.js';

/**
 * Validate a required string argument
 * @returns Trimmed string value or ToolResponse error
 */
export function validateRequiredString(
  args: Record<string, unknown>,
  name: string,
  usageHint?: string
): string | ToolResponse {
  const value = args?.[name];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  const msg = `Missing required argument: ${name}`;
  return createTextResponse(usageHint ? `${msg}\n\n${usageHint}` : msg);
}

/**
 * Validate an optional string argument
 * @returns String value, undefined, or ToolResponse error
 */
export function validateOptionalString(
  args: Record<string, unknown>,
  name: string
): string | undefined | ToolResponse {
  const value = args?.[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  return createTextResponse(`Invalid argument "${name}": expected string`);
}

/**
 * Validate an optional number argument
 * @returns Number value, undefined, or ToolResponse error
 */
export function validateOptionalNumber(
  args: Record<string, unknown>,
  name: string
): number | undefined | ToolResponse {
  const value = args?.[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return createTextResponse(`Invalid argument "${name}": expected number`);
}

/**
 * Validate an optional boolean argument
 * @returns Boolean value, undefined, or ToolResponse error
 */
export function validateOptionalBoolean(
  args: Record<string, unknown>,
  name: string
): boolean | undefined | ToolResponse {
  const value = args?.[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  return createTextResponse(`Invalid argument "${name}": expected boolean`);
}

/**
 * Type guard to check if a validation result is an error response
 */
export function isValidationError(result: unknown): result is ToolResponse {
  return (
    typeof result === 'object' &&
    result !== null &&
    'content' in result &&
    Array.isArray((result as ToolResponse).content)
  );
}
