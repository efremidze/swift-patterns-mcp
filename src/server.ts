// src/server.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import SourceManager from "./config/sources.js";
import { getHandler, type ToolContext, type PatreonSourceConstructor } from './tools/index.js';
import { getToolList } from './tools/registration.js';
import { createErrorResponseFromError } from './utils/response-helpers.js';
import { prefetchAllSources } from './utils/source-registry.js';
import { prefetchEmbeddingModel } from './utils/semantic-recall.js';
import logger from './utils/logger.js';

/**
 * Start the MCP server with stdio transport
 */
export async function startServer(): Promise<void> {
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
    const tools = getToolList(sourceManager, patreonSource);
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

  await main().catch((error) => {
    logger.error({ err: error }, "Fatal error");
    process.exit(1);
  });
}
