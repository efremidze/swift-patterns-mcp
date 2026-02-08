// src/tools/handlers/listContentSources.ts

import type { ToolHandler } from '../types.js';
import { createTextResponse } from '../../utils/response-helpers.js';

export const listContentSourcesHandler: ToolHandler = async (_args, context) => {
  const allSources = context.sourceManager.getAllSources();

  const freeList = allSources
    .filter(s => s.type === 'free')
    .map(s => `- ✅ **${s.name}** - ${s.description}`)
    .join('\n');

  const premiumList = allSources
    .filter(s => s.type === 'premium')
    .map(s => {
      const status = s.isConfigured && s.isEnabled ? '✅' :
                    s.isConfigured ? '⚙️' : '⬜';
      return `- ${status} **${s.name}** - ${s.description}${s.isConfigured ? '' : ' (Setup required)'}`;
    })
    .join('\n');

  return createTextResponse(`# Content Sources

## Free Sources (Always Available)
${freeList}

## Premium Sources (Optional)
${premiumList}

## Legend
✅ Enabled | ⚙️ Configured but disabled | ⬜ Not configured

To enable premium sources:
\`\`\`
swift-patterns-mcp patreon setup
\`\`\`
`);
};
