// src/tools/handlers/setupPatreon.ts

import type { ToolHandler } from '../types.js';
import { createTextResponse } from '../../utils/response-helpers.js';

export const setupPatreonHandler: ToolHandler = async (args, context) => {
  if (!context.patreonSource) {
    return createTextResponse(`Patreon integration not available.

Please ensure:
1. PATREON_CLIENT_ID is set in environment
2. PATREON_CLIENT_SECRET is set in environment

Get credentials at: https://www.patreon.com/portal/registration/register-clients`);
  }

  const action = (args?.action as string) || 'start';

  if (action === 'status') {
    const isConfigured = context.sourceManager.isSourceConfigured('patreon');
    return createTextResponse(isConfigured
      ? `Patreon is configured and ready to use!`
      : `Patreon is not yet configured.

Run: swift-patterns-mcp patreon setup`);
  }

  return createTextResponse(`Patreon Setup

To set up Patreon integration, run:
\`\`\`bash
swift-patterns-mcp patreon setup
\`\`\`

This will:
1. Open your browser for Patreon OAuth
2. Connect your subscriptions
3. Analyze your content
4. Enable premium patterns

After setup, you'll have access to:
- High-quality patterns from creators you support
- Automatic code extraction from zips
- Advanced filtering and search`);
};
