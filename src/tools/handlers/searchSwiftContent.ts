// src/tools/handlers/searchSwiftContent.ts

import type { ToolHandler } from '../types.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import SundellSource from '../../sources/free/sundell.js';
import VanderLeeSource from '../../sources/free/vanderlee.js';

export const searchSwiftContentHandler: ToolHandler = async (args) => {
  const query = args?.query as string;
  const requireCode = args?.requireCode as boolean;

  const results: BasePattern[] = [];

  // Search all enabled free sources
  const sundell = new SundellSource();
  const sundellResults = await sundell.searchPatterns(query);
  results.push(...sundellResults);

  const vanderlee = new VanderLeeSource();
  const vanderLeeResults = await vanderlee.searchPatterns(query);
  results.push(...vanderLeeResults);

  // Filter by code if requested
  const filtered = requireCode
    ? results.filter(r => r.hasCode)
    : results;

  if (filtered.length === 0) {
    return {
      content: [{
        type: "text",
        text: `No results found for "${query}"${requireCode ? ' with code examples' : ''}.`,
      }],
    };
  }

  const formatted = filtered.slice(0, 10).map(r => `
## ${r.title}
**Source**: ${r.id.split('-')[0]}
${r.hasCode ? '**Code**: ✅' : ''}
${r.excerpt.substring(0, 200)}...
[Read more](${r.url})
`).join('\n---\n');

  return {
    content: [{
      type: "text",
      text: `# Search Results: "${query}"

${formatted}
`,
    }],
  };
};
