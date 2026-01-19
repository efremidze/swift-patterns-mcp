// src/tools/registry.ts

import type { ToolHandler } from './types.js';

const handlers = new Map<string, ToolHandler>();

/**
 * Register a tool handler by name
 */
export function registerHandler(name: string, handler: ToolHandler): void {
  handlers.set(name, handler);
}

/**
 * Get a registered handler by name
 */
export function getHandler(name: string): ToolHandler | undefined {
  return handlers.get(name);
}

/**
 * Check if a handler is registered
 */
export function hasHandler(name: string): boolean {
  return handlers.has(name);
}
