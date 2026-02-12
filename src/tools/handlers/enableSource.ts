// src/tools/handlers/enableSource.ts

import type { ToolHandler } from '../types.js';
import { createTextResponse, createErrorResponse } from '../../utils/response-helpers.js';
import { validateRequiredString, isValidationError } from '../validation.js';

export const enableSourceHandler: ToolHandler = async (args, context) => {
  const sourceId = validateRequiredString(args, 'source', 'Usage: enable_source({ source: "patreon" })');
  if (isValidationError(sourceId)) return sourceId;

  const source = context.sourceManager.getSource(sourceId);

  if (!source) {
    return createErrorResponse(`Unknown source: "${sourceId}"

Available sources:
${context.sourceManager.getAllSources().map(s => `- ${s.id}: ${s.name}`).join('\n')}`);
  }

  if (source.requiresAuth && !context.sourceManager.isSourceConfigured(sourceId)) {
    return createTextResponse(`⚙️ ${source.name} requires setup first.

Run: swift-patterns-mcp ${sourceId} setup

This will guide you through:
${sourceId === 'patreon' ? '- Patreon OAuth authentication\n- Connecting your subscriptions' : '- Authentication setup'}`);
  }

  context.sourceManager.enableSource(sourceId);

  return createTextResponse(`✅ ${source.name} enabled!

You can now use patterns from this source.`);
};
