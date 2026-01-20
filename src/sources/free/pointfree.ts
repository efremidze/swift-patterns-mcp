// src/sources/free/pointfree.ts

import path from 'path';
import { rssCache, articleCache } from '../../utils/cache.js';
import { CachedSearchIndex } from '../../utils/search.js';
import { detectTopics, hasCodeContent, calculateRelevance } from '../../utils/swift-analysis.js';
import { createSourceConfig } from '../../config/swift-keywords.js';
import { fetchJson, fetchText, buildHeaders } from '../../utils/http.js';
import { runWithConcurrency } from '../../utils/concurrency.js';
import type { BasePattern } from './rssPatternSource.js';

export interface PointFreePattern extends BasePattern {
  sourcePath: string;
}

interface GitHubRepoResponse {
  default_branch?: string;
}

interface GitHubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
}

interface GitHubTreeResponse {
  tree: GitHubTreeEntry[];
}

const POINTFREE_OWNER = 'pointfreeco';
const POINTFREE_REPO = 'pointfreeco';
const POINTFREE_CACHE_KEY = 'pointfree-patterns';
const POINTFREE_CACHE_TTL = 3600;
const POINTFREE_TREE_TTL = 3600;
const POINTFREE_FILE_TTL = 86400;
const MAX_FILES = 160;
const MAX_CONCURRENT_FETCHES = 8;

const markdownExtensions = new Set(['.md', '.markdown', '.mdown']);
const excludedPathFragments = [
  '/.github/',
  '/scripts/',
  '/build/',
  '/tests/',
  '/test/',
  '/fixtures/',
  '/.swiftpm/',
];
const swiftContentDirectories = [
  '/episodes/',
  '/casestudies/',
  '/case-studies/',
  '/guides/',
  '/documentation/',
  '/docs/',
];

const { topicKeywords: pointfreeTopicKeywords, qualitySignals: pointfreeQualitySignals } = createSourceConfig(
  {
    'architecture': ['tca', 'composable architecture', 'reducer', 'store', 'dependency', 'effect'],
    'testing': ['snapshot', 'test', 'xctest', 'deterministic', 'mock'],
    'concurrency': ['async', 'await', 'actor', 'task', 'effect', 'scheduler'],
    'swiftui': ['swiftui', 'view', 'viewstore', 'binding'],
  },
  {
    'case study': 8, 'episode': 7, 'architecture': 9, 'reducer': 7,
    'dependency': 6, 'effect': 6, 'testing': 7, 'swiftui': 6,
  }
);

const GITHUB_HEADERS = buildHeaders(
  'swift-patterns-mcp/1.0 (GitHub Reader)',
  process.env.GITHUB_TOKEN
);

function isContentPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  if (excludedPathFragments.some(fragment => lower.includes(fragment))) {
    return false;
  }
  const ext = path.extname(lower);
  if (markdownExtensions.has(ext)) {
    return true;
  }
  if (ext === '.swift') {
    return swiftContentDirectories.some(fragment => lower.includes(fragment));
  }
  return false;
}

