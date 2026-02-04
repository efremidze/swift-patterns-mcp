// src/utils/__tests__/http.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTextConditional, fetchText, fetchJson, buildHeaders } from '../http.js';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('../fetch.js', () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

function createResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  const headerMap = new Map(Object.entries(headers));
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    },
  };
}

describe('buildHeaders', () => {
  it('should include User-Agent', () => {
    const headers = buildHeaders('test-agent/1.0');
    expect(headers['User-Agent']).toBe('test-agent/1.0');
  });

  it('should include Authorization when token provided', () => {
    const headers = buildHeaders('test-agent/1.0', 'my-token');
    expect(headers.Authorization).toBe('Bearer my-token');
  });

  it('should not include Authorization when no token', () => {
    const headers = buildHeaders('test-agent/1.0');
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('fetchText', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return text content', async () => {
    mockFetch.mockResolvedValue(createResponse('hello world'));
    const result = await fetchText('https://example.com');
    expect(result).toBe('hello world');
  });

  it('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValue(createResponse('', 500));
    await expect(fetchText('https://example.com')).rejects.toThrow('HTTP 500');
  });
});

describe('fetchJson', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return parsed JSON', async () => {
    mockFetch.mockResolvedValue(createResponse('{"key":"value"}'));
    const result = await fetchJson<{ key: string }>('https://example.com');
    expect(result).toEqual({ key: 'value' });
  });
});

describe('fetchTextConditional', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return data and httpMeta on 200', async () => {
    mockFetch.mockResolvedValue(
      createResponse('<rss>feed</rss>', 200, {
        'etag': '"abc123"',
        'last-modified': 'Mon, 01 Jan 2024 00:00:00 GMT',
      })
    );

    const result = await fetchTextConditional('https://example.com/feed');

    expect(result.notModified).toBe(false);
    expect(result.data).toBe('<rss>feed</rss>');
    expect(result.httpMeta).toEqual({
      etag: '"abc123"',
      lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT',
    });
  });

  it('should return notModified on 304', async () => {
    mockFetch.mockResolvedValue(createResponse('', 304));

    const cachedMeta = { etag: '"abc123"' };
    const result = await fetchTextConditional(
      'https://example.com/feed',
      {},
      cachedMeta
    );

    expect(result.notModified).toBe(true);
    expect(result.data).toBeNull();
    expect(result.httpMeta).toEqual(cachedMeta);
  });

  it('should send If-None-Match header when etag is provided', async () => {
    mockFetch.mockResolvedValue(createResponse('data', 200));

    await fetchTextConditional(
      'https://example.com/feed',
      {},
      { etag: '"v1"' }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['If-None-Match']).toBe('"v1"');
  });

  it('should send If-Modified-Since header when lastModified is provided', async () => {
    mockFetch.mockResolvedValue(createResponse('data', 200));

    await fetchTextConditional(
      'https://example.com/feed',
      {},
      { lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT' }
    );

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['If-Modified-Since']).toBe('Mon, 01 Jan 2024 00:00:00 GMT');
  });

  it('should send both conditional headers when both are provided', async () => {
    mockFetch.mockResolvedValue(createResponse('data', 200));

    await fetchTextConditional(
      'https://example.com/feed',
      {},
      { etag: '"v2"', lastModified: 'Tue, 02 Jan 2024 00:00:00 GMT' }
    );

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['If-None-Match']).toBe('"v2"');
    expect(callArgs[1].headers['If-Modified-Since']).toBe('Tue, 02 Jan 2024 00:00:00 GMT');
  });

  it('should not send conditional headers when no metadata provided', async () => {
    mockFetch.mockResolvedValue(createResponse('data', 200));

    await fetchTextConditional('https://example.com/feed');

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['If-None-Match']).toBeUndefined();
    expect(callArgs[1].headers['If-Modified-Since']).toBeUndefined();
  });

  it('should merge existing headers with conditional headers', async () => {
    mockFetch.mockResolvedValue(createResponse('data', 200));

    await fetchTextConditional(
      'https://example.com/feed',
      { headers: { 'User-Agent': 'test/1.0' } },
      { etag: '"v1"' }
    );

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['User-Agent']).toBe('test/1.0');
    expect(callArgs[1].headers['If-None-Match']).toBe('"v1"');
  });

  it('should return empty httpMeta when response has no caching headers', async () => {
    mockFetch.mockResolvedValue(createResponse('data', 200));

    const result = await fetchTextConditional('https://example.com/feed');

    expect(result.httpMeta).toEqual({});
    expect(result.notModified).toBe(false);
    expect(result.data).toBe('data');
  });

  it('should throw on non-ok, non-304 response', async () => {
    mockFetch.mockResolvedValue(createResponse('', 500));

    await expect(
      fetchTextConditional('https://example.com/feed')
    ).rejects.toThrow('HTTP 500');
  });
});
