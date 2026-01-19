// src/tools/registry.test.ts

import { describe, it, expect, beforeEach } from 'vitest';

// We need to test the registry in isolation, so we'll create a fresh module
// Since the registry uses module-level state, we test the exported functions

describe('Tool Registry', () => {
  // Import fresh for each test to avoid state pollution
  // In practice, the registry is populated at startup

  it('should register and retrieve handlers', async () => {
    const { registerHandler, getHandler } = await import('./registry.js');

    const mockHandler = async () => ({ content: [{ type: 'text', text: 'test' }] });
    registerHandler('test_tool', mockHandler);

    const retrieved = getHandler('test_tool');
    expect(retrieved).toBe(mockHandler);
  });

  it('should return undefined for unregistered handlers', async () => {
    const { getHandler } = await import('./registry.js');

    const result = getHandler('nonexistent_tool_12345');
    expect(result).toBeUndefined();
  });

  it('should correctly report handler existence', async () => {
    const { registerHandler, hasHandler } = await import('./registry.js');

    const mockHandler = async () => ({ content: [{ type: 'text', text: 'test' }] });
    registerHandler('exists_tool', mockHandler);

    expect(hasHandler('exists_tool')).toBe(true);
    expect(hasHandler('does_not_exist_12345')).toBe(false);
  });

  it('should allow overwriting handlers', async () => {
    const { registerHandler, getHandler } = await import('./registry.js');

    const handler1 = async () => ({ content: [{ type: 'text', text: 'first' }] });
    const handler2 = async () => ({ content: [{ type: 'text', text: 'second' }] });

    registerHandler('overwrite_test', handler1);
    registerHandler('overwrite_test', handler2);

    const retrieved = getHandler('overwrite_test');
    expect(retrieved).toBe(handler2);
  });
});

describe('Tool Registration Integration', () => {
  it('should have core tools registered after import', async () => {
    // Importing index.js registers all handlers
    await import('./index.js');
    const { hasHandler } = await import('./registry.js');

    expect(hasHandler('get_swift_pattern')).toBe(true);
    expect(hasHandler('search_swift_content')).toBe(true);
    expect(hasHandler('list_content_sources')).toBe(true);
    expect(hasHandler('enable_source')).toBe(true);
  });

  it('should return valid handler functions', async () => {
    await import('./index.js');
    const { getHandler } = await import('./registry.js');

    const handler = getHandler('get_swift_pattern');
    expect(typeof handler).toBe('function');
  });
});
