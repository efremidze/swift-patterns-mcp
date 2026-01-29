/**
 * Centralized source registry to eliminate duplication in handlers
 */

import type { BasePattern } from '../sources/free/rssPatternSource.js';
import SundellSource from '../sources/free/sundell.js';
import VanderLeeSource from '../sources/free/vanderlee.js';
import NilCoalescingSource from '../sources/free/nilcoalescing.js';
import PointFreeSource from '../sources/free/pointfree.js';
import { InflightDeduper } from './inflight-dedup.js';

export type FreeSourceName = 'sundell' | 'vanderlee' | 'nilcoalescing' | 'pointfree';

interface FreeSource {
  searchPatterns(query: string): Promise<BasePattern[]>;
  fetchPatterns(): Promise<BasePattern[]>;
}

/**
 * Map of source names to their classes
 */
const SOURCE_CLASSES = {
  sundell: SundellSource,
  vanderlee: VanderLeeSource,
  nilcoalescing: NilCoalescingSource,
  pointfree: PointFreeSource,
} as const;

/**
 * Singleton cache for source instances
 * Keeps search indexes warm across calls
 */
const sourceInstanceCache = new Map<FreeSourceName, FreeSource>();

/** In-flight dedup for fetchPatterns calls, keyed by source name */
const fetchInflight = new InflightDeduper<FreeSourceName, BasePattern[]>();

/** In-flight dedup for searchPatterns calls, keyed by "sourceName::query" */
const searchInflight = new InflightDeduper<string, BasePattern[]>();

function dedupFetch(name: FreeSourceName, source: FreeSource): Promise<BasePattern[]> {
  return fetchInflight.run(name, () => source.fetchPatterns());
}

function dedupSearch(name: FreeSourceName, source: FreeSource, query: string): Promise<BasePattern[]> {
  const key = `${name}::${query}`;
  return searchInflight.run(key, () => source.searchPatterns(query));
}

/**
 * Get a source instance by name (singleton)
 */
export function getSource(name: FreeSourceName): FreeSource {
  const cached = sourceInstanceCache.get(name);
  if (cached) return cached;

  const SourceClass = SOURCE_CLASSES[name];
  const instance = new SourceClass() as FreeSource;
  sourceInstanceCache.set(name, instance);
  return instance;
}

/**
 * Get all free source instances
 */
export function getAllFreeSources(): FreeSource[] {
  return Object.keys(SOURCE_CLASSES).map(name => getSource(name as FreeSourceName));
}

/**
 * Get source instances by name(s)
 * @param sourceNames - Array of source names, or 'all' for all sources
 */
export function getSources(sourceNames: FreeSourceName | 'all' | FreeSourceName[]): FreeSource[] {
  if (sourceNames === 'all') {
    return getAllFreeSources();
  }

  if (Array.isArray(sourceNames)) {
    return sourceNames.map(name => getSource(name));
  }

  return [getSource(sourceNames)];
}

/**
 * Get source names for a given source parameter
 * Used for intent cache key generation
 */
export function getSourceNames(sourceNames: FreeSourceName | 'all' | FreeSourceName[]): string[] {
  if (sourceNames === 'all') {
    return Object.keys(SOURCE_CLASSES);
  }

  if (Array.isArray(sourceNames)) {
    return sourceNames;
  }

  return [sourceNames];
}

/**
 * Search multiple sources and combine results
 * Uses Promise.allSettled to collect partial results even if some sources fail
 */
export async function searchMultipleSources(
  query: string,
  sourceNames: FreeSourceName | 'all' | FreeSourceName[] = 'all'
): Promise<BasePattern[]> {
  const names = getSourceNames(sourceNames) as FreeSourceName[];
  const results = await Promise.allSettled(
    names.map(name => dedupSearch(name, getSource(name), query))
  );

  // Collect successful results, skip failed sources
  return results
    .filter((result): result is PromiseFulfilledResult<BasePattern[]> => result.status === 'fulfilled')
    .flatMap(result => result.value);
}

/**
 * Prefetch all sources to warm up caches and search indexes
 * Call this on startup when prefetchSources is enabled
 * @returns Results of prefetch operations for all sources
 */
export async function prefetchAllSources(): Promise<PromiseSettledResult<BasePattern[]>[]> {
  const names = Object.keys(SOURCE_CLASSES) as FreeSourceName[];

  const results = await Promise.allSettled(
    names.map(name => dedupFetch(name, getSource(name)))
  );
  const sourceNames = names as string[];

  // Log summary of results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`Prefetch complete: ${successful} succeeded, ${failed} failed`);

  // Log failed sources for debugging
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Failed to prefetch ${sourceNames[index]}:`, result.reason);
    }
  });

  return results;
}

/**
 * Fetch all patterns from specified sources.
 * Uses Promise.allSettled to collect partial results even if some sources fail.
 * @param sourceIds - Optional array of source IDs to fetch from. Defaults to all sources.
 */
export async function fetchAllPatterns(
  sourceIds?: FreeSourceName[]
): Promise<BasePattern[]> {
  const names = sourceIds ?? (Object.keys(SOURCE_CLASSES) as FreeSourceName[]);

  const results = await Promise.allSettled(
    names.map(name => dedupFetch(name, getSource(name)))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<BasePattern[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}
