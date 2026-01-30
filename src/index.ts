#!/usr/bin/env node

// src/index.ts

import 'dotenv/config';

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import SourceManager from "./config/sources.js";
import { getHandler, ToolContext, PatreonSourceConstructor } from './tools/index.js';
import { createErrorResponseFromError } from './utils/response-helpers.js';
import { prefetchAllSources } from './utils/source-registry.js';
import { prefetchEmbeddingModel } from './utils/semantic-recall.js';
import logger from './utils/logger.js';

// Premium sources (imported conditionally)
let patreonSource: PatreonSourceConstructor | null = null;
try {
  const module = await import("./sources/premium/patreon.js");
  patreonSource = module.PatreonSource;
} catch {
  // Patreon not available
}

// Initialize source manager
const sourceManager = new SourceManager();

// Auto-detect Patreon credentials and enable if configured.
// isSourceConfigured checks env vars; markSourceConfigured persists
// enabled=true + configured=true so getEnabledSources() includes Patreon.
if (patreonSource && sourceManager.isSourceConfigured('patreon')) {
  const enabledIds = sourceManager.getEnabledSources().map(s => s.id);
  if (!enabledIds.includes('patreon')) {
    sourceManager.markSourceConfigured('patreon');
    logger.info('Patreon auto-enabled (credentials detected)');
  }
}

// Tool context for handlers
const toolContext: ToolContext = { sourceManager, patreonSource };

// Core tools (always available)
const CORE_TOOLS: Tool[] = [
  {
    name: "get_swift_pattern",
    description: "Get Swift/SwiftUI patterns from curated free sources (Sundell, van der Lee, Nil Coalescing, etc.)",
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
    description: "Search all enabled sources for Swift/iOS content",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        requireCode: {
          type: "boolean",
          description: "Only return results with code examples",
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
const PATREON_TOOLS: Tool[] = [
  {
    name: "get_patreon_patterns",
    description: "Get high-quality patterns from your Patreon subscriptions (requires Patreon enabled)",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Topic to search",
        },
        minQuality: {
          type: "number",
          description: "Minimum quality score (default: 70)",
        },
        requireCode: {
          type: "boolean",
          description: "Only return posts with code",
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

// Create server
const server = new Server(
  {
    name: "swift-patterns-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools based on enabled sources
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const enabledSources = sourceManager.getEnabledSources();
  const hasPatreon = enabledSources.some(s => s.id === 'patreon');

  const tools = [...CORE_TOOLS];

  if (hasPatreon && patreonSource) {
    tools.push(...PATREON_TOOLS);
  }

  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const handler = getHandler(name);
    if (handler) {
      return handler(args ?? {}, toolContext);
    }
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return createErrorResponseFromError(error);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Swift MCP Server running on stdio");

  // Prefetch sources in background if enabled
  if (sourceManager.isPrefetchEnabled()) {
    prefetchAllSources().then((results) => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      logger.info(`Sources prefetch complete: ${successful} succeeded, ${failed} failed`);
    }).catch((error) => {
      logger.warn({ err: error }, "Failed to prefetch sources");
    });
  }

  // Prefetch semantic embedding model if semantic recall is enabled
  const semanticConfig = sourceManager.getSemanticRecallConfig();
  if (semanticConfig.enabled) {
    prefetchEmbeddingModel();
  }
}

main().catch((error) => {
  logger.error({ err: error }, "Fatal error");
  process.exit(1);
});
