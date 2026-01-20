// src/tools/handlers/getSwiftPattern.ts

import type { ToolHandler } from '../types.js';
import type { BasePattern } from '../../sources/free/rssPatternSource.js';
import SundellSource from '../../sources/free/sundell.js';
import VanderLeeSource from '../../sources/free/vanderlee.js';
import NilCoalescingSource from '../../sources/free/nilcoalescing.js';
import PointFreeSource from '../../sources/free/pointfree.js';

export const getSwiftPatternHandler: ToolHandler = async (args, context) => {
  const topic = args?.topic as string;

  if (!topic) {
    return {
      content: [{
        type: "text",
        text: `Missing required argument: topic

Usage: get_swift_pattern({ topic: "swiftui" })

Example topics:
- swiftui, concurrency, testing, networking
- performance, architecture, protocols
- async-await, combine, coredata`,
      }],
    };
  }

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

  if (source === "all" || source === "nilcoalescing") {
    const nilCoalescing = new NilCoalescingSource();
    const patterns = await nilCoalescing.searchPatterns(topic);
    results.push(...patterns.filter(p => p.relevanceScore >= minQuality));
  }

  if (source === "all" || source === "pointfree") {
    const pointFree = new PointFreeSource();
    const patterns = await pointFree.searchPatterns(topic);
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

Available sources: Swift by Sundell, Antoine van der Lee, Nil Coalescing, Point-Free
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
