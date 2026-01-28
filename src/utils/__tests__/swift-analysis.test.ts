// src/utils/swift-analysis.test.ts

import { describe, it, expect } from 'vitest';
import {
  detectTopics,
  hasCodeContent,
  calculateRelevance,
  extractCodeSnippets,
  extractTechniques,
  detectComplexity,
  truncateAtSentence,
  extractDescriptiveTitle
} from '../swift-analysis.js';

describe('detectTopics', () => {
  const keywords = {
    swiftui: ['swiftui', '@state', '@binding', 'view body'],
    concurrency: ['async', 'await', 'actor', 'task'],
    testing: ['xctest', 'unit test', 'test case'],
    networking: ['urlsession', 'api call', 'http request'],
  };

  it('should detect single topic', () => {
    const text = 'Building apps with SwiftUI is fun';
    const topics = detectTopics(text, keywords);

    expect(topics).toContain('swiftui');
    expect(topics.length).toBe(1);
  });

  it('should detect multiple topics', () => {
    const text = 'Using async/await with SwiftUI views';
    const topics = detectTopics(text, keywords);

    expect(topics).toContain('swiftui');
    expect(topics).toContain('concurrency');
    expect(topics.length).toBe(2);
  });

  it('should return empty array when no topics match', () => {
    const text = 'This is about something completely different';
    const topics = detectTopics(text, keywords);

    expect(topics).toEqual([]);
  });

  it('should be case insensitive', () => {
    const text = 'SWIFTUI and ASYNC patterns';
    const topics = detectTopics(text, keywords);

    expect(topics).toContain('swiftui');
    expect(topics).toContain('concurrency');
  });

  it('should match partial keywords', () => {
    const text = 'Making URLSession requests';
    const topics = detectTopics(text, keywords);

    expect(topics).toContain('networking');
  });

  it('should detect all matching topics', () => {
    const text = 'XCTest for testing async SwiftUI networking with URLSession';
    const topics = detectTopics(text, keywords);

    expect(topics).toContain('swiftui');
    expect(topics).toContain('concurrency');
    expect(topics).toContain('testing');
    expect(topics).toContain('networking');
  });
});

describe('hasCodeContent', () => {
  describe('Swift keyword detection', () => {
    it('should detect func declarations', () => {
      const content = 'func fetchData() async throws { }';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect class declarations', () => {
      const content = 'class ViewModel: ObservableObject { }';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect struct declarations', () => {
      const content = 'struct ContentView: View { }';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect protocol declarations', () => {
      const content = 'protocol DataService { }';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect extension declarations', () => {
      const content = 'extension String { }';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect enum declarations', () => {
      const content = 'enum State { case loading }';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect actor declarations', () => {
      const content = 'actor DataStore { }';
      expect(hasCodeContent(content)).toBe(true);
    });
  });

  describe('markdown code blocks', () => {
    it('should detect triple backtick code blocks', () => {
      const content = 'Here is some code:\n```swift\nlet x = 1\n```';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect code blocks without language', () => {
      const content = 'Example:\n```\nprint("hello")\n```';
      expect(hasCodeContent(content)).toBe(true);
    });
  });

  describe('HTML code tags', () => {
    it('should detect <code> tags', () => {
      const content = 'Use <code>let x = 1</code> to declare';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect <pre> tags', () => {
      const content = '<pre>func hello() { }</pre>';
      expect(hasCodeContent(content)).toBe(true);
    });
  });

  describe('Swift-specific patterns', () => {
    it('should detect let assignments', () => {
      const content = 'let viewModel = ViewModel()';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect var assignments', () => {
      const content = 'var count = 0';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect let with type annotation', () => {
      const content = 'let name: String = "test"';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect guard let', () => {
      const content = 'guard let value = optional else { return }';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect if let', () => {
      const content = 'if let unwrapped = optional { }';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect async func', () => {
      const content = 'async func loadData() { }';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect await calls', () => {
      const content = 'await fetchData()';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect return statements', () => {
      const content = 'return viewModel';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect function signatures with return types', () => {
      const content = 'makeRequest() -> URLRequest';
      expect(hasCodeContent(content)).toBe(true);
    });

    it('should detect property wrappers', () => {
      const content = '@State var count = 0';
      expect(hasCodeContent(content)).toBe(true);
    });
  });

  describe('non-code content', () => {
    it('should return false for plain text', () => {
      const content = 'This is just a regular article about programming concepts.';
      expect(hasCodeContent(content)).toBe(false);
    });

    it('should return false for text mentioning code concepts', () => {
      const content = 'Functions are important in programming. Classes help organize code.';
      expect(hasCodeContent(content)).toBe(false);
    });

    it('should return false for empty content', () => {
      expect(hasCodeContent('')).toBe(false);
    });
  });
});

