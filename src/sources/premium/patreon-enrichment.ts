// src/sources/premium/patreon-enrichment.ts
// Pattern enrichment via Patreon post content download

import type { PatreonPattern } from './patreon.js';
import { downloadPost, type DownloadedPost, type DownloadedFile, scanDownloadedContent, extractPostId } from './patreon-dl.js';
import type { Video } from './youtube.js';
import { detectTopics, hasCodeContent, calculateRelevance } from '../../utils/swift-analysis.js';
import { createSourceConfig } from '../../config/swift-keywords.js';
import { logError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import { rankPatternsForQuery } from './patreon-scoring.js';
import { dedupePatterns } from './patreon-dedup.js';
import { buildQueryProfile, type QueryProfile } from '../../utils/query-analysis.js';

const { topicKeywords: patreonTopicKeywords, qualitySignals: patreonQualitySignals } = createSourceConfig(
  { 'swiftui': ['@observable'], 'architecture': ['clean architecture'] },
  { 'swift': 10, 'ios': 8, 'pattern': 6, 'best practice': 8 }
);

// Patreon-specific scoring constants (matched to free source defaults)
export const PATREON_CODE_BONUS = 10;
export const PATREON_BASE_SCORE = 50;
export const PATREON_EXCERPT_LENGTH = 300;
export const PATREON_DOWNLOADED_RESULTS_LIMIT = 100;

export function getPositiveIntEnv(name: string, fallback: number): number {
  const raw = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * Convert downloaded files to patterns
 */
export function filesToPatterns(
  files: DownloadedFile[],
  source: Pick<PatreonPattern, 'id' | 'title' | 'publishDate' | 'creator'>
): PatreonPattern[] {
  const patterns: PatreonPattern[] = [];

  for (const file of files) {
    if (file.type === 'other') continue;

    const content = file.content || '';
    const text = `${file.filename} ${content}`;
    const topics = detectTopics(text, patreonTopicKeywords);
    const hasCode = file.type === 'swift' || hasCodeContent(content);
    const relevanceScore = calculateRelevance(text, hasCode, patreonQualitySignals, PATREON_BASE_SCORE, PATREON_CODE_BONUS);

    patterns.push({
      id: `${source.id}-${file.filename}`,
      title: `${source.title} - ${file.filename}`,
      url: `file://${file.filepath}`,
      publishDate: source.publishDate,
      excerpt: content.substring(0, PATREON_EXCERPT_LENGTH),
      content,
      creator: source.creator,
      topics,
      relevanceScore,
      hasCode,
    });
  }

  return patterns;
}

/**
 * Fetch actual code content from Patreon for patterns that have Patreon links
 */
export async function enrichPatternsWithContent(
  patterns: PatreonPattern[],
  filesToPatternsImpl: typeof filesToPatterns
): Promise<PatreonPattern[]> {
  const concurrencyRaw = Number.parseInt(process.env.PATREON_ENRICH_CONCURRENCY || '3', 10);
  const concurrency = Number.isFinite(concurrencyRaw) && concurrencyRaw > 0 ? concurrencyRaw : 1;
  const outputs: PatreonPattern[][] = new Array(patterns.length);
  const downloadMemo = new Map<string, Promise<PatreonPattern[]>>();
  let index = 0;

  const worker = async () => {
    while (index < patterns.length) {
      const currentIndex = index++;
      const pattern = patterns[currentIndex];

      // Only fetch content for Patreon URLs
      if (!pattern.url.includes('patreon.com/posts/')) {
        outputs[currentIndex] = [pattern];
        continue;
      }

      const existing = downloadMemo.get(pattern.url);
      if (existing) {
        outputs[currentIndex] = await existing;
        continue;
      }

      const downloadPromise = (async (): Promise<PatreonPattern[]> => {
        try {
          logger.info({ url: pattern.url }, 'Fetching Patreon post content');
          const result = await downloadPost(pattern.url, pattern.creator);

          if (result.success && result.files && result.files.length > 0) {
            // Create patterns from downloaded files
            const filePatterns = filesToPatternsImpl(result.files, {
              id: pattern.id,
              title: pattern.title,
              publishDate: pattern.publishDate,
              creator: pattern.creator,
            });
            return filePatterns.length > 0 ? filePatterns : [pattern];
          }

          // Keep original pattern if download failed or no files
          return [pattern];
        } catch (error) {
          logError('Patreon', error, { url: pattern.url });
          return [pattern];
        }
      })();

      downloadMemo.set(pattern.url, downloadPromise);
      outputs[currentIndex] = await downloadPromise;
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, patterns.length) }, () => worker());
  await Promise.all(workers);

  return outputs.flat();
}

/**
 * Convert downloaded post to patterns
 */
export function downloadedPostToPatterns(post: DownloadedPost): PatreonPattern[] {
  return filesToPatterns(post.files, {
    id: `dl-${post.postId}`,
    title: post.title,
    publishDate: post.publishDate || new Date().toISOString(),
    creator: post.creator,
  });
}

/**
 * Convert video to pattern
 */
export function videoToPattern(video: Video, creatorName: string): PatreonPattern {
  const text = `${video.title} ${video.description}`;
  const topics = detectTopics(text, patreonTopicKeywords);
  const hasCode = hasCodeContent(video.description) || (video.codeLinks?.length ?? 0) > 0;
  const relevanceScore = calculateRelevance(text, hasCode, patreonQualitySignals, PATREON_BASE_SCORE, PATREON_CODE_BONUS);

  return {
    id: `yt-${video.id}`,
    title: video.title,
    url: video.patreonLink || `https://youtube.com/watch?v=${video.id}`,
    publishDate: video.publishedAt,
    excerpt: video.description.substring(0, PATREON_EXCERPT_LENGTH),
    content: video.description,
    creator: creatorName,
    topics,
    relevanceScore,
    hasCode,
  };
}

/**
 * Get patterns from downloaded content
 */
export function getDownloadedPatterns(query: string, profile?: QueryProfile): PatreonPattern[] {
  try {
    const posts = scanDownloadedContent();
    if (posts.length === 0) return [];

    const queryProfile = profile ?? buildQueryProfile(query);
    const patterns = posts.flatMap(post => downloadedPostToPatterns(post));
    const ranked = rankPatternsForQuery(
      patterns,
      queryProfile,
      pattern => `${pattern.title} ${pattern.excerpt} ${pattern.content} ${pattern.topics.join(' ')}`,
      { fallbackToOriginal: false }
    );
    const deduped = dedupePatterns(ranked, 'keep-first');

    const maxDownloadedResults = getPositiveIntEnv(
      'PATREON_MAX_DOWNLOADED_RESULTS',
      PATREON_DOWNLOADED_RESULTS_LIMIT
    );
    return deduped.slice(0, maxDownloadedResults);
  } catch (error) {
    logError('Patreon', error, { query, source: 'downloaded-content' });
    return [];
  }
}
