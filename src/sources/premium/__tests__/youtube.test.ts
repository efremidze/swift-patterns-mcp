import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/fetch.js', () => ({
  fetch: mockFetch,
}));

function makeResponse(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

async function loadYoutubeModule() {
  return import('../youtube.js');
}

describe('youtube client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.YOUTUBE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
  });

  it('maps missing snippet fields to empty strings without crashing', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(true, 200, {
        items: [{ id: { videoId: 'video-1' }, snippet: {} }],
      }))
      .mockResolvedValueOnce(makeResponse(true, 200, {
        items: [{ id: 'video-1', snippet: {} }],
      }));

    const { getChannelVideos } = await loadYoutubeModule();
    const videos = await getChannelVideos('channel-1', 5);

    expect(videos).toEqual([
      {
        id: 'video-1',
        title: '',
        description: '',
        publishedAt: '',
        channelId: '',
        channelTitle: '',
        tags: undefined,
        patreonLink: undefined,
        codeLinks: [],
      },
    ]);
  });

  it('falls back to search snippets when videos endpoint fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(true, 200, {
        items: [
          {
            id: { videoId: 'video-2' },
            snippet: {
              title: 'Fallback Title',
              description: 'Fallback description',
              publishedAt: '2026-01-01T00:00:00Z',
              channelId: 'channel-2',
              channelTitle: 'Creator',
            },
          },
        ],
      }))
      .mockResolvedValueOnce(makeResponse(false, 500, {}));

    const { searchVideos } = await loadYoutubeModule();
    const videos = await searchVideos('swiftui fallback', undefined, 5);

    expect(videos).toHaveLength(1);
    expect(videos[0].id).toBe('video-2');
    expect(videos[0].title).toBe('Fallback Title');
    expect(videos[0].description).toBe('Fallback description');
  });

  it('extracts Patreon and code links from hydrated description', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(true, 200, {
        items: [
          {
            id: { videoId: 'video-3' },
            snippet: {
              title: 'Search title',
              description: 'search snippet',
            },
          },
        ],
      }))
      .mockResolvedValueOnce(makeResponse(true, 200, {
        items: [
          {
            id: 'video-3',
            snippet: {
              title: 'Hydrated title',
              description: 'Support: https://www.patreon.com/posts/build-123 Repo: https://github.com/example/repo',
              publishedAt: '2026-01-02T00:00:00Z',
              channelId: 'channel-3',
              channelTitle: 'Creator 3',
            },
          },
        ],
      }));

    const { getChannelVideos } = await loadYoutubeModule();
    const videos = await getChannelVideos('channel-3', 5);

    expect(videos).toHaveLength(1);
    expect(videos[0].patreonLink).toBe('https://www.patreon.com/posts/build-123');
    expect(videos[0].codeLinks).toEqual(['https://github.com/example/repo']);
  });
});
