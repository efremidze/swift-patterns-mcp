/**
 * Shared fetch implementation using Node.js global fetch.
 * Provides a mockable seam for tests.
 */

export const fetch = globalThis.fetch.bind(globalThis);
