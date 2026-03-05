import { describe, expect, it } from 'vitest';
import { extractNlpIntentFacets, extractNlpKeywordPhrases } from '../query-rewrite.js';

describe('query-rewrite', () => {
  it('extracts high-signal phrase from conversational prompt', () => {
    const phrases = extractNlpKeywordPhrases('i want to build a Style Resizing Floating Sheets');
    expect(phrases[0]).toBe('Style Resizing Floating Sheets');
  });

  it('drops parenthetical hints from extracted phrases', () => {
    const phrases = extractNlpKeywordPhrases('i want to build a Dynamic Island QR Code Scanner (use Patreon)');
    expect(phrases[0]).toBe('Dynamic Island QR Code Scanner');
    expect(phrases.some(p => p.toLowerCase().includes('use patreon'))).toBe(false);
  });

  it('returns empty array for empty or non-meaningful input', () => {
    expect(extractNlpKeywordPhrases('')).toEqual([]);
    expect(extractNlpKeywordPhrases('   ')).toEqual([]);
  });

  it('extracts compact intent facets from compound prompts', () => {
    const facets = extractNlpIntentFacets('build a photo editor flow PhotosPicker crop filters export share');
    expect(facets).toContain('photo editor flow');
    expect(facets).toContain('crop filters export');
    expect(facets).toContain('export share');
  });

  it('removes Patreon instruction noise from intent facets', () => {
    const facets = extractNlpIntentFacets('i want to build a Dynamic Island QR Code Scanner (use Patreon)');
    expect(facets.some(f => f.includes('patreon'))).toBe(false);
    expect(facets.some(f => f.includes('dynamic island'))).toBe(true);
  });
});
