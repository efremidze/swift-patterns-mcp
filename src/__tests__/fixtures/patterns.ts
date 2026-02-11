import type { PatreonPattern } from '../../tools/types.js';

export const FREE_SOURCE_PATTERNS = {
  sundell: [
    {
      id: 'sundell-1',
      title: 'Advanced SwiftUI Patterns',
      url: 'https://swiftbysundell.com/swiftui',
      excerpt: 'Learn advanced SwiftUI patterns for production apps',
      content: 'Full content about SwiftUI state management and views',
      topics: ['swiftui', 'architecture'],
      relevanceScore: 85,
      hasCode: true,
      publishDate: '2024-01-15T00:00:00Z',
    },
    {
      id: 'sundell-2',
      title: 'Basic Swift Tips',
      url: 'https://swiftbysundell.com/tips',
      excerpt: 'Simple tips for Swift developers',
      content: 'Basic content without code examples',
      topics: ['swift'],
      relevanceScore: 55,
      hasCode: false,
      publishDate: '2024-01-10T00:00:00Z',
    },
  ],
  vanderlee: [
    {
      id: 'vanderlee-1',
      title: 'iOS Performance Optimization',
      url: 'https://avanderlee.com/performance',
      excerpt: 'Optimize your iOS app performance',
      content: 'Detailed performance optimization techniques',
      topics: ['performance', 'optimization'],
      relevanceScore: 78,
      hasCode: true,
      publishDate: '2024-01-12T00:00:00Z',
    },
    {
      id: 'vanderlee-2',
      title: 'Debugging Tips',
      url: 'https://avanderlee.com/debugging',
      excerpt: 'Debug your iOS apps effectively',
      content: 'Debugging techniques without code',
      topics: ['debugging'],
      relevanceScore: 65,
      hasCode: false,
      publishDate: '2024-01-08T00:00:00Z',
    },
  ],
  nilcoalescing: [
    {
      id: 'nilcoalescing-1',
      title: 'SwiftUI Navigation Deep Dive',
      url: 'https://nilcoalescing.com/navigation',
      excerpt: 'Master SwiftUI navigation patterns',
      content: 'Navigation code examples and patterns',
      topics: ['swiftui', 'navigation'],
      relevanceScore: 72,
      hasCode: true,
      publishDate: '2024-01-14T00:00:00Z',
    },
  ],
  pointfree: [
    {
      id: 'pointfree-1',
      title: 'Composable Architecture Case Study',
      url: 'https://github.com/pointfreeco/pointfreeco/blob/main/Sources/Models/Episodes/0001-functions.md',
      excerpt: 'Build apps with TCA',
      content: 'TCA reducer and store patterns',
      topics: ['architecture', 'tca'],
      relevanceScore: 90,
      hasCode: true,
      publishDate: '2024-01-16T00:00:00Z',
    },
  ],
} as const;

export function createPatreonPattern(overrides: Partial<PatreonPattern> = {}): PatreonPattern {
  return {
    id: 'pat-001',
    title: 'Test Pattern',
    url: 'https://patreon.com/posts/test-123',
    publishDate: '2024-06-15T00:00:00Z',
    excerpt: 'A test excerpt about SwiftUI',
    content: 'Full test content',
    creator: 'TestCreator',
    topics: ['swiftui'],
    relevanceScore: 80,
    hasCode: true,
    ...overrides,
  };
}

export const PATREON_PATTERNS_WITH_CODE = [
  createPatreonPattern({ id: 'pat-101', title: 'Pattern A', hasCode: true }),
  createPatreonPattern({ id: 'pat-102', title: 'Pattern B', hasCode: true }),
];

export const PATREON_PATTERNS_MIXED = [
  createPatreonPattern({ id: 'pat-201', title: 'With Code', hasCode: true }),
  createPatreonPattern({ id: 'pat-202', title: 'No Code', hasCode: false }),
];

export const PATREON_PATTERNS_TWELVE = Array.from({ length: 12 }, (_, index) =>
  createPatreonPattern({
    id: `pat-${String(index + 1).padStart(3, '0')}`,
    title: `Pattern ${index + 1}`,
    creator: `Creator ${index + 1}`,
  }),
);
