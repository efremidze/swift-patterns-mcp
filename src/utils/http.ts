/**
 * Shared HTTP utilities for making requests with timeouts and error handling
 */

import { fetch } from './fetch.js';
import type { HttpCacheMetadata } from './cache.js';

export interface FetchOptions {
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ConditionalFetchResult {
  data: string | null;
  httpMeta: HttpCacheMetadata;
  notModified: boolean;
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
 * Fetch with timeout, returning the raw Response without throwing on 304
 */
async function fetchWithTimeoutRaw(
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

    if (!response.ok && response.status !== 304) {
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

/**
 * Fetch text with conditional request support (ETag/Last-Modified).
 * Sends If-None-Match / If-Modified-Since when cachedMeta is provided.
 * Returns { notModified: true } on 304, or new data + metadata on 200.
 */
export async function fetchTextConditional(
  url: string,
  options: FetchOptions = {},
  cachedMeta?: HttpCacheMetadata
): Promise<ConditionalFetchResult> {
  const conditionalHeaders: Record<string, string> = { ...options.headers };

  if (cachedMeta?.etag) {
    conditionalHeaders['If-None-Match'] = cachedMeta.etag;
  }
  if (cachedMeta?.lastModified) {
    conditionalHeaders['If-Modified-Since'] = cachedMeta.lastModified;
  }

  const response = await fetchWithTimeoutRaw(url, {
    ...options,
    headers: conditionalHeaders,
  });

  if (response.status === 304) {
    return { data: null, httpMeta: cachedMeta || {}, notModified: true };
  }

  const data = await response.text();
  const httpMeta: HttpCacheMetadata = {};
  const etag = response.headers.get('etag');
  const lastModified = response.headers.get('last-modified');
  if (etag) httpMeta.etag = etag;
  if (lastModified) httpMeta.lastModified = lastModified;

  return { data, httpMeta, notModified: false };
}
