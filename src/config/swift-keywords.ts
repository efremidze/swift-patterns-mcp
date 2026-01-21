// src/config/swift-keywords.ts

/**
 * Shared keyword definitions for Swift content analysis
 * These are used by various sources to detect topics and calculate relevance
 */

/**
 * Base topic keywords shared across all sources
 */
export const BASE_TOPIC_KEYWORDS: Record<string, string[]> = {
  'swiftui': ['swiftui', 'view', 'state', 'binding'],
  'concurrency': ['async', 'await', 'actor', 'task'],
  'testing': ['test', 'xctest', 'mock'],
  'architecture': ['architecture', 'mvvm', 'coordinator'],
  'networking': ['network', 'urlsession', 'api', 'http'],
  'performance': ['performance', 'memory', 'optimization'],
  'protocols': ['protocol', 'generic'],
  'uikit': ['uikit', 'uiview'],
};

/**
 * Base quality signals shared across all sources
 */
export const BASE_QUALITY_SIGNALS: Record<string, number> = {
  // Instructional content
  'how to': 5,
  'step by step': 5,
  'tutorial': 5,
  'guide': 4,
  'example': 4,
  'tip': 3,

  // Advanced topics
  'architecture': 8,
  'testing': 7,
  'performance': 7,
  'concurrency': 7,
  'async': 6,
  'await': 6,
  'actor': 6,
  'protocol': 5,
  'generic': 5,

  // Frameworks
  'swiftui': 6,
  'uikit': 5,
  'combine': 6,
};

/**
 * Merge keyword sets, with specific keywords overriding base keywords
 */
export function mergeKeywords(
  base: Record<string, string[]>,
  specific: Record<string, string[]>
): Record<string, string[]> {
  const merged: Record<string, string[]> = { ...base };
  
  for (const [key, values] of Object.entries(specific)) {
    if (merged[key]) {
      // Merge arrays and remove duplicates
      merged[key] = [...new Set([...merged[key], ...values])];
    } else {
      merged[key] = values;
    }
  }
  
  return merged;
}

/**
 * Merge quality signals, with specific signals overriding base signals
 */
export function mergeQualitySignals(
  base: Record<string, number>,
  specific: Record<string, number>
): Record<string, number> {
  return { ...base, ...specific };
}

/**
 * Create merged source configuration from source-specific overrides.
 * Simplifies the common pattern of extending base keywords/signals.
 */
export function createSourceConfig(
  specificTopics: Record<string, string[]>,
  specificSignals: Record<string, number>
): {
  topicKeywords: Record<string, string[]>;
  qualitySignals: Record<string, number>;
} {
  return {
    topicKeywords: mergeKeywords(BASE_TOPIC_KEYWORDS, specificTopics),
    qualitySignals: mergeQualitySignals(BASE_QUALITY_SIGNALS, specificSignals),
  };
}
