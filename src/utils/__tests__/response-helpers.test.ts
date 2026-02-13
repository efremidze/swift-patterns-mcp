// src/utils/__tests__/response-helpers.test.ts

import { describe, it, expect } from 'vitest';
import {
  createMarkdownResponse,
  createTextResponse,
  createErrorResponse,
  createErrorResponseFromError,
} from '../response-helpers.js';

describe('response-helpers', () => {
  describe('createTextResponse', () => {
    it('returns text response shape without error flag', () => {
      expect(createTextResponse('hello')).toEqual({
        content: [{ type: 'text', text: 'hello' }],
      });
    });
  });

  describe('createMarkdownResponse', () => {
    it('should format title-only markdown response', () => {
      const result = createMarkdownResponse('Search Results');
      expect(result.content[0].text).toBe('# Search Results');
    });

    it('should join non-empty sections with blank lines', () => {
      const result = createMarkdownResponse('Search Results', 'No results found', '', undefined, 'Try again');
      expect(result.content[0].text).toBe('# Search Results\n\nNo results found\n\nTry again');
    });
  });

  describe('createErrorResponse', () => {
    it('returns MCP error response with prefix', () => {
      expect(createErrorResponse('not found')).toEqual({
        content: [{ type: 'text', text: 'Error: not found' }],
        isError: true,
      });
    });
  });

  describe('createErrorResponseFromError', () => {
    it.each([
      [new Error('oops'), 'oops'],
      ['string error', 'string error'],
      [42, '42'],
    ])('handles %p', (input, expectedPart) => {
      const result = createErrorResponseFromError(input);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(expectedPart);
    });
  });
});
