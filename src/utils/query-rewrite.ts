// src/utils/query-rewrite.ts
// NLP-assisted extraction of high-signal query phrases.

import nlp from 'compromise';

interface NlpTerm {
  text: string;
  tags?: string[];
}

interface NlpSentence {
  terms?: NlpTerm[];
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
  try {
    const doc = nlp(query);
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
