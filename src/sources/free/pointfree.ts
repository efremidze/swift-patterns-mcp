// src/sources/free/pointfree.ts

import path from 'path';
import { rssCache } from '../../utils/cache.js';
import { SearchIndex, combineScores } from '../../utils/search.js';
import { detectTopics, hasCodeContent, calculateRelevance } from '../../utils/swift-analysis.js';
import { BASE_TOPIC_KEYWORDS, BASE_QUALITY_SIGNALS, mergeKeywords, mergeQualitySignals } from '../../config/swift-keywords.js';
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
const MAX_FILES = 160;

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

const pointfreeSpecificTopics: Record<string, string[]> = {
  'architecture': ['tca', 'composable architecture', 'reducer', 'store', 'dependency', 'effect'],
  'testing': ['snapshot', 'test', 'xctest', 'deterministic', 'mock'],
  'concurrency': ['async', 'await', 'actor', 'task', 'effect', 'scheduler'],
  'swiftui': ['swiftui', 'view', 'viewstore', 'binding'],
};

const pointfreeSpecificSignals: Record<string, number> = {
  'case study': 8,
  'episode': 7,
  'architecture': 9,
  'reducer': 7,
  'dependency': 6,
  'effect': 6,
  'testing': 7,
  'swiftui': 6,
};

const pointfreeTopicKeywords = mergeKeywords(BASE_TOPIC_KEYWORDS, pointfreeSpecificTopics);
const pointfreeQualitySignals = mergeQualitySignals(BASE_QUALITY_SIGNALS, pointfreeSpecificSignals);

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'swift-patterns-mcp/1.0 (GitHub Reader)',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: buildHeaders(),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: buildHeaders(),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

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
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[[^\]]+]\([^)]+\)/g, ' ')
    .replace(/[#>*_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class PointFreeSource {
  private async getDefaultBranch(): Promise<string> {
    try {
      const repoInfo = await fetchJson<GitHubRepoResponse>(
        `https://api.github.com/repos/${POINTFREE_OWNER}/${POINTFREE_REPO}`
      );
      return repoInfo.default_branch || 'main';
    } catch {
      return 'main';
    }
  }

  private async getRepoTree(branch: string): Promise<GitHubTreeEntry[]> {
    const tree = await fetchJson<GitHubTreeResponse>(
      `https://api.github.com/repos/${POINTFREE_OWNER}/${POINTFREE_REPO}/git/trees/${branch}?recursive=1`
    );
    return tree.tree ?? [];
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
    return fetchText(rawUrl);
  }

  async fetchPatterns(): Promise<PointFreePattern[]> {
    const cached = await rssCache.get<PointFreePattern[]>(POINTFREE_CACHE_KEY);
    if (cached) return cached;

    const branch = await this.getDefaultBranch();
    const { branch: resolvedBranch, files } = await this.fetchContentFiles(branch);

    const results = await Promise.allSettled(
      files.map(async file => {
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
      })
    );

    const patterns = results
      .filter((result): result is PromiseFulfilledResult<PointFreePattern> => result.status === 'fulfilled')
      .map(result => result.value);

    await rssCache.set(POINTFREE_CACHE_KEY, patterns, POINTFREE_CACHE_TTL);
    return patterns;
  }

  async searchPatterns(query: string): Promise<PointFreePattern[]> {
    const patterns = await this.fetchPatterns();
    const searchIndex = new SearchIndex<PointFreePattern>(['title', 'content', 'topics']);
    searchIndex.addDocuments(patterns);
    const results = searchIndex.search(query, {
      fuzzy: 0.2,
      boost: { title: 2.5, topics: 1.8, content: 1 },
    });
    return results
      .map(result => ({
        ...result.item,
        relevanceScore: combineScores(result.score, result.item.relevanceScore),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

export default PointFreeSource;
