// src/sources/premium/patreon-dl.ts
// Wrapper for patreon-dl to download and index Patreon content

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { CREATORS } from '../../config/creators.js';
import { getPatreonContentDir } from '../../utils/paths.js';
import logger from '../../utils/logger.js';

const execAsync = promisify(exec);
const PATREON_DL_PACKAGE = 'patreon-dl@3.6.0';
const PATREON_DL_COMMAND = `npx --yes ${PATREON_DL_PACKAGE}`;

function getCookiePath(): string {
  // Use .patreon-session in project root (created by extract-cookie.ts)
  return path.join(process.cwd(), '.patreon-session');
}

export interface DownloadedPost {
  postId: string;
  title: string;
  publishDate: string;
  creator: string;
  files: DownloadedFile[];
}

export interface DownloadedFile {
  filename: string;
  filepath: string;
  type: 'swift' | 'zip' | 'markdown' | 'other';
  content?: string;
}

/**
 * Check if patreon-dl is available
 */
export async function isPatreonDlAvailable(): Promise<boolean> {
  try {
    await execAsync(`${PATREON_DL_COMMAND} --version`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if cookie is configured
 */
export function isCookieConfigured(): boolean {
  return fs.existsSync(getCookiePath());
}

/**
 * Save cookie for patreon-dl
 */
export function saveCookie(cookie: string): void {
  const cookiePath = getCookiePath();
  fs.mkdirSync(path.dirname(cookiePath), { recursive: true });
  fs.writeFileSync(cookiePath, cookie);
}

/**
 * Download content for a creator
 */
export async function downloadCreatorContent(
  creatorUrl: string,
  creatorName: string
): Promise<{ success: boolean; error?: string }> {
  const cookiePath = getCookiePath();
  if (!fs.existsSync(cookiePath)) {
    return { success: false, error: 'Cookie not configured' };
  }

  const cookie = fs.readFileSync(cookiePath, 'utf-8').trim();
  const outDir = path.join(getPatreonContentDir(), creatorName);

  try {
    // Run patreon-dl with session_id cookie format
    const cmd = `${PATREON_DL_COMMAND} -c "session_id=${cookie}" -o "${outDir}" "${creatorUrl}"`;
    await execAsync(cmd, { timeout: 300000 }); // 5 min timeout

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Download content for all registered creators
 */
export async function downloadAllCreators(): Promise<void> {
  for (const creator of CREATORS) {
    const patreonUrl = `https://www.patreon.com/c/${creator.id}`;
    const result = await downloadCreatorContent(patreonUrl, creator.name);

    if (result.success) {
      logger.info({ creator: creator.name }, 'Downloaded content for creator');
    } else {
      logger.error({ creator: creator.name, error: result.error }, 'Failed to download creator content');
    }
  }
}

/**
 * Scan downloaded content and index files
 */
export function scanDownloadedContent(): DownloadedPost[] {
  const downloadDir = getPatreonContentDir();
  const posts: DownloadedPost[] = [];

  if (!fs.existsSync(downloadDir)) {
    return posts;
  }

  // Scan each creator directory
  const creatorDirs = fs.readdirSync(downloadDir);

  for (const creatorDir of creatorDirs) {
    const creatorPath = path.join(downloadDir, creatorDir);
    if (!fs.statSync(creatorPath).isDirectory()) continue;

    // Look for posts directory
    const postsPath = path.join(creatorPath, 'posts');
    if (!fs.existsSync(postsPath)) continue;

    // Scan each post
    const postDirs = fs.readdirSync(postsPath);
    for (const postDir of postDirs) {
      const postPath = path.join(postsPath, postDir);
      if (!fs.statSync(postPath).isDirectory()) continue;

      const post = scanPost(postPath, creatorDir);
      if (post) {
        posts.push(post);
      }
    }
  }

  return posts;
}

/**
 * Scan a single post directory
 */
function scanPost(postPath: string, creatorName: string): DownloadedPost | null {
  const files: DownloadedFile[] = [];

  // Read post metadata if available
  const metadataPath = path.join(postPath, 'post.json');
  let title = path.basename(postPath);
  let publishDate = '';
  let postId = path.basename(postPath);

  if (fs.existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      title = metadata.title || title;
      publishDate = metadata.published_at || metadata.publishedAt || '';
      postId = metadata.id || postId;
    } catch {
      // Ignore metadata parsing errors
    }
  }

  // Scan for relevant files
  scanDirectory(postPath, files);

  if (files.length === 0) {
    return null;
  }

  return {
    postId,
    title,
    publishDate,
    creator: creatorName,
    files,
  };
}

/**
 * Recursively scan directory for relevant files
 */
function scanDirectory(dir: string, files: DownloadedFile[]): void {
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip certain directories
      if (!['node_modules', '.git', '__MACOSX'].includes(entry)) {
        scanDirectory(fullPath, files);
      }
    } else {
      const ext = path.extname(entry).toLowerCase();
      let type: DownloadedFile['type'] = 'other';
      let content: string | undefined;

      if (ext === '.swift') {
        type = 'swift';
        content = fs.readFileSync(fullPath, 'utf-8');
      } else if (ext === '.zip') {
        type = 'zip';
      } else if (ext === '.md' || ext === '.markdown') {
        type = 'markdown';
        content = fs.readFileSync(fullPath, 'utf-8');
      }

      if (type !== 'other') {
        files.push({
          filename: entry,
          filepath: fullPath,
          type,
          content,
        });
      }
    }
  }
}

/**
 * Get download directory path
 */
export function getContentDir(): string {
  return getPatreonContentDir();
}
