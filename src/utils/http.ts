/**
 * Shared HTTP utilities for making requests with timeouts and error handling
 */

export interface FetchOptions {
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Build headers with optional authorization token
 */
export function buildHeaders(userAgent: string, authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * Fetch with timeout and error handling
 */
async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, headers = {}, signal } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: signal || controller.signal,
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch JSON data with timeout
 */
export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, options);
  return await response.json() as T;
}

/**
 * Fetch text content with timeout
 */
export async function fetchText(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  const response = await fetchWithTimeout(url, options);
  return await response.text();
}
