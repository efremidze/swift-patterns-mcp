// src/utils/__tests__/response-helpers.test.ts

import { describe, it, expect } from 'vitest';
import {
  createTextResponse,
  createErrorResponse,
  createErrorResponseFromError,
} from '../response-helpers.js';

describe('response-helpers', () => {
  describe('createTextResponse', () => {
    it('should return MCP-compliant text content', () => {
      const result = createTextResponse('hello');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('hello');
    });

    it('should not set isError', () => {
      const result = createTextResponse('hello');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('createErrorResponse', () => {
    it('should set isError to true', () => {
      const result = createErrorResponse('something went wrong');
      expect(result.isError).toBe(true);
    });

    it('should prefix message with "Error: "', () => {
      const result = createErrorResponse('not found');
      expect(result.content[0].text).toBe('Error: not found');
    });

    it('should return MCP-compliant content structure', () => {
      const result = createErrorResponse('fail');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('createErrorResponseFromError', () => {
    it('should handle Error objects', () => {
      const result = createErrorResponseFromError(new Error('oops'));
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('oops');
    });

    it('should handle string errors', () => {
      const result = createErrorResponseFromError('string error');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('string error');
    });

    it('should handle unknown error types', () => {
      const result = createErrorResponseFromError(42);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBeDefined();
    });
  });
});
