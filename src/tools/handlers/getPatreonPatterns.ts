// src/tools/handlers/getPatreonPatterns.ts

import type { ToolHandler, PatreonPattern } from '../types.js';
import { createTextResponse } from '../../utils/response-helpers.js';
import { CREATORS } from '../../config/creators.js';
import { getPatreonCreatorsPath } from '../../utils/paths.js';
import fs from 'fs';
import path from 'path';

// Default creators to enable if none configured (known Swift/iOS creators)
const DEFAULT_CREATOR_IDS = CREATORS.map(c => c.patreonCampaignId);

function ensureDefaultCreators(): void {
  const configPath = getPatreonCreatorsPath();

  // If creators file doesn't exist, create it with defaults
  if (!fs.existsSync(configPath)) {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({ enabledCreators: DEFAULT_CREATOR_IDS }, null, 2));
  }
}

function getMissingEnvVars(): string[] {
  const required = ['YOUTUBE_API_KEY', 'PATREON_CLIENT_ID', 'PATREON_CLIENT_SECRET'];
  return required.filter(key => !process.env[key]);
}

export const getPatreonPatternsHandler: ToolHandler = async (args, context) => {
  // Check for missing environment variables and give specific feedback
  const missingVars = getMissingEnvVars();
  if (missingVars.length > 0) {
    return createTextResponse(`Patreon integration missing required environment variables:

${missingVars.map(v => `  - ${v}`).join('\n')}

Add these to your .env file or environment:
${missingVars.map(v => `  export ${v}="your_${v.toLowerCase()}"`).join('\n')}

For setup instructions: https://github.com/anthropics/swift-patterns-mcp#patreon-setup`);
  }

  if (!context.patreonSource) {
    return createTextResponse(`Patreon module not available. Check your installation.`);
  }

  // Auto-setup default creators if none configured
  ensureDefaultCreators();

  // Auto-mark as configured since env vars are present
  if (!context.sourceManager.isSourceConfigured('patreon')) {
    context.sourceManager.markSourceConfigured('patreon');
  }

  const topic = args?.topic as string | undefined;
  const requireCode = args?.requireCode as boolean | undefined;

  const patreon = new context.patreonSource();
  let patterns: PatreonPattern[] = topic
    ? await patreon.searchPatterns(topic)
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

  return createTextResponse(`# Patreon Patterns${topic ? `: ${topic}` : ''}

Found ${patterns.length} posts from your subscriptions:

${formatted}

${patterns.length > 10 ? `\n*Showing top 10 of ${patterns.length} results*` : ''}`);
};
