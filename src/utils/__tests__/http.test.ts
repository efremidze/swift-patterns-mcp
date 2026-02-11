import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildHeaders, fetchJson, fetchText } from '../http.js';
import { fetch } from '../fetch.js';

vi.mock('../fetch.js', () => ({
  fetch: vi.fn(),
}));

const fetchMock = vi.mocked(fetch);

describe('http utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('buildHeaders', () => {
    it('adds user agent header always', () => {
      expect(buildHeaders('swift-patterns-test')).toEqual({
        'User-Agent': 'swift-patterns-test',
      });
    });

    it('adds bearer authorization when token is provided', () => {
      expect(buildHeaders('swift-patterns-test', 'abc123')).toEqual({
        'User-Agent': 'swift-patterns-test',
        Authorization: 'Bearer abc123',
      });
    });

    it('does not add auth header when token is empty string', () => {
      expect(buildHeaders('swift-patterns-test', '')).toEqual({
        'User-Agent': 'swift-patterns-test',
      });
    });
  });

  describe('fetchJson', () => {
    it('returns decoded json for successful responses', async () => {
      const payload = { ok: true, items: [1, 2, 3] };
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(payload),
      } as unknown as Response);

      await expect(fetchJson<typeof payload>('https://example.com/data')).resolves.toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/data',
        expect.objectContaining({
          headers: {},
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('forwards caller headers to fetch', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      } as unknown as Response);

      await fetchJson('https://example.com/headers', {
        headers: { Authorization: 'Bearer token', Accept: 'application/json' },
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/headers',
        expect.objectContaining({
          headers: { Authorization: 'Bearer token', Accept: 'application/json' },
        }),
      );
    });

    it('throws non-ok status as HTTP error', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);

      await expect(fetchJson('https://example.com/down')).rejects.toThrow('HTTP 503');
    });

    it('uses provided abort signal when caller passes one', async () => {
      const controller = new AbortController();
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      } as unknown as Response);

      await fetchJson('https://example.com/signal', { signal: controller.signal });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/signal',
        expect.objectContaining({ signal: controller.signal }),
      );
    });

    it('aborts request when timeout expires', async () => {
      fetchMock.mockImplementation(
        (_url: Parameters<typeof fetch>[0], init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new Error('aborted'));
            });
          }),
      );

      const request = fetchJson('https://example.com/slow', { timeout: 25 });
      const assertion = expect(request).rejects.toThrow('aborted');
      await vi.advanceTimersByTimeAsync(25);

      await assertion;
    });
  });

  describe('fetchText', () => {
    it('returns text body for successful responses', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('hello world'),
      } as unknown as Response);

      await expect(fetchText('https://example.com/text')).resolves.toBe('hello world');
    });

    it('throws non-ok status errors', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 } as Response);

      await expect(fetchText('https://example.com/missing')).rejects.toThrow('HTTP 404');
    });

    it('clears timeout once request resolves', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      fetchMock.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('ok'),
      } as unknown as Response);

      await fetchText('https://example.com/fast', { timeout: 1000 });

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
      clearTimeoutSpy.mockRestore();
    });
  });
});
