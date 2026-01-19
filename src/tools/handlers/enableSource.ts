// src/tools/handlers/enableSource.ts

import type { ToolHandler } from '../types.js';

export const enableSourceHandler: ToolHandler = async (args, context) => {
  const sourceId = args?.source as string;
  const source = context.sourceManager.getSource(sourceId);

  if (!source) {
    return {
      content: [{
        type: "text",
        text: `Unknown source: "${sourceId}"

Available sources:
${context.sourceManager.getAllSources().map(s => `- ${s.id}: ${s.name}`).join('\n')}`,
      }],
    };
  }

  if (source.requiresAuth && !context.sourceManager.isSourceConfigured(sourceId)) {
    return {
      content: [{
        type: "text",
        text: `⚙️ ${source.name} requires setup first.

Run: swift-mcp setup --${sourceId}

This will guide you through:
${sourceId === 'patreon' ? '- Patreon OAuth authentication\n- Connecting your subscriptions' : '- Authentication setup'}`,
      }],
    };
  }

  context.sourceManager.enableSource(sourceId);

  return {
    content: [{
      type: "text",
      text: `✅ ${source.name} enabled!

You can now use patterns from this source.`,
    }],
  };
};
