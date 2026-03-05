// src/utils/query-rewrite.ts
// NLP-assisted extraction of high-signal query phrases.

import nlp from 'compromise';
import { normalizeTokens } from './search-terms.js';

interface NlpTerm {
  text: string;
  tags?: string[];
}

interface NlpSentence {
  terms?: NlpTerm[];
}

const CONVERSATIONAL_PREFIXES: RegExp[] = [
  /^\s*i\s+want\s+to\s+/i,
  /^\s*can\s+you\s+/i,
  /^\s*help\s+me\s+/i,
  /^\s*please\s+/i,
  /^\s*(?:build|create|make)\s+/i,
];

const INSTRUCTIONAL_HINTS: RegExp[] = [
  /\(\s*use\s+patreon\s*\)/ig,
  /\buse\s+patreon\b/ig,
  /\busing\s+patreon\b/ig,
  /\bon\s+patreon\b/ig,
];

function stripInstructionalNoise(query: string): string {
  let cleaned = query;

  for (const hint of INSTRUCTIONAL_HINTS) {
    cleaned = cleaned.replace(hint, ' ');
  }

  cleaned = cleaned.replace(/[()]/g, ' ');

  for (const prefix of CONVERSATIONAL_PREFIXES) {
    cleaned = cleaned.replace(prefix, '');
  }

  return cleaned.replace(/\s+/g, ' ').trim();
}

function hasTag(term: NlpTerm, tag: string): boolean {
  return Array.isArray(term.tags) && term.tags.includes(tag);
}

function isKeywordTerm(term: NlpTerm): boolean {
  if (hasTag(term, 'Pronoun') || hasTag(term, 'Determiner') || hasTag(term, 'Conjunction')) {
    return false;
  }

  return (
    hasTag(term, 'Noun') ||
    hasTag(term, 'ProperNoun') ||
    hasTag(term, 'Acronym') ||
    hasTag(term, 'Adjective')
  );
}

/**
 * Extract keyword-focused phrases from a conversational query.
 * Returns phrases sorted by specificity (word count, then length).
 */
export function extractNlpKeywordPhrases(query: string): string[] {
  const sanitizedQuery = stripInstructionalNoise(query);
  if (!sanitizedQuery) return [];

  try {
    const doc = nlp(sanitizedQuery);
    const json = doc.json() as unknown as NlpSentence[];
    const phrases: string[] = [];
    const seen = new Set<string>();

    const push = (value: string): void => {
      const phrase = value.trim().replace(/\s+/g, ' ');
      if (!phrase) return;
      const key = phrase.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      phrases.push(phrase);
    };

    const terms = json.flatMap(sentence => sentence.terms ?? []);
    const current: string[] = [];

    const flush = (): void => {
      if (current.length === 0) return;
      push(current.join(' '));
      current.length = 0;
    };

    for (const term of terms) {
      if (isKeywordTerm(term)) {
        current.push(term.text);
      } else {
        flush();
      }
    }
    flush();

    // Enrich with noun chunks from compromise for broader phrase coverage.
    const nounChunks = doc.nouns().out('array');
    for (const chunk of nounChunks) {
      push(chunk);
    }

    return phrases
      .map(p => p.replace(/[()]/g, '').trim())
      .map(p => p.replace(/^(?:a|an|the)\s+/i, ''))
      .filter(p => p.length > 1 && p.toLowerCase() !== 'i')
      .sort((a, b) => {
        const byWordCount = b.split(' ').length - a.split(' ').length;
        if (byWordCount !== 0) return byWordCount;
        return b.length - a.length;
      });
  } catch {
    return [];
  }
}

/**
 * Extract short intent facets from broad prompts so retrieval can query each sub-intent.
 */
export function extractNlpIntentFacets(query: string): string[] {
  const sanitizedQuery = stripInstructionalNoise(query);
  if (!sanitizedQuery) return [];

  const facets: string[] = [];
  const seen = new Set<string>();

  const push = (value: string): void => {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) return;

    const tokenized = normalizeTokens(normalized);
    if (tokenized.length < 2) return;

    const phrase = tokenized.join(' ');
    if (phrase.length < 4) return;

    if (seen.has(phrase)) return;
    seen.add(phrase);
    facets.push(phrase);
  };

  // Explicit list-like prompts: "x, y and z", "x / y / z", etc.
  const explicitSegments = sanitizedQuery
    .split(/\s*(?:,|\/|\+|&|\band\b|\bthen\b)\s*/i)
    .map(segment => segment.trim())
    .filter(Boolean);
  for (const segment of explicitSegments) {
    push(segment);
  }

  try {
    const doc = nlp(sanitizedQuery);
    const nounChunks = doc.nouns().out('array');
    for (const nounChunk of nounChunks) {
      push(nounChunk);
    }
  } catch {
    // Ignore NLP failures and continue with token-window fallback.
  }

  // Long noun-heavy prompts benefit from compact token windows (multi-intent decomposition).
  const tokens = normalizeTokens(sanitizedQuery);
  if (tokens.length >= 6) {
    const chunkSize = 3;
    const step = 2;
    for (let index = 0; index < tokens.length; index += step) {
      const chunk = tokens.slice(index, index + chunkSize);
      if (chunk.length >= 2) {
        push(chunk.join(' '));
      }
    }
  }

  return facets.slice(0, 8);
}
