// src/sources/premium/youtube.ts
// YouTube Data API client

const API_BASE = 'https://www.googleapis.com/youtube/v3';

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
  const match = text.match(/https?:\/\/(www\.)?patreon\.com\/[^\s\)]+/i);
  return match?.[0];
}

function extractCodeLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/(github\.com|gist\.github\.com)[^\s\)]+/gi);
  return matches || [];
}

export async function getChannelVideos(
  channelId: string,
  maxResults = 50
): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY not set');
    return [];
  }

  try {
    // Search for videos
    const searchUrl = `${API_BASE}/search?key=${apiKey}&channelId=${channelId}&part=snippet&type=video&order=date&maxResults=${maxResults}`;
    const searchRes = await fetch(searchUrl);

    if (!searchRes.ok) {
      console.error(`YouTube search failed: ${searchRes.status}`);
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
    const videosRes = await fetch(videosUrl);

    if (!videosRes.ok) {
      // Fallback to search results
      return searchData.items.map(i => ({
        id: i.id.videoId,
        title: i.snippet.title,
        description: i.snippet.description,
        publishedAt: i.snippet.publishedAt,
        channelId: i.snippet.channelId,
        channelTitle: i.snippet.channelTitle,
        patreonLink: extractPatreonLink(i.snippet.description),
        codeLinks: extractCodeLinks(i.snippet.description),
      }));
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

    return videosData.items.map(i => ({
      id: i.id,
      title: i.snippet.title,
      description: i.snippet.description,
      publishedAt: i.snippet.publishedAt,
      channelId: i.snippet.channelId,
      channelTitle: i.snippet.channelTitle,
      tags: i.snippet.tags,
      patreonLink: extractPatreonLink(i.snippet.description),
      codeLinks: extractCodeLinks(i.snippet.description),
    }));
  } catch (err) {
    console.error('YouTube API error:', err);
    return [];
  }
}

export async function searchVideos(
  query: string,
  channelId?: string,
  maxResults = 25
): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  try {
    let url = `${API_BASE}/search?key=${apiKey}&q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=${maxResults}`;
    if (channelId) {
      url += `&channelId=${channelId}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json() as {
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

    return data.items.map(i => ({
      id: i.id.videoId,
      title: i.snippet.title,
      description: i.snippet.description,
      publishedAt: i.snippet.publishedAt,
      channelId: i.snippet.channelId,
      channelTitle: i.snippet.channelTitle,
      patreonLink: extractPatreonLink(i.snippet.description),
      codeLinks: extractCodeLinks(i.snippet.description),
    }));
  } catch {
    return [];
  }
}