describe('calculateRelevance', () => {
  const qualitySignals = {
    'best practice': 10,
    'tutorial': 8,
    'example': 5,
    'deep dive': 10,
    'performance': 7,
  };

  it('should return base score for text without signals', () => {
    const score = calculateRelevance('Random text here', false, qualitySignals, 50);
    expect(score).toBe(50);
  });

  it('should add points for quality signals', () => {
    const score = calculateRelevance('This is a tutorial with examples', false, qualitySignals, 50);
    // base 50 + tutorial 8 + example 5 = 63
    expect(score).toBe(63);
  });

  it('should add code bonus when hasCode is true', () => {
    const withCode = calculateRelevance('Some text', true, qualitySignals, 50, 10);
    const withoutCode = calculateRelevance('Some text', false, qualitySignals, 50, 10);

    expect(withCode).toBe(withoutCode + 10);
  });

  it('should cap score at 100', () => {
    const highSignals = {
      'signal1': 30,
      'signal2': 30,
      'signal3': 30,
    };
    const score = calculateRelevance('signal1 signal2 signal3', true, highSignals, 50, 20);

    expect(score).toBe(100);
  });

  it('should be case insensitive', () => {
    const score = calculateRelevance('BEST PRACTICE and TUTORIAL', false, qualitySignals, 50);
    // base 50 + best practice 10 + tutorial 8 = 68
    expect(score).toBe(68);
  });

  it('should handle empty quality signals', () => {
    const score = calculateRelevance('Some text', true, {}, 50, 15);
    expect(score).toBe(65); // base 50 + code bonus 15
  });

  it('should respect custom base score', () => {
    const lowBase = calculateRelevance('text', false, {}, 30);
    const highBase = calculateRelevance('text', false, {}, 70);

    expect(lowBase).toBe(30);
    expect(highBase).toBe(70);
  });

  it('should respect custom code bonus', () => {
    const smallBonus = calculateRelevance('text', true, {}, 50, 5);
    const largeBonus = calculateRelevance('text', true, {}, 50, 20);

    expect(smallBonus).toBe(55);
    expect(largeBonus).toBe(70);
  });

  it('should accumulate multiple matching signals', () => {
    const text = 'A deep dive tutorial with best practice examples for performance';
    const score = calculateRelevance(text, false, qualitySignals, 50);
    // base 50 + deep dive 10 + tutorial 8 + best practice 10 + example 5 + performance 7 = 90
    expect(score).toBe(90);
  });
});

describe('extractCodeSnippets', () => {
  it('should extract markdown swift code blocks', () => {
    const content = 'Here is code:\n```swift\nfunc hello() {\n  print("Hi")\n}\n```\nSome text.';
    const snippets = extractCodeSnippets(content);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toContain('func hello()');
    expect(snippets[0]).toContain('print("Hi")');
  });

  it('should extract generic markdown code blocks', () => {
    const content = 'Example:\n```\nlet x = 1\nlet y = 2\n```';
    const snippets = extractCodeSnippets(content);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toContain('let x = 1');
  });

  it('should extract HTML code blocks', () => {
    const content = '<pre><code>func test() {\n  return 42\n}</code></pre>';
    const snippets = extractCodeSnippets(content);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toContain('func test()');
  });

  it('should decode HTML entities in code blocks', () => {
    const content = '<pre><code>let x = &lt;T&gt;()\nreturn x</code></pre>';
    const snippets = extractCodeSnippets(content);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toContain('let x = <T>()');
  });

  it('should respect maxSnippets limit', () => {
    const content = '```\ncode1\ncode1\n```\n```\ncode2\ncode2\n```\n```\ncode3\ncode3\n```';
    const snippets = extractCodeSnippets(content, 2);

    expect(snippets).toHaveLength(2);
  });

  it('should truncate long snippets to 10 lines', () => {
    const longCode = Array(15).fill('let x = 1').join('\n');
    const content = '```swift\n' + longCode + '\n```';
    const snippets = extractCodeSnippets(content);

    expect(snippets).toHaveLength(1);
    const lines = snippets[0].split('\n');
    expect(lines.length).toBeLessThanOrEqual(11); // 10 lines + "// ..."
    expect(snippets[0]).toContain('// ...');
  });

  it('should skip snippets with less than 2 lines', () => {
    const content = '```\nx\n```\n```\nlet a = 1\nlet b = 2\n```';
    const snippets = extractCodeSnippets(content);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toContain('let a = 1');
  });

  it('should return empty array when no code', () => {
    const content = 'Just plain text with no code blocks';
    const snippets = extractCodeSnippets(content);

    expect(snippets).toEqual([]);
  });

  it('should extract multiple snippets up to limit', () => {
    const content = '```\ncode1\ncode1\n```\ntext\n```\ncode2\ncode2\n```';
    const snippets = extractCodeSnippets(content, 5);

    expect(snippets).toHaveLength(2);
  });
});

