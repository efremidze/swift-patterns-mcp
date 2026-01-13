// src/sources/premium/patreon-zip.ts

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

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

function getSwiftMcpDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(home, '.swift-mcp');
}

function getCacheDir(): string {
  return path.join(getSwiftMcpDir(), 'cache', 'zips');
}

function detectFileType(filename: string): ExtractedPattern['type'] {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.swift': return 'swift';
    case '.md': case '.markdown': return 'markdown';
    case '.playground': return 'playground';
    default: return 'other';
  }
}

function detectTopics(content: string, filename: string): string[] {
  const text = `${filename} ${content}`.toLowerCase();
  const topics: string[] = [];

  const keywords: Record<string, string[]> = {
    'swiftui': ['swiftui', '@state', '@binding', '@observable', 'view'],
    'concurrency': ['async', 'await', 'actor', 'task', 'sendable'],
    'networking': ['urlsession', 'network', 'api', 'http', 'request'],
    'testing': ['xctest', 'test', 'mock', 'stub'],
    'architecture': ['mvvm', 'coordinator', 'repository', 'usecase'],
    'uikit': ['uikit', 'uiview', 'uitableview', 'uicollectionview'],
  };

  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) {
      topics.push(topic);
    }
  }

  return topics;
}

function hasCodeContent(content: string): boolean {
  return /\b(func|class|struct|protocol|extension|enum)\s+\w+/.test(content) ||
         content.includes('```swift') ||
         content.includes('```');
}

export async function downloadZip(
  url: string,
  postId: string,
  accessToken: string
): Promise<string | null> {
  const cacheDir = getCacheDir();
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
      console.error(`Failed to download zip: ${response.status}`);
      return null;
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_ZIP_SIZE) {
      console.warn(`Zip file too large (${contentLength} bytes), skipping`);
      return null;
    }

    // Ensure cache directory exists
    fs.mkdirSync(cacheDir, { recursive: true });

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(zipPath, buffer);

    return zipPath;
  } catch (error) {
    console.error('Zip download failed:', error);
    return null;
  }
}

export function extractZip(zipPath: string, postId: string): ZipExtractionResult {
  const warnings: string[] = [];
  const patterns: ExtractedPattern[] = [];

  const destDir = path.join(getCacheDir(), postId);

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
        const topics = detectTopics(content, filename);
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
  const cacheDir = getCacheDir();
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true });
  }
}
