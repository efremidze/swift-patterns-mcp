// src/tools/handlers/getPatreonPatterns.ts

import type { ToolHandler, PatreonPattern } from '../types.js';
import { createTextResponse, formatMarkdownDocument } from '../../utils/response-helpers.js';
import { PATREON_SEARCH_ENV_VARS, getMissingEnvVars, formatEnvExportHints } from '../../utils/patreon-env.js';
import { validateOptionalString, validateOptionalBoolean, validateOptionalNumber, isValidationError } from '../validation.js';

export const getPatreonPatternsHandler: ToolHandler = async (args, context) => {
  // Check for missing environment variables and give specific feedback
  const missingVars = getMissingEnvVars(PATREON_SEARCH_ENV_VARS);
  if (missingVars.length > 0) {
    return createTextResponse(formatMarkdownDocument(
      'Patreon Integration',
      [
        {
          lines: [
            'Patreon integration missing required environment variables:',
            ...missingVars.map(v => `- ${v}`),
          ],
        },
        {
          heading: 'Add To Environment',
          lines: formatEnvExportHints(missingVars),
        },
      ],
      'For setup instructions: https://github.com/efremidze/swift-patterns-mcp#patreon-setup'
    ));
  }

  if (!context.patreonSource) {
    return createTextResponse(`Patreon module not available. Check your installation.`);
  }

  const topicValidated = validateOptionalString(args, 'topic');
  if (isValidationError(topicValidated)) return topicValidated;
  const topic = topicValidated;

  const requireCodeValidated = validateOptionalBoolean(args, 'requireCode');
  if (isValidationError(requireCodeValidated)) return requireCodeValidated;
  const requireCode = requireCodeValidated;

  const minQualityValidated = validateOptionalNumber(args, 'minQuality');
  if (isValidationError(minQualityValidated)) return minQualityValidated;

  const patreon = new context.patreonSource();
  let patterns: PatreonPattern[] = topic
    ? await patreon.searchPatterns(topic, { mode: 'deep' })
    : await patreon.fetchPatterns();

  if (requireCode) {
    patterns = patterns.filter(p => p.hasCode);
  }

  if (patterns.length === 0) {
    return createTextResponse(`No Patreon patterns found${topic ? ` for "${topic}"` : ''}${requireCode ? ' with code' : ''}.`);
  }

  const formatted = patterns.slice(0, 10).map(p => `
## ${p.title}
**Creator**: ${p.creator}
**Date**: ${new Date(p.publishDate).toLocaleDateString()}
${p.hasCode ? '**Has Code**: Yes' : ''}
**Topics**: ${p.topics.length > 0 ? p.topics.join(', ') : 'General'}

${p.excerpt}...

**[Read full post](${p.url})**
`).join('\n---\n');

  const title = `Patreon Patterns${topic ? `: ${topic}` : ''}`;
  const totalLine = `Found ${patterns.length} posts from your subscriptions:`;
  const footer = patterns.length > 10 ? `*Showing top 10 of ${patterns.length} results*` : '';

  return createTextResponse(formatMarkdownDocument(title, [
    {
      lines: [
        totalLine,
        '',
        formatted,
      ],
    },
  ], footer));
};
