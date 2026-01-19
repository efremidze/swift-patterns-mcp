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
import { getHandler, ToolContext } from './tools/index.js';

// Premium sources (imported conditionally)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let patreonSource: any = null;
try {
  const module = await import("./sources/premium/patreon.js");
  patreonSource = module.PatreonSource;
} catch {
  // Patreon not available
}

// Initialize source manager
const sourceManager = new SourceManager();

// Tool context for handlers
const toolContext: ToolContext = { sourceManager, patreonSource };

// Core tools (always available)
const CORE_TOOLS: Tool[] = [
  {
    name: "get_swift_pattern",
    description: "Get Swift/SwiftUI patterns from curated free sources (Sundell, van der Lee, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Topic to search (e.g., 'swiftui', 'testing', 'async-await', 'performance')",
        },
        source: {
          type: "string",
          enum: ["all", "sundell", "vanderlee"],
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
          description: "Source ID (e.g., 'patreon', 'github-sponsors')",
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
    name: "swift-mcp",
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
    // Check registry first for core handlers
    const handler = getHandler(name);
    if (handler) {
      return handler(args ?? {}, toolContext);
    }

    // Patreon handlers remain inline (complex, references dynamic import)
    switch (name) {
      case "setup_patreon": {
        if (!patreonSource) {
          return {
            content: [{
              type: "text",
              text: `❌ Patreon integration not available.

Please ensure:
1. PATREON_CLIENT_ID is set in environment
2. PATREON_CLIENT_SECRET is set in environment

Get credentials at: https://www.patreon.com/portal/registration/register-clients`,
            }],
          };
        }

        const action = (args?.action as string) || "start";

        if (action === "status") {
          const isConfigured = sourceManager.isSourceConfigured('patreon');
          return {
            content: [{
              type: "text",
              text: isConfigured
                ? `✅ Patreon is configured and ready to use!`
                : `⚙️ Patreon is not yet configured.

Run: swift-mcp setup --patreon`,
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text: `⚙️ Patreon Setup

To set up Patreon integration, run:
\`\`\`bash
swift-mcp setup --patreon
\`\`\`

This will:
1. Open your browser for Patreon OAuth
2. Connect your subscriptions
3. Analyze your content
4. Enable premium patterns

After setup, you'll have access to:
- High-quality patterns from creators you support
- Automatic code extraction from zips
- Advanced filtering and search`,
          }],
        };
      }

      case "get_patreon_patterns": {
        if (!sourceManager.isSourceConfigured('patreon')) {
          return {
            content: [{
              type: "text",
              text: `⚙️ Patreon not configured.

Set it up with: swift-mcp setup --patreon`,
            }],
          };
        }

        if (!patreonSource) {
          return {
            content: [{
              type: "text",
              text: `❌ Patreon module not available. Check your installation.`,
            }],
          };
        }

        const topic = args?.topic as string;
        const requireCode = args?.requireCode as boolean;

        const patreon = new patreonSource();
        let patterns = topic
          ? await patreon.searchPatterns(topic)
          : await patreon.fetchPatterns();

        if (requireCode) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          patterns = patterns.filter((p: any) => p.hasCode);
        }

        if (patterns.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No Patreon patterns found${topic ? ` for "${topic}"` : ''}${requireCode ? ' with code' : ''}.`,
            }],
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formatted = patterns.slice(0, 10).map((p: any) => `
## ${p.title}
**Creator**: ${p.creator}
**Date**: ${new Date(p.publishDate).toLocaleDateString()}
${p.hasCode ? '**Has Code**: ✅' : ''}
**Topics**: ${p.topics.length > 0 ? p.topics.join(', ') : 'General'}

${p.excerpt}...

**[Read full post](${p.url})**
`).join('\n---\n');

        return {
          content: [{
            type: "text",
            text: `# Patreon Patterns${topic ? `: ${topic}` : ''}

Found ${patterns.length} posts from your subscriptions:

${formatted}

${patterns.length > 10 ? `\n*Showing top 10 of ${patterns.length} results*` : ''}`,
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: `Error: ${errorMessage}`,
      }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Swift MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
