/**
 * Response formatting helpers for consistent MCP tool responses
 */

import type { ToolResponse } from '../tools/types.js';
import { toErrorMessage } from './errors.js';

export interface MarkdownSection {
  heading?: string;
  lines: Array<string | null | undefined>;
}

function compactLines(lines: Array<string | null | undefined>): string[] {
  return lines
    .map(line => line?.trim())
    .filter((line): line is string => Boolean(line));
}

/**
 * Build markdown sections with consistent spacing.
 */
export function formatMarkdownSections(sections: MarkdownSection[]): string {
  return sections
    .map(section => {
      const lines = compactLines(section.lines);
      if (lines.length === 0) return '';

      if (!section.heading) {
        return lines.join('\n');
      }

      return [`## ${section.heading}`, ...lines].join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Build a markdown document with a top-level title and optional sections.
 */
export function formatMarkdownDocument(
  title: string,
  sections: MarkdownSection[],
  footer?: string
): string {
  const body = formatMarkdownSections(sections);
  const parts = [`# ${title}`];
  if (body) parts.push(body);
  if (footer?.trim()) parts.push(footer.trim());
  return parts.join('\n\n');
}

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
