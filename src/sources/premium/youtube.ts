// src/sources/premium/youtube.ts
// YouTube Data API client

import { logError, toErrorMessage } from '../../utils/errors.js';
import { fetch } from '../../utils/fetch.js';
import { FileCache } from '../../utils/cache.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const youtubeCache = new FileCache('youtube', 50);
const YOUTUBE_CACHE_TTL = 3600; // 1 hour
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

// Module-level error tracking for surfacing YouTube failures to handlers
interface YouTubeStatus {
  lastError: string | null;
  lastErrorTime: number | null;
}

const youtubeStatus: YouTubeStatus = { lastError: null, lastErrorTime: null };

function recordError(message: string): void {
  youtubeStatus.lastError = message;
  youtubeStatus.lastErrorTime = Date.now();
}

function clearError(): void {
  youtubeStatus.lastError = null;
  youtubeStatus.lastErrorTime = null;
}

/** Check if YouTube API has recently failed. Returns null fields if healthy. */
export function getYouTubeStatus(): Readonly<YouTubeStatus> {
  return { ...youtubeStatus };
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

function extractPatreonLink(text: string): string | undefined {
  const match = text.match(/https?:\/\/(www\.)?patreon\.com\/[^\s)]+/i);
  return match?.[0];
}

function extractCodeLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/(github\.com|gist\.github\.com)[^\s)]+/gi);
  return matches || [];
}

function toVideo(id: string, snippet: {
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  tags?: string[];
}): Video {
  return {
    id,
    title: snippet.title,
    description: snippet.description,
    publishedAt: snippet.publishedAt,
    channelId: snippet.channelId,
    channelTitle: snippet.channelTitle,
    tags: snippet.tags,
    patreonLink: extractPatreonLink(snippet.description),
    codeLinks: extractCodeLinks(snippet.description),
  };
}

function mapSearchItems(items: Array<{
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
  };
}>): Video[] {
  return items.map(item => toVideo(item.id.videoId, item.snippet));
}

function mapVideoItems(items: Array<{
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    tags?: string[];
  };
}>): Video[] {
  return items.map(item => toVideo(item.id, item.snippet));
}

export async function getChannelVideos(
  channelId: string,
  maxResults = 50
): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    recordError('YOUTUBE_API_KEY not set');
    return [];
  }

  const cacheKey = `channel-${channelId}-${maxResults}`;
  return youtubeCache.getOrFetch(cacheKey, async () => {
    return _fetchChannelVideos(apiKey, channelId, maxResults);
  }, YOUTUBE_CACHE_TTL);
}

async function _fetchChannelVideos(apiKey: string, channelId: string, maxResults: number): Promise<Video[]> {
  try {
    // Search for videos
    const searchUrl = `${API_BASE}/search?key=${apiKey}&channelId=${channelId}&part=snippet&type=video&order=date&maxResults=${maxResults}`;
    const searchRes = await fetchWithTimeout(searchUrl);

    if (!searchRes.ok) {
      recordError(`HTTP ${searchRes.status}`);
      logError('YouTube', `Search failed: ${searchRes.status}`, { channelId });
      return [];
    }

    const searchData = await searchRes.json() as {
      items: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          channelId: string;
          channelTitle: string;
        };
      }>;
    };

    const videoIds = searchData.items.map(i => i.id.videoId).join(',');
    if (!videoIds) return [];

    // Get full video details (includes tags)
    const videosUrl = `${API_BASE}/videos?key=${apiKey}&id=${videoIds}&part=snippet`;
    const videosRes = await fetchWithTimeout(videosUrl);

    if (!videosRes.ok) {
      // Fallback to search results
      return mapSearchItems(searchData.items);
    }

    const videosData = await videosRes.json() as {
      items: Array<{
        id: string;
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          channelId: string;
          channelTitle: string;
          tags?: string[];
        };
      }>;
    };

    clearError();
    return mapVideoItems(videosData.items);
  } catch (error) {
    recordError(toErrorMessage(error));
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
    recordError('YOUTUBE_API_KEY not set');
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
      recordError(`HTTP ${res.status}`);
      return [];
    }

    const searchData = await res.json() as {
      items: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          channelId: string;
          channelTitle: string;
        };
      }>;
    };

    const videoIds = searchData.items.map(i => i.id.videoId).join(',');
    if (!videoIds) return [];

    // Fetch full video details to get complete descriptions (search returns truncated)
    const videosUrl = `${API_BASE}/videos?key=${apiKey}&id=${videoIds}&part=snippet`;
    const videosRes = await fetchWithTimeout(videosUrl);

    if (!videosRes.ok) {
      // Fallback to search results (truncated descriptions)
      return mapSearchItems(searchData.items);
    }

    const videosData = await videosRes.json() as {
      items: Array<{
        id: string;
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          channelId: string;
          channelTitle: string;
          tags?: string[];
        };
      }>;
    };

    clearError();
    return mapVideoItems(videosData.items);
  } catch (error) {
    recordError(toErrorMessage(error));
    return [];
  }
}
