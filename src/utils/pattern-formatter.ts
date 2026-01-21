/**
 * Shared utilities for formatting patterns in responses
 */

import type { BasePattern } from '../sources/free/rssPatternSource.js';
import {
  extractCodeSnippets,
  extractTechniques,
  detectComplexity,
  truncateAtSentence,
  extractDescriptiveTitle
} from './swift-analysis.js';

export interface FormatOptions {
  maxResults?: number;
  includeQuality?: boolean;
  includeTopics?: boolean;
  includeCode?: boolean;
  excerptLength?: number;
  includeSnippets?: boolean;
  includeTechniques?: boolean;
  includeComplexity?: boolean;
  maxSnippets?: number;
}

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  maxResults: 10,
  includeQuality: false,
  includeTopics: false,
  includeCode: true,
  excerptLength: 200,
  includeSnippets: true,
  includeTechniques: true,
  includeComplexity: true,
  maxSnippets: 1,
};

/**
 * Format a single pattern as markdown
 */
export function formatPattern(pattern: BasePattern, options: FormatOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sourceId = pattern.id.split('-')[0];

  // Extract descriptive title from content
  const title = extractDescriptiveTitle(pattern.content, pattern.title);

  let formatted = `## ${title}\n`;
  formatted += `**Source**: ${sourceId}\n`;

  if (opts.includeQuality) {
    formatted += `**Quality**: ${pattern.relevanceScore}/100\n`;
  }

  if (opts.includeComplexity) {
    const complexity = detectComplexity(pattern.content, pattern.topics);
    formatted += `**Complexity**: ${complexity}\n`;
  }

  if (opts.includeTopics && pattern.topics.length > 0) {
    formatted += `**Topics**: ${pattern.topics.join(', ')}\n`;
  }

  if (opts.includeTechniques) {
    const techniques = extractTechniques(pattern.content);
    if (techniques.length > 0) {
      formatted += `**Techniques**: ${techniques.join(', ')}\n`;
    }
  }

  // Show code snippets if available and requested
  if (opts.includeSnippets && pattern.hasCode) {
    const snippets = extractCodeSnippets(pattern.content, opts.maxSnippets);
    if (snippets.length > 0) {
      formatted += `\n**Code Example**:\n`;
      snippets.forEach(snippet => {
        formatted += '```swift\n' + snippet + '\n```\n';
      });
    } else if (opts.includeCode) {
      // Fallback to checkmark if no snippets extracted
      formatted += `**Code**: ✅\n`;
    }
  } else if (opts.includeCode && pattern.hasCode) {
    formatted += `**Code**: ✅\n`;
  }

  // Use smart truncation at sentence boundaries
  const excerpt = truncateAtSentence(pattern.excerpt, opts.excerptLength);
  formatted += `\n${excerpt}...\n\n`;
  formatted += `[Read more](${pattern.url})`;

  return formatted;
}

/**
 * Format multiple patterns as a markdown document
 */
export function formatPatterns(
  patterns: BasePattern[],
  title: string,
  options: FormatOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const limited = patterns.slice(0, opts.maxResults);
  
  const formatted = limited.map(p => formatPattern(p, opts)).join('\n\n---\n\n');
  
  const count = patterns.length;
  const shown = limited.length;
  
  let result = `# ${title}\n\n`;
  
  if (count > 0) {
    result += `Found ${count} result${count === 1 ? '' : 's'}:\n\n`;
  }
  
  result += formatted;
  
  if (count > shown) {
    result += `\n\n*Showing top ${shown} of ${count} results*`;
  }
  
  return result;
}

/**
 * Format patterns for topic-based queries (with quality and topics)
 */
export function formatTopicPatterns(
  patterns: BasePattern[],
  topic: string,
  options: FormatOptions = {}
): string {
  return formatPatterns(patterns, `Swift Patterns: ${topic}`, {
    ...options,
    includeQuality: true,
    includeTopics: true,
    includeCode: true,
    excerptLength: 300,
  });
}

/**
 * Format patterns for general search queries
 */
export function formatSearchPatterns(
  patterns: BasePattern[],
  query: string,
  options: FormatOptions = {}
): string {
  return formatPatterns(patterns, `Search Results: "${query}"`, {
    ...options,
    includeQuality: false,
    includeTopics: false,
    includeCode: true,
    excerptLength: 200,
  });
}
