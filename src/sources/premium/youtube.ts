// src/sources/premium/youtube.ts
// YouTube Data API client

import { logError } from '../../utils/errors.js';
import { fetch } from '../../utils/fetch.js';
import { FileCache } from '../../utils/cache.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const youtubeCache = new FileCache('youtube', 50);
const YOUTUBE_CACHE_TTL = 3600; // 1 hour
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

export interface YouTubeResult<T> {
  data: T;
  error: string | null;
}

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

export interface Video {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  tags?: string[];
  patreonLink?: string;
  codeLinks?: string[];
}

type YouTubeSnippet = {
  title?: string;
  description?: string;
  publishedAt?: string;
  channelId?: string;
  channelTitle?: string;
  tags?: string[];
};

function extractPatreonLink(text: string): string | undefined {
  const match = text.match(/https?:\/\/(www\.)?patreon\.com\/[^\s)]+/i);
  return match?.[0];
}

function extractCodeLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/(github\.com|gist\.github\.com)[^\s)]+/gi);
  return matches || [];
}

function toVideo(id: string, snippet: YouTubeSnippet = {}): Video {
  const safeSnippet = {
    title: '',
    description: '',
    publishedAt: '',
    channelId: '',
    channelTitle: '',
    ...snippet,
  };

  return {
    id,
    title: safeSnippet.title ?? '',
    description: safeSnippet.description ?? '',
    publishedAt: safeSnippet.publishedAt ?? '',
    channelId: safeSnippet.channelId ?? '',
    channelTitle: safeSnippet.channelTitle ?? '',
    tags: safeSnippet.tags,
    patreonLink: extractPatreonLink(safeSnippet.description ?? ''),
    codeLinks: extractCodeLinks(safeSnippet.description ?? ''),
  };
}

function mapSearchItems(items: Array<{
  id?: { videoId?: string };
  snippet?: YouTubeSnippet;
}>): Video[] {
  return items.flatMap(item => {
    const videoId = item.id?.videoId;
    if (!videoId) {
      return [];
    }
    return [toVideo(videoId, item.snippet)];
  });
}

function mapVideoItems(items: Array<{
  id?: string;
  snippet?: YouTubeSnippet;
}>): Video[] {
  return items.flatMap(item => {
    if (!item.id) {
      return [];
    }
    return [toVideo(item.id, item.snippet)];
  });
}

function extractVideoIds(items: Array<{ id?: { videoId?: string } }>): string {
  return items
    .map(i => i.id?.videoId)
    .filter((id): id is string => Boolean(id))
    .join(',');
}

async function fetchFullVideoItems(
  apiKey: string,
  videoIds: string
): Promise<Array<{ id?: string; snippet?: YouTubeSnippet }> | null> {
  const videosUrl = `${API_BASE}/videos?key=${apiKey}&id=${videoIds}&part=snippet`;
  const videosRes = await fetchWithTimeout(videosUrl);

  if (!videosRes.ok) {
    return null;
  }

  const videosData = await videosRes.json() as {
    items: Array<{
      id?: string;
      snippet?: YouTubeSnippet;
    }>;
  };
  return videosData.items;
}

async function hydrateSearchItems(
  apiKey: string,
  searchItems: Array<{
    id?: { videoId?: string };
    snippet?: YouTubeSnippet;
  }>
): Promise<Video[]> {
  const videoIds = extractVideoIds(searchItems);
  if (!videoIds) return [];

  const fullItems = await fetchFullVideoItems(apiKey, videoIds);
  if (!fullItems) {
    return mapSearchItems(searchItems);
  }

  return mapVideoItems(fullItems);
}

export async function getChannelVideos(
  channelId: string,
  maxResults = 50
): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return [];
  }

  const cacheKey = `channel-${channelId}-${maxResults}`;
  return youtubeCache.getOrFetch(cacheKey, async () => {
    return _fetchChannelVideos(apiKey, channelId, maxResults);
  }, YOUTUBE_CACHE_TTL);
}

async function _fetchChannelVideos(apiKey: string, channelId: string, maxResults: number): Promise<Video[]> {
  try {
    const searchUrl = `${API_BASE}/search?key=${apiKey}&channelId=${channelId}&part=snippet&type=video&order=date&maxResults=${maxResults}`;
    const searchRes = await fetchWithTimeout(searchUrl);

    if (!searchRes.ok) {
      logError('YouTube', `Search failed: ${searchRes.status}`, { channelId });
      return [];
    }

    const searchData = await searchRes.json() as {
      items: Array<{
        id?: { videoId?: string };
        snippet?: YouTubeSnippet;
      }>;
    };
    // Get full video details (includes tags and complete description), fallback to search snippets.
    return await hydrateSearchItems(apiKey, searchData.items);
  } catch (error) {
    logError('YouTube', error, { channelId });
    return [];
  }
}

export async function searchVideos(
  query: string,
  channelId?: string,
  maxResults = 25
): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return [];
  }

  const cacheKey = `search-${channelId || 'all'}-${query}-${maxResults}`;
  return youtubeCache.getOrFetch(cacheKey, async () => {
    return _fetchSearchVideos(apiKey, query, channelId, maxResults);
  }, YOUTUBE_CACHE_TTL);
}

async function _fetchSearchVideos(apiKey: string, query: string, channelId: string | undefined, maxResults: number): Promise<Video[]> {
  try {
    let url = `${API_BASE}/search?key=${apiKey}&q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=${maxResults}`;
    if (channelId) {
      url += `&channelId=${channelId}`;
    }

    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return [];
    }

    const searchData = await res.json() as {
      items: Array<{
        id?: { videoId?: string };
        snippet?: YouTubeSnippet;
      }>;
    };
    // Fetch full details; fallback to search snippets when videos API misses/fails.
    return await hydrateSearchItems(apiKey, searchData.items);
  } catch (error) {
    logError('YouTube', error, { query, channelId });
    return [];
  }
}
