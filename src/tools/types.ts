// src/tools/types.ts

import type SourceManager from '../config/sources.js';

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  sourceManager: SourceManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PatreonSource: any;
}

/**
 * Tool response format matching MCP SDK expectations
 * Index signature allows additional SDK-required properties
 */
export interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Handler function type for MCP tools
 */
export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResponse>;
