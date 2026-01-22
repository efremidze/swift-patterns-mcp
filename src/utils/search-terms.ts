// src/utils/search-terms.ts
// Shared search-related term lists

// Common stopwords to filter out
export const STOPWORDS = new Set([
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
export const PRESERVE_TERMS = new Set([
  'swift', 'swiftui', 'uikit', 'combine', 'async', 'await', 'actor',
  'struct', 'class', 'enum', 'protocol', 'extension', 'func', 'var', 'let',
  'mvvm', 'viper', 'mvc', 'tca', 'xctest', 'xcode', 'ios', 'macos',
  'watchos', 'tvos', 'ipados', 'appkit', 'foundation', 'coredata',
  'cloudkit', 'urlsession', 'codable', 'observable', 'published',
  'stateobject', 'observedobject', 'environmentobject', 'binding', 'state'
]);
