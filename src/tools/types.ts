// src/tools/types.ts

import type SourceManager from '../config/sources.js';

/**
 * Pattern returned by Patreon source
 */
export interface PatreonPattern {
  id: string;
  title: string;
  url: string;
  publishDate: string;
  excerpt: string;
  content: string;
  creator: string;
  topics: string[];
  relevanceScore: number;
  hasCode: boolean;
}

/**
 * Creator info from Patreon
 */
export interface CreatorInfo {
  id: string;
  name: string;
  url: string;
  isSwiftRelated: boolean;
}

/**
 * Interface for PatreonSource class instances
 */
export interface PatreonSourceInstance {
  isConfigured(): Promise<boolean>;
  isAvailable(): boolean;
  fetchPatterns(creatorId?: string): Promise<PatreonPattern[]>;
  searchPatterns(query: string): Promise<PatreonPattern[]>;
}

/**
 * Constructor type for PatreonSource class
 */
export interface PatreonSourceConstructor {
  new (): PatreonSourceInstance;
}

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  sourceManager: SourceManager;
  patreonSource: PatreonSourceConstructor | null;
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
