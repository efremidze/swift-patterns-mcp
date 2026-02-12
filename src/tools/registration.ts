// src/tools/registration.ts

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type SourceManager from "../config/sources.js";
import type { PatreonSourceConstructor } from './types.js';

// Core tools (always available)
export const CORE_TOOLS: Tool[] = [
  {
    name: "get_swift_pattern",
    description: "Get Swift/SwiftUI reference patterns from curated free sources (Sundell, van der Lee, Nil Coalescing, Point-Free). Best for conceptual guidance and free-source examples.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Topic to search (e.g., 'swiftui', 'testing', 'async-await', 'performance')",
        },
        source: {
          type: "string",
          enum: ["all", "sundell", "vanderlee", "nilcoalescing", "pointfree"],
          description: "Specific source to search (default: all free sources)",
        },
        minQuality: {
          type: "number",
          description: "Minimum quality score 0-100 (default: 60)",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "search_swift_content",
    description: "Unified search across all enabled sources (free + premium). Use this for broad natural-language queries. When Patreon is enabled, includes premium creator posts and downloadable code.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language search query",
        },
        requireCode: {
          type: "boolean",
          description: "Prioritize and return only results with code examples",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_content_sources",
    description: "List all available content sources and their status",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "enable_source",
    description: "Enable a content source (requires setup for premium sources)",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Source ID (e.g., 'patreon')",
        },
      },
      required: ["source"],
    },
  },
];

// Premium tools (only if Patreon is enabled)
export const PATREON_TOOLS: Tool[] = [
  {
    name: "get_patreon_patterns",
    description: "Get premium Patreon patterns from creators you support (requires Patreon enabled). Best for implementation-ready tutorials, full sample projects, and downloadable source code.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Topic to search in Patreon creator content",
        },
        minQuality: {
          type: "number",
          description: "Minimum quality score (default: 70, typically high-signal project/tutorial matches)",
        },
        requireCode: {
          type: "boolean",
          description: "Only return posts with code (recommended for usable implementation examples)",
        },
      },
    },
  },
  {
    name: "setup_patreon",
    description: "Set up Patreon integration to access your subscriptions",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["start", "status"],
        },
      },
    },
  },
];

/**
 * Get the full tool list based on enabled sources
 */
export function getToolList(sourceManager: SourceManager, patreonSource: PatreonSourceConstructor | null): Tool[] {
  const enabledSources = sourceManager.getEnabledSources();
  const hasPatreon = enabledSources.some(s => s.id === 'patreon');

  const tools = [...CORE_TOOLS];

  if (hasPatreon && patreonSource) {
    tools.push(...PATREON_TOOLS);
  }

  return tools;
}
