// src/sources/premium/patreon-dl.ts
// Wrapper for patreon-dl to download and index Patreon content

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
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
  dirName?: string; // Directory name (e.g., "148144034 - Title") for matching against directory-based lookups
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
 * Extract post ID from Patreon URL
 */
export function extractPostId(url: string): string | null {
  // Format: https://www.patreon.com/posts/title-slug-12345678
  const match = url.match(/patreon\.com\/posts\/[^/]+-(\d+)$/);
  if (match) return match[1];

  // Format: https://www.patreon.com/posts/12345678
  const simpleMatch = url.match(/patreon\.com\/posts\/(\d+)$/);
  return simpleMatch ? simpleMatch[1] : null;
}

/**
 * Check if a post is already downloaded
 */
export function isPostDownloaded(postId: string): boolean {
  const contentDir = getPatreonContentDir();
  if (!fs.existsSync(contentDir)) return false;

  // Search through creator directories for this post
  const creatorDirs = fs.readdirSync(contentDir);
  for (const creatorDir of creatorDirs) {
    const postsPath = path.join(contentDir, creatorDir, 'posts');
    if (!fs.existsSync(postsPath)) continue;

    const postDirs = fs.readdirSync(postsPath);
    // Directory names are in format "POSTID - Title", so check for exact match at start
    if (postDirs.some(dir => dir === postId || dir.startsWith(`${postId} -`) || dir.startsWith(`${postId}-`))) {
      return true;
    }
  }
  return false;
}

/**
 * Download a specific post
 */
export async function downloadPost(
  postUrl: string,
  creatorName: string
): Promise<{ success: boolean; error?: string; files?: DownloadedFile[] }> {
  const cookiePath = getCookiePath();
  if (!fs.existsSync(cookiePath)) {
    return { success: false, error: 'Cookie not configured. Run: swift-patterns-mcp auth --patreon' };
  }

  const postId = extractPostId(postUrl);
  if (!postId) {
    return { success: false, error: `Invalid Patreon URL: ${postUrl}` };
  }

  // Check if already downloaded
  if (isPostDownloaded(postId)) {
    const posts = scanDownloadedContent();
    // Match by postId OR by directory name (handles case where metadata postId differs from directory name)
    const post = posts.find(p => 
      p.postId === postId || 
      p.dirName === postId ||
      p.dirName?.startsWith(`${postId} -`) ||
      p.dirName?.startsWith(`${postId}-`)
    );
    if (post) {
      return { success: true, files: post.files };
    }
  }

  const cookie = fs.readFileSync(cookiePath, 'utf-8').trim();
  const outDir = path.join(getPatreonContentDir(), creatorName);

  try {
    logger.info({ postUrl, creatorName }, 'Downloading Patreon post');

    // Run patreon-dl for this specific post (--no-prompt for non-interactive)
    const cmd = `${PATREON_DL_COMMAND} --no-prompt -c "session_id=${cookie}" -o "${outDir}" "${postUrl}"`;
    await execAsync(cmd, { timeout: 120000 }); // 2 min timeout for single post

    // Scan for downloaded files
    const posts = scanDownloadedContent();
    // Match by postId OR by directory name (handles case where metadata postId differs from directory name)
    const post = posts.find(p => 
      p.postId === postId || 
      p.dirName === postId ||
      p.dirName?.startsWith(`${postId} -`) ||
      p.dirName?.startsWith(`${postId}-`)
    );

    if (post) {
      return { success: true, files: post.files };
    }

    return { success: true, files: [] };
  } catch (error) {
    logger.error({ error, postUrl }, 'Failed to download post');
    return { success: false, error: String(error) };
  }
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
    // Run patreon-dl with session_id cookie format (--no-prompt for non-interactive)
    const cmd = `${PATREON_DL_COMMAND} --no-prompt -c "session_id=${cookie}" -o "${outDir}" "${creatorUrl}"`;
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

  // Find all "posts" directories recursively (patreon-dl creates nested structure)
  const postsDirs = findPostsDirectories(downloadDir);

  for (const { postsPath, creatorName } of postsDirs) {
    const postDirs = fs.readdirSync(postsPath);
    for (const postDir of postDirs) {
      const postPath = path.join(postsPath, postDir);
      if (!fs.statSync(postPath).isDirectory()) continue;

      const post = scanPost(postPath, creatorName);
      if (post) {
        posts.push(post);
      }
    }
  }

  return posts;
}

