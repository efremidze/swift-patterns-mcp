/**
 * Response formatting helpers for consistent MCP tool responses
 */

import type { ToolResponse } from '../tools/types.js';
import { toErrorMessage } from './errors.js';

/**
 * Create a standard text response
 */
export function createTextResponse(text: string): ToolResponse {
  return {
    content: [{
      type: "text",
      text,
    }],
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(message: string): ToolResponse {
  return {
    content: [{
      type: "text",
      text: `Error: ${message}`,
    }],
    isError: true,
  };
}

/**
 * Create a response from an error (uses error utilities)
 */
export function createErrorResponseFromError(error: unknown): ToolResponse {
  return createErrorResponse(toErrorMessage(error));
}
