/**
 * Shared utilities for formatting patterns in responses
 */

import type { BasePattern } from '../sources/free/rssPatternSource.js';

export interface FormatOptions {
  maxResults?: number;
  includeQuality?: boolean;
  includeTopics?: boolean;
  includeCode?: boolean;
  excerptLength?: number;
}

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  maxResults: 10,
  includeQuality: false,
  includeTopics: false,
  includeCode: true,
  excerptLength: 200,
};

/**
 * Format a single pattern as markdown
 */
export function formatPattern(pattern: BasePattern, options: FormatOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sourceId = pattern.id.split('-')[0];
  
  let formatted = `## ${pattern.title}\n`;
  formatted += `**Source**: ${sourceId}\n`;
  
  if (opts.includeQuality) {
    formatted += `**Quality**: ${pattern.relevanceScore}/100\n`;
  }
  
  if (opts.includeTopics && pattern.topics.length > 0) {
    formatted += `**Topics**: ${pattern.topics.join(', ')}\n`;
  }
  
  if (opts.includeCode && pattern.hasCode) {
    formatted += `**Code**: ✅\n`;
  }
  
  const excerpt = pattern.excerpt.substring(0, opts.excerptLength);
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
