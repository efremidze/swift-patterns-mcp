import { vi } from 'vitest';
import type { ToolContext } from '../../tools/types.js';

const DEFAULT_SOURCES = [
  { id: 'sundell', name: 'Swift by Sundell', type: 'free', requiresAuth: false, isEnabled: true, isConfigured: true, description: 'Swift articles' },
  { id: 'vanderlee', name: 'Antoine van der Lee', type: 'free', requiresAuth: false, isEnabled: true, isConfigured: true, description: 'iOS tips' },
  { id: 'nilcoalescing', name: 'Nil Coalescing', type: 'free', requiresAuth: false, isEnabled: true, isConfigured: true, description: 'SwiftUI tips' },
  { id: 'pointfree', name: 'Point-Free', type: 'free', requiresAuth: false, isEnabled: true, isConfigured: true, description: 'Open source patterns' },
  { id: 'patreon', name: 'Patreon', type: 'premium', requiresAuth: true, isEnabled: false, isConfigured: false, description: 'Premium content' },
] as const;

export function createMockSourceManager() {
  const sources = DEFAULT_SOURCES.map((source) => ({ ...source }));

  return {
    getAllSources: vi.fn().mockReturnValue(sources),
    getSource: vi.fn((id: string) => sources.find((source) => source.id === id)),
    isSourceConfigured: vi.fn((id: string) => {
      const source = sources.find((item) => item.id === id);
      return source?.isConfigured ?? false;
    }),
    getSemanticRecallConfig: vi.fn().mockReturnValue({
      enabled: false,
      minLexicalScore: 0.35,
      minRelevanceScore: 70,
    }),
    getMemvidConfig: vi.fn().mockReturnValue({
      enabled: false,
      autoStore: false,
      useEmbeddings: false,
      embeddingModel: 'bge-small',
    }),
    enableSource: vi.fn(),
    disableSource: vi.fn(),
    getEnabledSources: vi.fn().mockReturnValue(sources.filter((source) => source.isEnabled)),
  };
}

export function createToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    sourceManager: createMockSourceManager() as unknown as ToolContext['sourceManager'],
    patreonSource: null,
    ...overrides,
  };
}
