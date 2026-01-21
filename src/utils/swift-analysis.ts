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

/**
 * Extract code snippets from content
 * @param content The content to extract from
 * @param maxSnippets Maximum number of snippets to return (default: 2)
 * @returns Array of code snippets
 */
export function extractCodeSnippets(content: string, maxSnippets: number = 2): string[] {
  const snippets: string[] = [];

  // Extract markdown code blocks (```swift or ```)
  const markdownRegex = /```(?:swift)?\n?([\s\S]*?)```/g;
  let match;
  while ((match = markdownRegex.exec(content)) !== null) {
    const code = match[1].trim();
    if (code && code.split('\n').length >= 2) {
      snippets.push(truncateSnippet(code));
    }
    if (snippets.length >= maxSnippets) break;
  }

  // Extract HTML code blocks if we don't have enough snippets
  if (snippets.length < maxSnippets) {
    const htmlRegex = /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g;
    while ((match = htmlRegex.exec(content)) !== null) {
      const code = match[1]
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .trim();
      if (code && code.split('\n').length >= 2) {
        snippets.push(truncateSnippet(code));
      }
      if (snippets.length >= maxSnippets) break;
    }
  }

  return snippets.slice(0, maxSnippets);
}

/**
 * Truncate a code snippet to ~10 lines
 */
function truncateSnippet(code: string): string {
  const lines = code.split('\n');
  if (lines.length <= 10) return code;
  return lines.slice(0, 10).join('\n') + '\n// ...';
}

/**
 * Extract Swift-specific techniques and APIs from content
 * @param content The content to analyze
 * @returns Array of detected techniques (max 5, unique)
 */
