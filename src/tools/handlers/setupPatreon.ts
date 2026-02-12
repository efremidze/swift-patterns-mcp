// src/tools/handlers/setupPatreon.ts

import type { ToolHandler } from '../types.js';
import { createTextResponse, formatMarkdownDocument } from '../../utils/response-helpers.js';
import { PATREON_CORE_ENV_VARS } from '../../utils/patreon-env.js';
import { validateOptionalString, isValidationError } from '../validation.js';

export const setupPatreonHandler: ToolHandler = async (args, context) => {
  if (!context.patreonSource) {
    return createTextResponse(formatMarkdownDocument(
      'Patreon Integration',
      [
        {
          lines: [
            'Patreon integration not available.',
            'Please ensure:',
            ...PATREON_CORE_ENV_VARS.map((name, idx) => `${idx + 1}. ${name} is set in environment`),
          ],
        },
      ],
      'Get credentials at: https://www.patreon.com/portal/registration/register-clients'
    ));
  }

  const actionValidated = validateOptionalString(args, 'action');
  if (isValidationError(actionValidated)) return actionValidated;
  const action = actionValidated || 'start';

  if (action === 'status') {
    const isConfigured = context.sourceManager.isSourceConfigured('patreon');
    return createTextResponse(isConfigured
      ? `Patreon is configured and ready to use!`
      : `Patreon is not yet configured.

Run: swift-patterns-mcp patreon setup`);
  }

  return createTextResponse(formatMarkdownDocument(
    'Patreon Setup',
    [
      {
        lines: [
          'To set up Patreon integration, run:',
          '```bash',
          'swift-patterns-mcp patreon setup',
          '```',
        ],
      },
      {
        heading: 'This Will',
        lines: [
          '1. Open your browser for Patreon OAuth',
          '2. Connect your subscriptions',
          '3. Analyze your content',
          '4. Enable premium patterns',
        ],
      },
      {
        heading: 'After Setup',
        lines: [
          '- High-quality patterns from creators you support',
          '- Automatic code extraction from zips',
          '- Advanced filtering and search',
        ],
      },
    ]
  ));
};
