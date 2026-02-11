import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecFile = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}));

async function loadPatreonDl() {
  return import('../patreon-dl.js');
}

function createPost(
  homeDir: string,
  creator: string,
  dirName: string,
  options?: {
    metadataPath?: 'post.json' | 'post_info/post-api.json';
    metadata?: Record<string, unknown>;
    addSwift?: boolean;
    addMarkdown?: boolean;
    addZip?: boolean;
  }
) {
  const postDir = path.join(homeDir, '.swift-patterns-mcp', 'patreon-content', creator, 'posts', dirName);
  fs.mkdirSync(postDir, { recursive: true });

  const metadataPath = options?.metadataPath ?? 'post.json';
  const metadata = options?.metadata ?? {
    title: 'Test Post',
    published_at: '2024-01-01T00:00:00Z',
  };

  const fullMetadataPath = path.join(postDir, metadataPath);
  fs.mkdirSync(path.dirname(fullMetadataPath), { recursive: true });
  fs.writeFileSync(fullMetadataPath, JSON.stringify(metadata));

  if (options?.addSwift ?? true) {
    fs.writeFileSync(path.join(postDir, 'Example.swift'), 'import SwiftUI\nstruct Example {}\n');
  }

  if (options?.addMarkdown ?? true) {
    fs.writeFileSync(path.join(postDir, 'README.md'), '# Notes\n');
  }

  if (options?.addZip) {
    const zipPath = path.join(postDir, 'attachments.zip');
    const zip = new AdmZip();
    zip.addFile('Sources/Inside.swift', Buffer.from('import SwiftUI\nstruct Inside {}\n'));
    zip.addFile('Docs/Guide.markdown', Buffer.from('# Guide\n'));
    zip.addFile('__MACOSX/._junk.swift', Buffer.from('junk'));
    zip.addFile('.hidden.md', Buffer.from('hidden'));
    zip.writeZip(zipPath);
  }

  return postDir;
}