function extractTitle(filePath: string, content: string): string {
  const frontMatterMatch = content.match(/^---[\s\S]*?^---/m);
  if (frontMatterMatch) {
    const titleMatch = frontMatterMatch[0].match(/title:\s*["']?(.+?)["']?$/m);
    if (titleMatch?.[1]) {
      return titleMatch[1].trim();
    }
  }
  const markdownTitle = content.match(/^#\s+(.+)$/m);
  if (markdownTitle?.[1]) {
    return markdownTitle[1].trim();
  }
  const swiftTitle = content.match(/title:\s*"([^"]+)"/);
  if (swiftTitle?.[1]) {
    return swiftTitle[1].trim();
  }
  return path.basename(filePath, path.extname(filePath)).replace(/[-_]/g, ' ');
}

function stripFormatting(content: string): string {
  // Single-pass regex for better performance
  return content
    .replace(/```[\s\S]*?```|<[^>]+>|\[[^\]]+]\([^)]+\)|`[^`]+`/g, ' ')
    .replace(/[#>*_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class PointFreeSource {
  private cachedSearch = new CachedSearchIndex<PointFreePattern>(['title', 'content', 'topics']);

  private async getDefaultBranch(): Promise<string> {
    try {
      const repoInfo = await fetchJson<GitHubRepoResponse>(
        `https://api.github.com/repos/${POINTFREE_OWNER}/${POINTFREE_REPO}`,
        { headers: GITHUB_HEADERS }
      );
      return repoInfo.default_branch || 'main';
    } catch {
      return 'main';
    }
  }

  private async getRepoTree(branch: string): Promise<GitHubTreeEntry[]> {
    const cacheKey = `pointfree-tree-${branch}`;
    const cached = await rssCache.get<GitHubTreeEntry[]>(cacheKey);
    if (cached) return cached;
    const tree = await fetchJson<GitHubTreeResponse>(
      `https://api.github.com/repos/${POINTFREE_OWNER}/${POINTFREE_REPO}/git/trees/${branch}?recursive=1`,
      { headers: GITHUB_HEADERS }
    );
    const entries = tree.tree ?? [];
    await rssCache.set(cacheKey, entries, POINTFREE_TREE_TTL);
    return entries;
  }

  private async fetchContentFiles(branch: string): Promise<{ branch: string; files: GitHubTreeEntry[] }> {
    const branchesToTry = branch === 'master' ? [branch] : [branch, 'master'];
    for (const candidate of branchesToTry) {
      try {
        const tree = await this.getRepoTree(candidate);
        const files = tree.filter(entry => entry.type === 'blob' && isContentPath(entry.path)).slice(0, MAX_FILES);
        return { branch: candidate, files };
      } catch {
        continue;
      }
    }
    return { branch, files: [] };
  }

  private async fetchFileContent(branch: string, filePath: string): Promise<string> {
    const rawUrl = `https://raw.githubusercontent.com/${POINTFREE_OWNER}/${POINTFREE_REPO}/${branch}/${filePath}`;
    const cached = await articleCache.get<string>(rawUrl);
    if (cached) return cached;
    const content = await fetchText(rawUrl, { headers: GITHUB_HEADERS });
    await articleCache.set(rawUrl, content, POINTFREE_FILE_TTL);
    return content;
  }

  async fetchPatterns(): Promise<PointFreePattern[]> {
    const cached = await rssCache.get<PointFreePattern[]>(POINTFREE_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const branch = await this.getDefaultBranch();
    const { branch: resolvedBranch, files } = await this.fetchContentFiles(branch);

    const patterns = await runWithConcurrency(files, MAX_CONCURRENT_FETCHES, async file => {
        const content = await this.fetchFileContent(resolvedBranch, file.path);
        const title = extractTitle(file.path, content);
        const stripped = stripFormatting(content);
        const excerpt = stripped.substring(0, 300);
        const text = `${title} ${content}`.toLowerCase();
        const topics = detectTopics(text, pointfreeTopicKeywords);
        const hasCode = hasCodeContent(content);
        const relevanceScore = calculateRelevance(text, hasCode, pointfreeQualitySignals, 50, 12);

        return {
          id: `${POINTFREE_CACHE_KEY}-${file.path}`,
          title,
          url: `https://github.com/${POINTFREE_OWNER}/${POINTFREE_REPO}/blob/${resolvedBranch}/${file.path}`,
          publishDate: '',
          excerpt,
          content,
          topics,
          relevanceScore,
          hasCode,
          sourcePath: file.path,
        };
    });

    await rssCache.set(POINTFREE_CACHE_KEY, patterns, POINTFREE_CACHE_TTL);
    // Invalidate search index after fetching new patterns
    this.cachedSearch.invalidate();
    return patterns;
  }

  async searchPatterns(query: string): Promise<PointFreePattern[]> {
    const patterns = await this.fetchPatterns();
    return this.cachedSearch.search(patterns, query);
  }
}

export default PointFreeSource;