describe('extractTechniques', () => {
  it('should detect Swift attributes', () => {
    const content = '@Observable class Model {} with @State var count';
    const techniques = extractTechniques(content);

    expect(techniques).toContain('@Observable');
    expect(techniques).toContain('@State');
  });

  it('should detect async/await patterns', () => {
    const content = 'async func fetch() { await task() }';
    const techniques = extractTechniques(content);

    expect(techniques).toContain('async/await');
  });

  it('should detect Task pattern', () => {
    const content = 'Task { await doWork() }';
    const techniques = extractTechniques(content);

    expect(techniques).toContain('Task');
  });

  it('should detect actor pattern', () => {
    const content = 'actor DataStore { var data: [String] }';
    const techniques = extractTechniques(content);

    expect(techniques).toContain('actor');
  });

  it('should detect Sendable protocol', () => {
    const content = 'struct MyData: Sendable { }';
    const techniques = extractTechniques(content);

    expect(techniques).toContain('Sendable');
  });

  it('should detect SwiftUI patterns', () => {
    const content = 'NavigationStack { List { Text("Item") } }';
    const techniques = extractTechniques(content);

    expect(techniques).toContain('NavigationStack');
    expect(techniques).toContain('List');
  });

  it('should detect SwiftData patterns', () => {
    const content = '@Model class Item {} with @Query var items';
    const techniques = extractTechniques(content);

    expect(techniques).toContain('@Model');
    expect(techniques).toContain('@Query');
  });

  it('should detect frameworks when imported', () => {
    const content = 'import SwiftUI\nimport Combine\nvar body: some View';
    const techniques = extractTechniques(content);

    expect(techniques).toContain('SwiftUI');
    expect(techniques).toContain('Combine');
  });

  it('should return unique techniques', () => {
    const content = '@State var a\n@State var b\n@State var c';
    const techniques = extractTechniques(content);

    expect(techniques.filter(t => t === '@State')).toHaveLength(1);
  });

  it('should cap at 5 techniques', () => {
    const content = '@State @Binding @Environment @Query @Model @Published @Observable Task actor';
    const techniques = extractTechniques(content);

    expect(techniques.length).toBeLessThanOrEqual(5);
  });

  it('should return empty array when no techniques found', () => {
    const content = 'Just plain text about programming';
    const techniques = extractTechniques(content);

    expect(techniques).toEqual([]);
  });
});

describe('detectComplexity', () => {
  it('should return beginner for introduction content', () => {
    const content = 'Introduction to Swift. Getting started with basic syntax. A simple example.';
    const complexity = detectComplexity(content, ['basics']);

    expect(complexity).toBe('beginner');
  });

  it('should return beginner for short simple content', () => {
    const content = 'let x = 1\nprint(x)';
    const complexity = detectComplexity(content, ['syntax']);

    expect(complexity).toBe('beginner');
  });

  it('should return advanced for performance content', () => {
    const content = 'Performance optimization techniques for Swift. Benchmarking and profiling.';
    const complexity = detectComplexity(content, ['performance']);

    expect(complexity).toBe('advanced');
  });

  it('should return advanced for macro content', () => {
    const content = 'Creating custom Swift macros with @attached and @freestanding';
    const complexity = detectComplexity(content, ['macros']);

    expect(complexity).toBe('advanced');
  });

  it('should return advanced for unsafe/pointer content', () => {
    const content = 'Using unsafe pointers and manual memory management in Swift';
    const complexity = detectComplexity(content, ['memory']);

    expect(complexity).toBe('advanced');
  });

  it('should return intermediate for most content', () => {
    const content = 'Building a networking layer with async/await and error handling. Multiple patterns combined.';
    const complexity = detectComplexity(content, ['networking', 'concurrency']);

    expect(complexity).toBe('intermediate');
  });

  it('should return advanced for multiple topics and code blocks', () => {
    const content = 'Complex content\n```\ncode\n```\n```\nmore\n```\n```\neven more\n```';
    const complexity = detectComplexity(content, ['topic1', 'topic2', 'topic3', 'topic4']);

    expect(complexity).toBe('advanced');
  });

  it('should use intermediate as default for moderate content', () => {
    const content = 'Regular article about Swift development with moderate depth. ' +
      'This article covers multiple aspects of building applications, ' +
      'including architecture patterns, testing strategies, and deployment. ' +
      'It provides practical examples and real-world scenarios for developers. ' +
      'The content is aimed at developers with some experience.';
    const complexity = detectComplexity(content, ['development', 'architecture']);

    expect(complexity).toBe('intermediate');
  });
});