describe('patreon-dl', () => {
  const originalCwd = process.cwd();
  const originalHome = process.env.HOME;
  let tempRoot = '';

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'patreon-dl-test-'));
    const isolatedCwd = path.join(tempRoot, 'workspace');
    fs.mkdirSync(isolatedCwd, { recursive: true });

    process.env.HOME = tempRoot;
    process.chdir(isolatedCwd);

    mockExecFile.mockImplementation((_: string, __: string[], optionsOrCallback?: unknown, callback?: unknown) => {
      const cb = typeof optionsOrCallback === 'function'
        ? optionsOrCallback as (error: Error | null, stdout?: string, stderr?: string) => void
        : callback as ((error: Error | null, stdout?: string, stderr?: string) => void) | undefined;
      cb?.(null, '', '');
      return {} as never;
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('extractPostId supports slug, numeric, and invalid URLs', async () => {
    const { extractPostId } = await loadPatreonDl();

    expect(extractPostId('https://www.patreon.com/posts/apple-stocks-ui-148144034')).toBe('148144034');
    expect(extractPostId('https://www.patreon.com/posts/148144034')).toBe('148144034');
    expect(extractPostId('https://www.patreon.com/posts/not-a-number')).toBeNull();
    expect(extractPostId('https://example.com/posts/148144034')).toBeNull();
  });

  it('saveCookie rejects multiple injection and unsafe cookie strings', async () => {
    const { saveCookie } = await loadPatreonDl();
    const invalidCookies = [
      'cookie with spaces',
      'cookie;rm-rf',
      'cookie"quote',
      '../traversal',
      'cookie🍪unicode',
      'multi\nline',
    ];

    for (const value of invalidCookies) {
      expect(() => saveCookie(value)).toThrow(/Invalid cookie format/);
    }
  });

  it('downloadPost returns error when cookie file is missing', async () => {
    const { downloadPost } = await loadPatreonDl();

    const result = await downloadPost('https://www.patreon.com/posts/148144034', 'Kavsoft');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cookie not configured');
  });

  it('downloadPost rejects invalid Patreon URL before spawning npx', async () => {
    const { downloadPost, saveCookie } = await loadPatreonDl();
    saveCookie('valid_cookie_123');

    const result = await downloadPost('https://www.patreon.com/posts/not-a-post-id', 'Kavsoft');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid Patreon URL');
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('downloadPost executes patreon-dl and returns scanned files on success', async () => {
    const { downloadPost, saveCookie } = await loadPatreonDl();
    saveCookie('valid_cookie_123');

    mockExecFile.mockImplementationOnce((_: string, __: string[], optionsOrCallback?: unknown, callback?: unknown) => {
      createPost(tempRoot, 'Kavsoft', '148144034 - Apple Stocks');
      const cb = typeof optionsOrCallback === 'function'
        ? optionsOrCallback as (error: Error | null, stdout?: string, stderr?: string) => void
        : callback as ((error: Error | null, stdout?: string, stderr?: string) => void) | undefined;
      cb?.(null, '', '');
      return {} as never;
    });

    const result = await downloadPost('https://www.patreon.com/posts/apple-stocks-ui-148144034', 'Kavsoft');

    expect(result.success).toBe(true);
    expect(result.files?.some(file => file.type === 'swift')).toBe(true);
    expect(mockExecFile).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining([
        '--yes',
        'patreon-dl@3.6.0',
        '--no-prompt',
        '-c',
        'session_id=valid_cookie_123',
      ]),
      expect.objectContaining({ timeout: 120000 }),
      expect.any(Function)
    );
  });

  it('downloadPost returns an error when patreon-dl command fails', async () => {
    const { downloadPost, saveCookie } = await loadPatreonDl();
    saveCookie('valid_cookie_123');

    mockExecFile.mockImplementationOnce((_: string, __: string[], optionsOrCallback?: unknown, callback?: unknown) => {
      const cb = typeof optionsOrCallback === 'function'
        ? optionsOrCallback as (error: Error | null, stdout?: string, stderr?: string) => void
        : callback as ((error: Error | null, stdout?: string, stderr?: string) => void) | undefined;
      cb?.(new Error('command failed'), '', 'stderr output');
      return {} as never;
    });

    const result = await downloadPost('https://www.patreon.com/posts/apple-stocks-ui-148144034', 'Kavsoft');

    expect(result.success).toBe(false);
    expect(result.error).toContain('command failed');
  });

  it('scanDownloadedContent reads metadata from both post.json and post_info/post-api.json', async () => {
    const { scanDownloadedContent, invalidateScanCache } = await loadPatreonDl();

    createPost(tempRoot, 'CreatorOne', '111111111 - First Post', {
      metadataPath: 'post.json',
      metadata: {
        title: 'First Post',
        published_at: '2024-01-01T00:00:00Z',
      },
    });

    createPost(tempRoot, 'CreatorTwo', '222222222 - Second Post', {
      metadataPath: 'post_info/post-api.json',
      metadata: {
        data: {
          id: '222222222',
          attributes: {
            title: 'Second Post',
            published_at: '2024-02-01T00:00:00Z',
          },
        },
      },
    });

    invalidateScanCache();
    const posts = scanDownloadedContent();

    expect(posts).toHaveLength(2);
    expect(posts.some(post => post.title === 'First Post')).toBe(true);
    expect(posts.some(post => post.title === 'Second Post' && post.postId === '222222222')).toBe(true);
  });

  it('extracts Swift and Markdown files from zip attachments', async () => {
    const { scanDownloadedContent, invalidateScanCache } = await loadPatreonDl();

    createPost(tempRoot, 'ZipCreator', '333333333 - Zip Post', {
      addSwift: false,
      addMarkdown: false,
      addZip: true,
    });

    invalidateScanCache();
    const posts = scanDownloadedContent();
    const files = posts.flatMap(post => post.files);

    expect(files.some(file => file.type === 'swift' && file.filename === 'Inside.swift')).toBe(true);
    expect(files.some(file => file.type === 'markdown' && file.filename === 'Guide.markdown')).toBe(true);
    expect(files.some(file => file.filepath.includes('__MACOSX'))).toBe(false);
  });

  it('isPostDownloaded matches by postId and directory-based fallbacks', async () => {
    const { isPostDownloaded, invalidateScanCache } = await loadPatreonDl();

    createPost(tempRoot, 'MatchCreator', '444444444 - Match by Directory', {
      metadata: {
        data: {
          id: '999999999',
          attributes: {
            title: 'Match by Directory',
            published_at: '2024-03-01T00:00:00Z',
          },
        },
      },
      metadataPath: 'post_info/post-api.json',
    });

    createPost(tempRoot, 'MatchCreator', '555555555 - Match by Metadata', {
      metadata: {
        data: {
          id: '555555555',
          attributes: {
            title: 'Match by Metadata',
            published_at: '2024-04-01T00:00:00Z',
          },
        },
      },
      metadataPath: 'post_info/post-api.json',
    });

    invalidateScanCache();
    expect(isPostDownloaded('444444444')).toBe(true);
    expect(isPostDownloaded('555555555')).toBe(true);
    expect(isPostDownloaded('000000000')).toBe(false);
  });

  it('invalidateScanCache clears stale cached scan data', async () => {
    const { scanDownloadedContent, invalidateScanCache } = await loadPatreonDl();

    createPost(tempRoot, 'CacheCreator', '666666666 - Cached Post');
    invalidateScanCache();

    const firstScan = scanDownloadedContent();
    expect(firstScan).toHaveLength(1);

    const creatorPostsDir = path.join(
      tempRoot,
      '.swift-patterns-mcp',
      'patreon-content',
      'CacheCreator',
      'posts'
    );
    fs.rmSync(creatorPostsDir, { recursive: true, force: true });

    const cachedScan = scanDownloadedContent();
    expect(cachedScan).toHaveLength(1);

    invalidateScanCache();
    const refreshedScan = scanDownloadedContent();
    expect(refreshedScan).toHaveLength(0);
  });
});
