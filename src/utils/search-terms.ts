// src/utils/search-terms.ts
// Shared search-related term lists

// Common stopwords to filter out
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
  'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
  'i', 'my', 'me', 'he', 'she', 'him', 'her', 'his', 'who', 'what', 'which',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'same',
  'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there'
]);

// Swift-specific terms that shouldn't be stemmed (preserve technical accuracy)
// NOTE: If you add hyphenated terms here (e.g. "objective-c"), the tokenizer will now respect them.
const PRESERVE_TERMS = new Set([
  'swift', 'swiftui', 'uikit', 'combine', 'async', 'await', 'actor',
  'struct', 'class', 'enum', 'protocol', 'extension', 'func', 'var', 'let',
  'mvvm', 'viper', 'mvc', 'tca', 'xctest', 'xcode', 'ios', 'macos',
  'watchos', 'tvos', 'ipados', 'appkit', 'foundation', 'coredata',
  'cloudkit', 'urlsession', 'codable', 'observable', 'published',
  'stateobject', 'observedobject', 'environmentobject', 'binding', 'state'
]);

/**
 * Shared token normalization logic used by both search and intent caching.
 * 
 * - Lowercase
 * - Strip non-word characters (keeping hyphens)
 * - Split on whitespace
 * - Split hyphenated terms
 * - Filter stopwords while preserving Swift-specific terms
 * 
 * @param text - Text to normalize
 * @param applyTransform - Optional transform function (e.g., stemmer) applied to non-preserved terms
 * @returns Array of normalized tokens
 */
export function normalizeTokens(
  text: string,
  applyTransform?: (token: string) => string
): string[] {
  // 1. Clean text but keep hyphens temporarily
  const rawTokens = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') 
    .split(/\s+/)
    .filter(t => t.length > 0);

  const finalTokens: string[] = [];

  for (const token of rawTokens) {
    // 2. Check if the full token is a preserved term (e.g., "objective-c")
    if (PRESERVE_TERMS.has(token)) {
      finalTokens.push(token);
      continue;
    }

    // 3. If not preserved, split on hyphens to separate words like "async-await" -> "async", "await"
    const subTokens = token.split('-');

    for (const sub of subTokens) {
      if (sub.length <= 1 || STOPWORDS.has(sub)) continue;

      // 4. Check sub-tokens against preserved terms or apply transform
      if (PRESERVE_TERMS.has(sub)) {
        finalTokens.push(sub);
      } else if (applyTransform) {
        finalTokens.push(applyTransform(sub));
      } else {
        finalTokens.push(sub);
      }
    }
  }

  return finalTokens;
}
