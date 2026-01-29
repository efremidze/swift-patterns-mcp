// src/utils/inflight-dedup.ts
// Simple helper for in-flight promise deduplication

export class InflightDeduper<K, V> {
  private inflight = new Map<K, Promise<V>>();

  run(key: K, task: () => Promise<V>): Promise<V> {
    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = task().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }
}
