/**
 * Concurrency utilities for parallel processing
 */

/**
 * Run async operations with a concurrency limit
 * @param items - Array of items to process
 * @param limit - Maximum number of concurrent operations (must be positive finite number)
 * @param worker - Function to process each item
 * @returns Promise resolving to array of results in same order as input
 * @throws Error if limit is not a positive finite number
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  // Validate limit is a positive finite number
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isInteger(limit)) {
    throw new Error(
      `Invalid concurrency limit: ${limit}. Must be a positive finite integer, got ${typeof limit === 'number' ? limit : typeof limit}`
    );
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      try {
        results[currentIndex] = await worker(items[currentIndex]);
      } catch (error) {
        // Store error in results - worker function should handle errors appropriately
        // but we don't want to break the entire batch
        throw error;
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runWorker()
  );
  
  await Promise.all(workers);
  return results;
}
