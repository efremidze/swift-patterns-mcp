// src/tools/handlers/getPatreonPatterns.ts

import type { ToolHandler, PatreonPattern } from '../types.js';
import { createTextResponse, formatMarkdownDocument } from '../../utils/response-helpers.js';
import { getYouTubeStatus } from '../../sources/premium/youtube.js';
import { PATREON_SEARCH_ENV_VARS, getMissingEnvVars, formatEnvExportHints } from '../../utils/patreon-env.js';

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

  const topic = args?.topic as string | undefined;
  const requireCode = args?.requireCode as boolean | undefined;

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

  // Surface YouTube API issues if recent
  const ytStatus = getYouTubeStatus();
  const ytWarning = ytStatus.lastError && ytStatus.lastErrorTime &&
    (Date.now() - ytStatus.lastErrorTime < 300_000)
      ? `\n> **Note:** YouTube API error: ${ytStatus.lastError}. Some results may be missing.\n`
      : '';

  const title = `Patreon Patterns${topic ? `: ${topic}` : ''}`;
  const totalLine = `Found ${patterns.length} posts from your subscriptions:`;
  const footer = patterns.length > 10 ? `*Showing top 10 of ${patterns.length} results*` : '';

  return createTextResponse(formatMarkdownDocument(title, [
    {
      lines: [
        ytWarning.trim(),
        totalLine,
        '',
        formatted,
      ],
    },
  ], footer));
};
