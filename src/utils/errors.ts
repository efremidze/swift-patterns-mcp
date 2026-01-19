/**
 * Error handling utilities for consistent error logging across the codebase.
 * Uses console.error with structured context - no external dependencies.
 */

/**
 * Type guard to check if a value is an Error instance.
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Safely extracts an error message from any thrown value.
 * Returns error.message if Error, String(error) otherwise.
 */
export function toErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}

/**
 * Logs an error with context prefix and optional details.
 * Format: [context] message { details }
 */
export function logError(
  context: string,
  error: unknown,
  details?: Record<string, unknown>
): void {
  const message = toErrorMessage(error);
  if (details) {
    console.error(`[${context}]`, message, details);
  } else {
    console.error(`[${context}]`, message);
  }
}
