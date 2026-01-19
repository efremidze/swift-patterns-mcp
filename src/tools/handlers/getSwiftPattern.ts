// src/tools/handlers/getSwiftPattern.ts

import type { ToolHandler } from '../types.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import SundellSource from '../../sources/free/sundell.js';
import VanderLeeSource from '../../sources/free/vanderlee.js';

export const getSwiftPatternHandler: ToolHandler = async (args, context) => {
  const topic = args?.topic as string;
  const source = (args?.source as string) || "all";
  const minQuality = (args?.minQuality as number) || 60;

  const results: BasePattern[] = [];

  // Get from free sources
  if (source === "all" || source === "sundell") {
    const sundell = new SundellSource();
    const patterns = await sundell.searchPatterns(topic);
    results.push(...patterns.filter(p => p.relevanceScore >= minQuality));
  }

  if (source === "all" || source === "vanderlee") {
    const vanderlee = new VanderLeeSource();
    const patterns = await vanderlee.searchPatterns(topic);
    results.push(...patterns.filter(p => p.relevanceScore >= minQuality));
  }

  if (results.length === 0) {
    return {
      content: [{
        type: "text",
        text: `No patterns found for "${topic}" with quality ≥ ${minQuality}.

Try:
- Broader search terms
- Lower minQuality
- Different topic

Available sources: Swift by Sundell, Antoine van der Lee
${context.sourceManager.isSourceConfigured('patreon') ? '\n💡 Enable Patreon for more premium content!' : ''}`,
      }],
    };
  }

  // Sort by relevance
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const formatted = results.slice(0, 10).map(p => `
## ${p.title}
**Source**: ${p.id.split('-')[0]}
**Quality**: ${p.relevanceScore}/100
**Topics**: ${p.topics.join(', ')}
${p.hasCode ? '**Has Code**: ✅' : ''}

${p.excerpt}...

**[Read full article](${p.url})**
`).join('\n---\n');

  return {
    content: [{
      type: "text",
      text: `# Swift Patterns: ${topic}

Found ${results.length} patterns from free sources:

${formatted}

${results.length > 10 ? `\n*Showing top 10 of ${results.length} results*` : ''}
`,
    }],
  };
};
