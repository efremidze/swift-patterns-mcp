// src/sources/premium/patreon-zip.ts

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { getCacheDir } from '../../utils/paths.js';
import { detectTopics, hasCodeContent } from '../../utils/swift-analysis.js';
import { createSourceConfig } from '../../config/swift-keywords.js';
import { logError } from '../../utils/errors.js';

const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 100;

export interface ExtractedPattern {
  filename: string;
  content: string;
  type: 'swift' | 'markdown' | 'playground' | 'other';
  hasCode: boolean;
  topics: string[];
}

export interface ZipExtractionResult {
  success: boolean;
  patterns: ExtractedPattern[];
  warnings: string[];
}

const { topicKeywords: zipTopicKeywords } = createSourceConfig(
  {
    'concurrency': ['sendable'],
    'networking': ['request'],
    'testing': ['stub'],
    'architecture': ['repository', 'usecase'],
    'uikit': ['uitableview', 'uicollectionview'],
  },
  {}
);

function detectFileType(filename: string): ExtractedPattern['type'] {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.swift': return 'swift';
    case '.md': case '.markdown': return 'markdown';
    case '.playground': return 'playground';
    default: return 'other';
  }
}

export async function downloadZip(
  url: string,
  postId: string,
  accessToken: string
): Promise<string | null> {
  const cacheDir = getCacheDir('zips');
  const zipPath = path.join(cacheDir, `${postId}.zip`);

  // Check if already cached
  if (fs.existsSync(zipPath)) {
    return zipPath;
  }

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      logError('Patreon Zip', `Download failed: ${response.status}`, { postId });
      return null;
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_ZIP_SIZE) {
      return null;
    }

    // Ensure cache directory exists
    fs.mkdirSync(cacheDir, { recursive: true });

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(zipPath, buffer);

    return zipPath;
  } catch (error) {
    logError('Patreon Zip', error, { postId });
    return null;
  }
}

export function extractZip(zipPath: string, postId: string): ZipExtractionResult {
  const warnings: string[] = [];
  const patterns: ExtractedPattern[] = [];

  const destDir = path.join(getCacheDir('zips'), postId);

  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    if (entries.length > MAX_FILES) {
      warnings.push(`Zip contains ${entries.length} files, extracting first ${MAX_FILES}`);
    }

    // Ensure destination exists
    fs.mkdirSync(destDir, { recursive: true });

    let count = 0;
    for (const entry of entries) {
      if (count >= MAX_FILES) break;
      if (entry.isDirectory) continue;

      const filename = entry.entryName;
      const type = detectFileType(filename);

      // Skip non-relevant files
      if (type === 'other') continue;

      try {
        const content = entry.getData().toString('utf8');
        const text = `${filename} ${content}`;
        const topics = detectTopics(text, zipTopicKeywords);
        const hasCode = hasCodeContent(content);

        patterns.push({
          filename,
          content,
          type,
          hasCode,
          topics,
        });

        count++;
      } catch (err) {
        warnings.push(`Failed to read ${filename}: ${err}`);
      }
    }

    return { success: true, patterns, warnings };
  } catch (error) {
    return {
      success: false,
      patterns: [],
      warnings: [`Extraction failed: ${error}`],
    };
  }
}

export async function extractFromAttachment(
  attachmentUrl: string,
  postId: string,
  accessToken: string
): Promise<ZipExtractionResult> {
  const zipPath = await downloadZip(attachmentUrl, postId, accessToken);

  if (!zipPath) {
    return {
      success: false,
      patterns: [],
      warnings: ['Failed to download zip attachment'],
    };
  }

  return extractZip(zipPath, postId);
}

export function clearZipCache(): void {
  const cacheDir = getCacheDir('zips');
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true });
  }
}
