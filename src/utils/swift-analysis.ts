// src/utils/swift-analysis.ts

/**
 * Shared utilities for analyzing Swift code content and detecting topics
 */

/**
 * Detect topics from text based on keyword matching
 * @param text The text to analyze
 * @param keywords Map of topic names to keyword arrays
 * @returns Array of detected topic names
 */
export function detectTopics(text: string, keywords: Record<string, string[]>): string[] {
  const topics: string[] = [];
  const lower = text.toLowerCase();

  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(w => lower.includes(w))) {
      topics.push(topic);
    }
  }

  return topics;
}

/**
 * Check if content contains Swift code patterns
 * @param content The content to check
 * @returns True if Swift code patterns are detected
 */
export function hasCodeContent(content: string): boolean {
  // Check for common Swift code patterns
  if (/\b(func|class|struct|protocol|extension|enum|actor)\s+\w+/.test(content)) {
    return true;
  }
  
  // Check for markdown code blocks
  if (content.includes('```')) {
    return true;
  }
  
  // Check for HTML code tags
  if (content.includes('<code>') || content.includes('<pre>')) {
    return true;
  }
  
  // Check for additional Swift-specific patterns
  const codeIndicators = [
    /\blet\s+\w+\s*[=:]/,
    /\bvar\s+\w+\s*[=:]/,
    /\breturn\s+\w+/,
    /\bguard\s+let/,
    /\bif\s+let/,
    /\basync\s+(func|let|var|throws)/,
    /\bawait\s+\w+/,
    /\b\w+\s*\(\s*\)\s*->\s*\w+/,
    /@\w+\s+(struct|class|func|var)/,
  ];
  
  return codeIndicators.some(pattern => pattern.test(content));
}

/**
 * Calculate relevance score based on keyword presence and code content
 * @param text The text to analyze
 * @param hasCode Whether the content has code
 * @param qualitySignals Map of quality signals to point values
 * @param baseScore Starting score (default: 50)
 * @param codeBonus Bonus points for having code (default: 10-15)
 * @returns Relevance score (0-100)
 */
export function calculateRelevance(
  text: string,
  hasCode: boolean,
  qualitySignals: Record<string, number>,
  baseScore: number = 50,
  codeBonus: number = 10
): number {
  const lower = text.toLowerCase();
  let score = baseScore;

  // Add points for quality signals
  for (const [keyword, points] of Object.entries(qualitySignals)) {
    if (lower.includes(keyword)) {
      score += points;
    }
  }

  // Bonus for code content
  if (hasCode) {
    score += codeBonus;
  }

  // Cap at 100
  return Math.min(100, score);
}