/**
 * Recursively find all "posts" directories
 */
function findPostsDirectories(dir: string, depth = 0): Array<{ postsPath: string; creatorName: string }> {
  const results: Array<{ postsPath: string; creatorName: string }> = [];

  if (depth > 3) return results; // Limit recursion depth

  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    if (entry === 'posts') {
      // Found a posts directory - extract creator name from parent
      const parentName = path.basename(dir);
      // Creator name might be in format "kavsoft - Kavsoft" or just "Kavsoft"
      const creatorName = parentName.split(' - ').pop() || parentName;
      results.push({ postsPath: fullPath, creatorName });
    } else if (!entry.startsWith('.') && entry !== 'cache') {
      // Recurse into subdirectories
      results.push(...findPostsDirectories(fullPath, depth + 1));
    }
  }

  return results;
}

/**
 * Scan a single post directory
 */
function scanPost(postPath: string, creatorName: string): DownloadedPost | null {
  const files: DownloadedFile[] = [];

  // Try different metadata paths (patreon-dl uses post_info/post-api.json)
  const metadataPaths = [
    path.join(postPath, 'post_info', 'post-api.json'),
    path.join(postPath, 'post.json'),
  ];

  let title = path.basename(postPath);
  let publishDate = '';
  let postId = path.basename(postPath);

  // Extract postId from directory name (format: "148144034 - Title")
  const idMatch = title.match(/^(\d+)/);
  if (idMatch) {
    postId = idMatch[1];
  }

  for (const metadataPath of metadataPaths) {
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        // patreon-dl API format uses nested structure
        const postData = metadata.data?.attributes || metadata;
        title = postData.title || title;
        publishDate = postData.published_at || postData.publishedAt || '';
        if (metadata.data?.id) postId = metadata.data.id;
        break;
      } catch {
        // Try next metadata path
      }
    }
  }

  // Scan for relevant files (including zip extraction)
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
    dirName: path.basename(postPath),
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
      if (!['node_modules', '.git', '__MACOSX', '.patreon-dl', 'post_info', 'campaign_info'].includes(entry)) {
        scanDirectory(fullPath, files);
      }
    } else {
      const ext = path.extname(entry).toLowerCase();

      if (ext === '.swift') {
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({
          filename: entry,
          filepath: fullPath,
          type: 'swift',
          content,
        });
      } else if (ext === '.zip') {
        // Extract Swift files from zip
        const extractedFiles = extractZipContents(fullPath);
        files.push(...extractedFiles);
      } else if (ext === '.md' || ext === '.markdown') {
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({
          filename: entry,
          filepath: fullPath,
          type: 'markdown',
          content,
        });
      }
    }
  }
}

/**
 * Extract Swift and Markdown files from a zip archive
 */
function extractZipContents(zipPath: string): DownloadedFile[] {
  const files: DownloadedFile[] = [];

  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const filename = entry.entryName;
      const ext = path.extname(filename).toLowerCase();

      // Skip macOS metadata and hidden files
      if (filename.includes('__MACOSX') || filename.startsWith('.')) continue;

      if (ext === '.swift') {
        const content = entry.getData().toString('utf-8');
        files.push({
          filename: path.basename(filename),
          filepath: `${zipPath}!/${filename}`,
          type: 'swift',
          content,
        });
      } else if (ext === '.md' || ext === '.markdown') {
        const content = entry.getData().toString('utf-8');
        files.push({
          filename: path.basename(filename),
          filepath: `${zipPath}!/${filename}`,
          type: 'markdown',
          content,
        });
      }
    }
  } catch (error) {
    logger.error({ error, zipPath }, 'Failed to extract zip');
  }

  return files;
}

/**
 * Get download directory path
 */
export function getContentDir(): string {
  return getPatreonContentDir();
}