export function extractTechniques(content: string): string[] {
  const techniques = new Set<string>();

  // Swift attributes
  const attributes = [
    '@Observable', '@MainActor', '@State', '@Binding', '@Environment',
    '@Query', '@Model', '@Published', '@StateObject', '@ObservedObject',
    '@ViewBuilder', '@resultBuilder', '@available'
  ];

  for (const attr of attributes) {
    if (content.includes(attr)) {
      techniques.add(attr);
    }
  }

  // Concurrency patterns
  const concurrencyPatterns = [
    { pattern: /\basync\s+(?:func|let|var|throws)/, name: 'async/await' },
    { pattern: /\bawait\s+/, name: 'async/await' },
    { pattern: /\bTask\s*{/, name: 'Task' },
    { pattern: /\bTaskGroup/, name: 'TaskGroup' },
    { pattern: /\bwithCheckedContinuation/, name: 'withCheckedContinuation' },
    { pattern: /\bwithCheckedThrowingContinuation/, name: 'withCheckedThrowingContinuation' },
    { pattern: /\bactor\s+\w+/, name: 'actor' },
    { pattern: /\bSendable/, name: 'Sendable' },
  ];

  for (const { pattern, name } of concurrencyPatterns) {
    if (pattern.test(content)) {
      techniques.add(name);
    }
  }

  // SwiftUI patterns
  const swiftUIPatterns = [
    'NavigationStack', 'NavigationSplitView', '.navigationDestination',
    '.sheet', '.fullScreenCover', '.toolbar', '.searchable',
    'List', 'Form', 'ScrollView', 'LazyVStack', 'LazyHStack'
  ];

  for (const pattern of swiftUIPatterns) {
    if (content.includes(pattern)) {
      techniques.add(pattern);
    }
  }

  // SwiftData patterns
  const swiftDataPatterns = ['@Model', '@Query', 'ModelContext', 'ModelContainer'];
  for (const pattern of swiftDataPatterns) {
    if (content.includes(pattern)) {
      techniques.add(pattern);
    }
  }

  // Frameworks (when used in code context)
  const frameworks = ['SwiftUI', 'Combine', 'SwiftData', 'CoreData', 'UIKit'];
  for (const framework of frameworks) {
    // Check if framework appears near code indicators
    if (content.includes(framework) && (
      content.includes(`import ${framework}`) ||
      content.includes(`${framework}.`)
    )) {
      techniques.add(framework);
    }
  }

  // Return up to 5 techniques
  return Array.from(techniques).slice(0, 5);
}

/**
 * Detect complexity level of content
 * @param content The content to analyze
 * @param topics Detected topics
 * @returns Complexity level
 */
export function detectComplexity(content: string, topics: string[]): 'beginner' | 'intermediate' | 'advanced' {
  const lower = content.toLowerCase();

  // Advanced indicators
  const advancedKeywords = [
    'performance', 'optimization', 'benchmark', 'profiling',
    'unsafe', 'pointer', 'memory management',
    'macro', '@attached', '@freestanding',
    'race condition', 'thread safety', 'atomic',
    'custom property wrapper', 'type erasure',
    'protocol witness', 'existential'
  ];

  const hasAdvancedKeyword = advancedKeywords.some(kw => lower.includes(kw));

  // Beginner indicators
  const beginnerKeywords = [
    'introduction', 'getting started', 'basics', 'tutorial',
    'hello world', 'first', 'simple example'
  ];

  const hasBeginnerKeyword = beginnerKeywords.some(kw => lower.includes(kw));

  // Count complexity signals
  const wordCount = content.split(/\s+/).length;
  const codeBlocks = (content.match(/```/g) || []).length / 2;
  const topicCount = topics.length;

  // Decision logic
  if (hasAdvancedKeyword || (topicCount >= 4 && codeBlocks >= 3)) {
    return 'advanced';
  }

  if (hasBeginnerKeyword && topicCount <= 1 && wordCount < 500) {
    return 'beginner';
  }

  if (topicCount <= 1 && codeBlocks <= 1 && wordCount < 300) {
    return 'beginner';
  }

  // Default to intermediate for most content
  return 'intermediate';
}

/**
 * Truncate text at sentence boundary
 * @param text Text to truncate
 * @param maxLength Maximum length
 * @returns Truncated text without trailing ellipsis
 */
export function truncateAtSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find sentence boundaries within reasonable range
  const minLength = Math.floor(maxLength * 0.8);
  const searchText = text.substring(0, maxLength);

  // Look for sentence endings (. ! ?)
  const sentenceEndings = ['. ', '! ', '? '];
  let bestPos = -1;

  for (const ending of sentenceEndings) {
    const pos = searchText.lastIndexOf(ending);
    if (pos >= minLength && pos > bestPos) {
      bestPos = pos + 1; // Include the punctuation
    }
  }

  if (bestPos > 0) {
    return text.substring(0, bestPos).trim();
  }

  // Fall back to word boundary
  const wordBoundary = searchText.lastIndexOf(' ');
  if (wordBoundary > minLength) {
    return text.substring(0, wordBoundary).trim();
  }

  // Last resort: cut at maxLength but try to avoid mid-word
  return text.substring(0, maxLength).trim();
}

/**
 * Extract descriptive title from content
 * @param content Content to extract from
 * @param fallbackTitle Fallback if no good title found
 * @returns Extracted or fallback title
 */
export function extractDescriptiveTitle(content: string, fallbackTitle: string): string {
  // Try to find H1 in markdown
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    const title = cleanTitle(h1Match[1]);
    if (!isGenericTitle(title)) {
      return title;
    }
  }

  // Try HTML H1
  const htmlH1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (htmlH1Match) {
    const title = cleanTitle(htmlH1Match[1]);
    if (!isGenericTitle(title)) {
      return title;
    }
  }

  // Try H2 if H1 was generic
  const h2Match = content.match(/^##\s+(.+)$/m);
  if (h2Match) {
    const title = cleanTitle(h2Match[1]);
    if (!isGenericTitle(title)) {
      return title;
    }
  }

  // Try HTML H2
  const htmlH2Match = content.match(/<h2[^>]*>(.*?)<\/h2>/i);
  if (htmlH2Match) {
    const title = cleanTitle(htmlH2Match[1]);
    if (!isGenericTitle(title)) {
      return title;
    }
  }

  return fallbackTitle;
}

/**
 * Clean title by removing HTML tags and extra whitespace
 */
function cleanTitle(title: string): string {
  return title
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if title is too generic to be useful
 */
function isGenericTitle(title: string): boolean {
  const genericPatterns = [
    /^newsletter\s*#?\d+$/i,
    /^issue\s*#?\d+$/i,
    /^swift by sundell$/i,
    /^blog$/i,
    /^article$/i,
  ];

  return genericPatterns.some(pattern => pattern.test(title));
}