describe('truncateAtSentence', () => {
  it('should truncate at period', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const result = truncateAtSentence(text, 20);

    expect(result).toBe('First sentence.');
  });

  it('should truncate at question mark', () => {
    const text = 'What is this? Another question? Final one.';
    const result = truncateAtSentence(text, 20);

    expect(result).toBe('What is this?');
  });

  it('should truncate at exclamation mark', () => {
    const text = 'Wow! Amazing! Incredible stuff here!';
    const result = truncateAtSentence(text, 15);

    // Should find last complete sentence within maxLength
    expect(result).toBe('Wow! Amazing!');
    expect(result.length).toBeLessThanOrEqual(15);
  });

  it('should return full text if shorter than maxLength', () => {
    const text = 'Short text.';
    const result = truncateAtSentence(text, 50);

    expect(result).toBe('Short text.');
  });

  it('should fall back to word boundary if no sentence end', () => {
    const text = 'This is a long phrase without any sentence endings at all';
    const result = truncateAtSentence(text, 30);

    expect(result).not.toContain('endings');
    expect(result.split(' ').every(word => word.length > 0)).toBe(true);
  });

  it('should never cut mid-word', () => {
    const text = 'Word1 Word2 Word3 Word4 Word5';
    const result = truncateAtSentence(text, 18);

    // Should be a complete phrase with full words
    expect(result.split(' ').every(word => word.length > 0)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(18);
  });

  it('should find sentence boundary within 80% threshold', () => {
    const text = 'A '.repeat(50) + 'sentence. ' + 'B '.repeat(50);
    const result = truncateAtSentence(text, 120);

    expect(result).toContain('sentence.');
  });
});

describe('extractDescriptiveTitle', () => {
  it('should extract markdown H1', () => {
    const content = '# Building Modern Apps\n\nContent here...';
    const title = extractDescriptiveTitle(content, 'Fallback');

    expect(title).toBe('Building Modern Apps');
  });

  it('should extract HTML H1', () => {
    const content = '<h1>Swift Concurrency Guide</h1><p>Content</p>';
    const title = extractDescriptiveTitle(content, 'Fallback');

    expect(title).toBe('Swift Concurrency Guide');
  });

  it('should try H2 if H1 is generic', () => {
    const content = '# Newsletter #109\n\n## Understanding Async/Await\n\nContent...';
    const title = extractDescriptiveTitle(content, 'Fallback');

    expect(title).toBe('Understanding Async/Await');
  });

  it('should clean HTML tags from title', () => {
    const content = '<h1>Title with <strong>bold</strong> text</h1>';
    const title = extractDescriptiveTitle(content, 'Fallback');

    expect(title).toBe('Title with bold text');
  });

  it('should decode HTML entities', () => {
    const content = '<h1>Swift &amp; SwiftUI</h1>';
    const title = extractDescriptiveTitle(content, 'Fallback');

    expect(title).toBe('Swift & SwiftUI');
  });

  it('should return fallback if no heading found', () => {
    const content = 'Just plain text without headings';
    const title = extractDescriptiveTitle(content, 'Default Title');

    expect(title).toBe('Default Title');
  });

  it('should skip generic newsletter titles', () => {
    const content = '# Newsletter #42\n\n## Real Content Title\n\nText...';
    const title = extractDescriptiveTitle(content, 'Fallback');

    expect(title).toBe('Real Content Title');
  });

  it('should skip generic issue titles', () => {
    const content = '# Issue 123\n\n## Actual Topic\n\nContent...';
    const title = extractDescriptiveTitle(content, 'Fallback');

    expect(title).toBe('Actual Topic');
  });

  it('should normalize whitespace', () => {
    const content = '#   Multiple   Spaces   Here  ';
    const title = extractDescriptiveTitle(content, 'Fallback');

    expect(title).toBe('Multiple Spaces Here');
  });

  it('should handle HTML H2 as fallback', () => {
    const content = '<h1>Blog</h1><h2>Specific Article Title</h2>';
    const title = extractDescriptiveTitle(content, 'Fallback');

    expect(title).toBe('Specific Article Title');
  });
});
