/**
 * Shared fetch implementation using Node.js global fetch.
 */

export const fetch = globalThis.fetch.bind(globalThis);
