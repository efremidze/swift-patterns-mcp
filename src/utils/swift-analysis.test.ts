// src/utils/swift-analysis.test.ts

import { describe, it, expect } from 'vitest';
import { detectTopics, hasCodeContent, calculateRelevance } from './swift-analysis.js';

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
