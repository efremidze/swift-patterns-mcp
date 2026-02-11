import http from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());
const mockExecFile = vi.hoisted(() => vi.fn());
const mockKeytar = vi.hoisted(() => ({
  setPassword: vi.fn(),
  getPassword: vi.fn(),
  deletePassword: vi.fn(),
}));

vi.mock('../../../utils/fetch.js', () => ({
  fetch: mockFetch,
}));

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}));

vi.mock('keytar', () => ({
  default: mockKeytar,
}));

import {
  isTokenExpired,
  refreshAccessToken,
  startOAuthFlow,
  type OAuthResult,
  type PatreonTokens,
} from '../patreon-oauth.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpRequest(pathname: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 9876,
        path: pathname,
        method: 'GET',
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode ?? 0, body });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function requestWithRetry(pathname: string): Promise<{ statusCode: number; body: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      return await httpRequest(pathname);
    } catch (error) {
      lastError = error;
      await sleep(10);
    }
  }

  throw lastError;
}

describe('patreon-oauth', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();

    mockExecFile.mockImplementation((_: string, __: string[], callback: ((err: Error | null) => void) | undefined) => {
      callback?.(null);
      return {} as never;
    });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        scope: 'identity',
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exchanges callback code for tokens and stores them', async () => {
    const flowPromise = startOAuthFlow('client-id', 'client-secret');

    const callbackResponse = await requestWithRetry('/callback?code=test-code');
    const result = await flowPromise;

    expect(callbackResponse.statusCode).toBe(200);
    expect(result.success).toBe(true);
    expect(result.tokens).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockKeytar.setPassword).toHaveBeenCalledTimes(1);
    expect(mockExecFile).toHaveBeenCalledWith(
      'open',
      [expect.stringContaining('client_id=client-id')],
      expect.any(Function)
    );
  });

  it('returns an error result when provider sends error query param', async () => {
    const flowPromise = startOAuthFlow('client-id', 'client-secret');

    const callbackResponse = await requestWithRetry('/callback?error=access_denied');
    const result = await flowPromise;

    expect(callbackResponse.statusCode).toBe(200);
    expect(result).toEqual({ success: false, error: 'access_denied' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps flow pending after missing code response and resolves on valid callback', async () => {
    const flowPromise = startOAuthFlow('client-id', 'client-secret');

    const missingCodeResponse = await requestWithRetry('/callback');
    expect(missingCodeResponse.statusCode).toBe(400);
    expect(missingCodeResponse.body).toContain('No authorization code received');

    const successResponse = await requestWithRetry('/callback?code=retry-code');
    const result = await flowPromise;

    expect(successResponse.statusCode).toBe(200);
    expect(result.success).toBe(true);
  });

  it('returns failure when token exchange response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    const flowPromise = startOAuthFlow('client-id', 'client-secret');
    const callbackResponse = await requestWithRetry('/callback?code=bad-code');
    const result = await flowPromise;

    expect(callbackResponse.statusCode).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Token exchange failed: 401');
  });

  it('refreshes access token successfully and persists new tokens', async () => {
    const refreshed = await refreshAccessToken('client-id', 'client-secret', 'refresh-token');

    expect(refreshed.access_token).toBe('access-token');
    expect(refreshed.refresh_token).toBe('refresh-token');
    expect(refreshed.scope).toBe('identity');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.patreon.com/api/oauth2/token',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockKeytar.setPassword).toHaveBeenCalledTimes(1);
  });

  it('throws on refresh failure responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(refreshAccessToken('client-id', 'client-secret', 'refresh-token')).rejects.toThrow(
      'Token refresh failed: 500'
    );
  });

  it('checks token expiry boundary with 5 minute refresh window', () => {
    const now = Date.now();
    const safelyValid: PatreonTokens = {
      access_token: 'a',
      refresh_token: 'r',
      expires_at: now + 6 * 60 * 1000,
      scope: 'identity',
    };
    const nearExpiry: PatreonTokens = {
      access_token: 'a',
      refresh_token: 'r',
      expires_at: now + 4 * 60 * 1000 + 59 * 1000,
      scope: 'identity',
    };

    expect(isTokenExpired(safelyValid)).toBe(false);
    expect(isTokenExpired(nearExpiry)).toBe(true);
  });

  it('times out if no callback arrives in 60 seconds', async () => {
    vi.useFakeTimers();

    const flowPromise: Promise<OAuthResult> = startOAuthFlow('client-id', 'client-secret');
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(flowPromise).resolves.toEqual({
      success: false,
      error: 'Authorization timed out after 60 seconds',
    });
  });
});
