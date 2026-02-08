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
 * Create a markdown response with a title and body sections.
 */
export function createMarkdownResponse(title: string, ...sections: Array<string | undefined>): ToolResponse {
  const body = sections
    .filter((section): section is string => Boolean(section && section.trim()))
    .join('\n\n');

  return createTextResponse(`# ${title}${body ? `\n\n${body}` : ''}`);
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
