/**
 * Centralized source registry to eliminate duplication in handlers
 */

import type { BasePattern } from '../sources/free/rssPatternSource.js';
import SundellSource from '../sources/free/sundell.js';
import VanderLeeSource from '../sources/free/vanderlee.js';
import NilCoalescingSource from '../sources/free/nilcoalescing.js';
import PointFreeSource from '../sources/free/pointfree.js';

export type FreeSourceName = 'sundell' | 'vanderlee' | 'nilcoalescing' | 'pointfree';

export interface FreeSource {
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
 * Get a source instance by name
 */
export function getSource(name: FreeSourceName): FreeSource {
  const SourceClass = SOURCE_CLASSES[name];
  // Cast to FreeSource since all pattern types extend BasePattern
  return new SourceClass() as FreeSource;
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
 */
export async function searchMultipleSources(
  query: string,
  sourceNames: FreeSourceName | 'all' | FreeSourceName[] = 'all'
): Promise<BasePattern[]> {
  const sources = getSources(sourceNames);
  const results = await Promise.all(
    sources.map(source => source.searchPatterns(query))
  );
  return results.flat();
}
