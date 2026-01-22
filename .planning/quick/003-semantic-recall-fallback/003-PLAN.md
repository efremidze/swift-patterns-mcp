---
phase: quick
plan: 003
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/semantic-recall.ts
  - src/utils/semantic-recall.test.ts
  - src/config/sources.ts
  - src/tools/handlers/searchSwiftContent.ts
autonomous: true

must_haves:
  truths:
    - "Semantic recall only activates when MiniSearch score is below threshold"
    - "Only high-quality patterns (relevanceScore >= 70) are indexed"
    - "Embeddings are cached via FileCache keyed by pattern.id + contentHash"
    - "Default config has semanticRecall.enabled = false (opt-in)"
    - "Cosine similarity is used for vector comparison"
  artifacts:
    - path: "src/utils/semantic-recall.ts"
      provides: "SemanticRecallIndex class with index() and search() methods"
      exports: ["SemanticRecallIndex", "SemanticRecallConfig"]
    - path: "src/utils/semantic-recall.test.ts"
      provides: "Unit tests for semantic recall functionality"
      min_lines: 100
    - path: "src/config/sources.ts"
      provides: "Extended SourceConfig with semanticRecall settings"
      contains: "semanticRecall"
  key_links:
    - from: "src/tools/handlers/searchSwiftContent.ts"
      to: "src/utils/semantic-recall.ts"
      via: "conditional import and fallback invocation"
      pattern: "semanticRecallIndex\\.(search|index)"
---

<objective>
Implement selective semantic recall as a fallback mechanism when lexical search (MiniSearch) returns low-confidence results.

Purpose: Improve search recall for conceptually similar patterns when exact keyword matches fail, without replacing the deterministic lexical search.

Output: `src/utils/semantic-recall.ts` with embedding-based search, integrated into searchSwiftContent handler as opt-in fallback.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/utils/search.ts
@src/utils/cache.ts
@src/utils/intent-cache.ts
@src/sources/free/rssPatternSource.ts
@src/tools/handlers/searchSwiftContent.ts
@src/config/sources.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add semanticRecall config to SourceConfig</name>
  <files>src/config/sources.ts</files>
  <action>
    Extend the SourceConfig interface and DEFAULT_CONFIG with semantic recall settings:

    ```typescript
    // Add to SourceConfig interface
    semanticRecall?: {
      enabled: boolean;
      minLexicalScore: number;  // MiniSearch score threshold below which semantic recall activates
      minRelevanceScore: number; // Minimum pattern relevanceScore to index (quality filter)
    };

    // Add to DEFAULT_CONFIG
    semanticRecall: {
      enabled: false,
      minLexicalScore: 0.35,
      minRelevanceScore: 70,
    },

    // Add to sourceConfigSchema
    semanticRecall: z.object({
      enabled: z.boolean(),
      minLexicalScore: z.number(),
      minRelevanceScore: z.number(),
    }).optional(),
    ```

    Add methods to SourceManager:
    - `getSemanticRecallConfig()`: Returns semanticRecall config with defaults
    - `isSemanticRecallEnabled()`: Returns boolean
  </action>
  <verify>
    Run `npm run build` - no TypeScript errors.
    Run existing tests `npm test -- src/config/sources.test.ts` - all pass.
  </verify>
  <done>
    SourceConfig has semanticRecall settings with sensible defaults.
    SourceManager can retrieve semantic recall configuration.
    Default is disabled (opt-in).
  </done>
</task>

<task type="auto">
  <name>Task 2: Create SemanticRecallIndex implementation</name>
  <files>src/utils/semantic-recall.ts</files>
  <action>
    Create `src/utils/semantic-recall.ts` implementing the semantic recall system:

    **Imports:**
    - `@xenova/transformers` for embeddings (pipeline, env)
    - `ml-distance` for cosine similarity
    - `FileCache` from `./cache.js`
    - `createHash` from crypto
    - `BasePattern` type from `../sources/free/rssPatternSource.js`

    **Configuration:**
    ```typescript
    export interface SemanticRecallConfig {
      enabled: boolean;
      minLexicalScore: number;
      minRelevanceScore: number;
    }

    export const DEFAULT_CONFIG: SemanticRecallConfig = {
      enabled: false,
      minLexicalScore: 0.35,
      minRelevanceScore: 70,
    };
    ```

    **Interface (as specified):**
    ```typescript
    export interface SemanticRecallIndex {
      index(patterns: BasePattern[]): Promise<void>;
      search(query: string, limit: number): Promise<BasePattern[]>;
    }
    ```

    **Content extraction function:**
    ```typescript
    function extractIndexableContent(pattern: BasePattern): string {
      // Extract: title, first 500 chars of excerpt (summary), code comments
      // Do NOT include: full content, raw RSS data
      // Return concatenated text for embedding
    }
    ```

    **Content hash function:**
    ```typescript
    function getContentHash(pattern: BasePattern): string {
      // SHA-256 hash of title + excerpt (first 500 chars)
      // Used for cache key: `${pattern.id}::${contentHash}`
    }
    ```

    **SemanticRecallIndex class:**
    ```typescript
    export class SemanticRecallIndex implements SemanticRecallIndex {
      private embeddings: Map<string, Float32Array> = new Map();
      private patternMap: Map<string, BasePattern> = new Map();
      private cache: FileCache;
      private pipeline: any = null; // Lazy-loaded
      private config: SemanticRecallConfig;

      constructor(config: SemanticRecallConfig = DEFAULT_CONFIG) {
        this.config = config;
        this.cache = new FileCache('semantic-embeddings');
      }

      private async getEmbeddingPipeline() {
        if (!this.pipeline) {
          const { pipeline, env } = await import('@xenova/transformers');
          env.allowLocalModels = false; // Use remote models
          this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }
        return this.pipeline;
      }

      private async embed(text: string): Promise<Float32Array> {
        const pipe = await this.getEmbeddingPipeline();
        const output = await pipe(text, { pooling: 'mean', normalize: true });
        return output.data;
      }

      async index(patterns: BasePattern[]): Promise<void> {
        // 1. Filter: only patterns with relevanceScore >= config.minRelevanceScore
        // 2. For each pattern:
        //    a. Check cache for embedding keyed by `${pattern.id}::${contentHash}`
        //    b. If cached, load embedding
        //    c. If not cached, compute embedding and cache it
        // 3. Store in this.embeddings and this.patternMap
      }

      async search(query: string, limit: number): Promise<BasePattern[]> {
        // 1. Embed the query
        // 2. Compute cosine similarity against all indexed embeddings
        // 3. Sort by similarity descending
        // 4. Return top `limit` patterns
      }
    }
    ```

    **Cosine similarity:**
    Use `ml-distance` library: `import { similarity } from 'ml-distance';`
    `similarity.cosine(vecA, vecB)`

    **Cache key format:** `embedding::${pattern.id}::${contentHash}`

    **Important considerations:**
    - Normalize embeddings before caching (model already normalizes with normalize: true)
    - Keep embeddings as Float32Array for memory efficiency
    - Lazy-load the transformer pipeline (heavy initialization)
  </action>
  <verify>
    Run `npm run build` - no TypeScript errors.
    Manually verify imports resolve: `node -e "import('./build/utils/semantic-recall.js')"`
  </verify>
  <done>
    SemanticRecallIndex class exists with:
    - index() filters patterns by minRelevanceScore, embeds title+summary+comments
    - search() returns top-K patterns by cosine similarity
    - Embeddings cached via FileCache with pattern.id + contentHash key
    - Transformer pipeline lazy-loaded
  </done>
</task>

<task type="auto">
  <name>Task 3: Integrate semantic recall into searchSwiftContent handler</name>
  <files>src/tools/handlers/searchSwiftContent.ts</files>
  <action>
    Modify searchSwiftContent.ts to use semantic recall as fallback:

    **Add imports:**
    ```typescript
    import { SemanticRecallIndex } from '../../utils/semantic-recall.js';
    import SourceManager from '../../config/sources.js';
    ```

    **Add module-level singleton:**
    ```typescript
    let semanticIndex: SemanticRecallIndex | null = null;

    function getSemanticIndex(config: SemanticRecallConfig): SemanticRecallIndex {
      if (!semanticIndex) {
        semanticIndex = new SemanticRecallIndex(config);
      }
      return semanticIndex;
    }
    ```

    **Modify handler logic:**

    After the lexical search (`searchMultipleSources`), check if semantic recall should activate:

    ```typescript
    // Get semantic recall config
    const sourceManager = new SourceManager();
    const semanticConfig = sourceManager.getSemanticRecallConfig();

    let finalResults = filtered;

    // Semantic recall fallback: only if enabled AND lexical results are weak
    if (semanticConfig.enabled && filtered.length > 0) {
      // Calculate average lexical score
      const avgScore = filtered.reduce((sum, p) => sum + p.relevanceScore, 0) / filtered.length;
      const maxScore = Math.max(...filtered.map(p => p.relevanceScore));

      // Normalize to 0-1 scale (relevanceScore is 0-100)
      const normalizedMaxScore = maxScore / 100;

      if (normalizedMaxScore < semanticConfig.minLexicalScore) {
        // Lexical results are weak - try semantic recall
        const index = getSemanticIndex(semanticConfig);

        // Index all high-quality patterns (this is cached, so cheap after first call)
        const allPatterns = await getAllPatternsForSemanticIndex();
        await index.index(allPatterns);

        // Search semantically
        const semanticResults = await index.search(query, 5);

        // Merge conservatively: semantic results as supplement, not replacement
        // Add semantic results not already in filtered
        const existingIds = new Set(filtered.map(p => p.id));
        const newSemanticResults = semanticResults.filter(p => !existingIds.has(p.id));

        // Append semantic results after lexical results
        finalResults = [...filtered, ...newSemanticResults];

        // Re-apply relevance filter and re-sort
        finalResults = finalResults
          .filter(p => p.relevanceScore >= semanticConfig.minRelevanceScore)
          .sort((a, b) => b.relevanceScore - a.relevanceScore);
      }
    }
    ```

    **Helper function to get all patterns:**
    ```typescript
    async function getAllPatternsForSemanticIndex(): Promise<BasePattern[]> {
      const sources = getSources('all');
      const results = await Promise.allSettled(
        sources.map(source => source.fetchPatterns())
      );
      return results
        .filter((r): r is PromiseFulfilledResult<BasePattern[]> => r.status === 'fulfilled')
        .flatMap(r => r.value);
    }
    ```

    **Important:** The semantic recall should NOT change the caching behavior. The intentCache continues to work as before - it caches the final combined results.
  </action>
  <verify>
    Run `npm run build` - no TypeScript errors.
    Run handler tests: `npm test -- src/tools/handlers/handlers.test.ts` - all pass.
    Verify default behavior unchanged: With semanticRecall.enabled = false, search works exactly as before.
  </verify>
  <done>
    searchSwiftContent handler:
    - Checks if semantic recall is enabled in config
    - Only activates semantic fallback when lexical score < minLexicalScore threshold
    - Merges semantic results conservatively (supplement, not replace)
    - Re-applies relevance filters after merge
    - Default behavior unchanged when disabled
  </done>
</task>

<task type="auto">
  <name>Task 4: Create comprehensive unit tests</name>
  <files>src/utils/semantic-recall.test.ts</files>
  <action>
    Create `src/utils/semantic-recall.test.ts` with comprehensive tests:

    **Test structure:**
    ```typescript
    import { describe, it, expect, beforeEach, vi } from 'vitest';
    import { SemanticRecallIndex, DEFAULT_CONFIG } from './semantic-recall.js';
    import type { BasePattern } from '../sources/free/rssPatternSource.js';

    // Mock patterns for testing
    function createMockPattern(overrides: Partial<BasePattern> = {}): BasePattern {
      return {
        id: `pattern-${Math.random().toString(36).substr(2, 9)}`,
        title: 'Test Pattern',
        url: 'https://example.com/test',
        publishDate: '2024-01-01',
        excerpt: 'A test excerpt about Swift programming.',
        content: 'Full content here...',
        topics: ['swift', 'testing'],
        relevanceScore: 75,
        hasCode: true,
        ...overrides,
      };
    }
    ```

    **Test cases:**

    1. **Config defaults**
       - DEFAULT_CONFIG has enabled = false
       - DEFAULT_CONFIG has minLexicalScore = 0.35
       - DEFAULT_CONFIG has minRelevanceScore = 70

    2. **Pattern filtering during index()**
       - Only indexes patterns with relevanceScore >= minRelevanceScore
       - Skips patterns below threshold
       - Handles empty pattern array

    3. **Content extraction**
       - Extracts title and excerpt only (not full content)
       - Handles missing excerpt gracefully
       - Truncates long excerpts

    4. **Embedding caching**
       - Caches embeddings keyed by pattern.id + contentHash
       - Returns cached embedding on subsequent index() calls
       - Different content produces different cache key

    5. **Search behavior**
       - Returns top-K patterns by similarity
       - Returns empty array when no patterns indexed
       - Handles query with no matches

    6. **Cosine similarity**
       - Higher similarity scores rank higher
       - Identical queries produce highest similarity

    **Note:** Some tests may need to mock the transformer pipeline to avoid slow model loading. Use vitest mocking:
    ```typescript
    vi.mock('@xenova/transformers', () => ({
      pipeline: vi.fn().mockResolvedValue(async (text: string) => ({
        data: new Float32Array(384).fill(0.1) // Mock embedding
      })),
      env: { allowLocalModels: false },
    }));
    ```
  </action>
  <verify>
    Run `npm test -- src/utils/semantic-recall.test.ts` - all tests pass.
    Check test coverage includes: config, filtering, caching, search ranking.
  </verify>
  <done>
    Comprehensive test suite covering:
    - Config defaults and validation
    - Pattern filtering by relevance score
    - Content extraction logic
    - Embedding cache behavior
    - Search ranking by cosine similarity
    - Edge cases (empty arrays, missing data)
  </done>
</task>

<task type="auto">
  <name>Task 5: Add integration test for semantic fallback</name>
  <files>src/utils/semantic-recall.test.ts</files>
  <action>
    Add integration tests to semantic-recall.test.ts that verify the fallback behavior:

    **Integration tests:**

    1. **Fallback activation threshold**
       - Given: Lexical results with max score below minLexicalScore
       - When: Semantic recall is enabled
       - Then: Semantic results are appended

    2. **No fallback when lexical is strong**
       - Given: Lexical results with max score above minLexicalScore
       - When: Semantic recall is enabled
       - Then: Only lexical results returned (no semantic search)

    3. **Disabled by default**
       - Given: Default config
       - When: Search is performed
       - Then: No semantic recall runs (can verify by checking index never called)

    4. **Conservative merge**
       - Given: Lexical returns patterns A, B
       - Given: Semantic returns patterns B, C
       - Then: Result contains A, B, C (B not duplicated)

    5. **Relevance filter after merge**
       - Given: Semantic returns low-relevance pattern (< minRelevanceScore)
       - Then: Low-relevance patterns filtered out after merge

    **Mock approach for integration tests:**
    Create test doubles that track calls:
    ```typescript
    describe('semantic recall fallback integration', () => {
      it('should not activate when disabled', async () => {
        const index = new SemanticRecallIndex({ ...DEFAULT_CONFIG, enabled: false });
        const indexSpy = vi.spyOn(index, 'index');

        // Simulate handler logic with disabled config
        // ...

        expect(indexSpy).not.toHaveBeenCalled();
      });
    });
    ```
  </action>
  <verify>
    Run `npm test -- src/utils/semantic-recall.test.ts` - all tests pass including integration tests.
  </verify>
  <done>
    Integration tests verify:
    - Fallback only activates when lexical score is weak AND enabled
    - Default disabled behavior is preserved
    - Merge is conservative (no duplicates)
    - Final relevance filter is applied
  </done>
</task>

</tasks>

<verification>
After all tasks complete:

1. **Build verification:**
   ```bash
   npm run build
   ```

2. **Test verification:**
   ```bash
   npm test
   ```

3. **Manual verification (optional):**
   - Enable semantic recall in config
   - Search for conceptual query that lexical might miss
   - Verify semantic results appear when lexical is weak

4. **Lint check:**
   ```bash
   npm run lint
   ```
</verification>

<success_criteria>
- [ ] src/utils/semantic-recall.ts exists with SemanticRecallIndex class
- [ ] SemanticRecallIndex.index() filters by relevanceScore >= 70
- [ ] SemanticRecallIndex.index() only embeds title + excerpt (not full content)
- [ ] Embeddings cached via FileCache with pattern.id + contentHash key
- [ ] SemanticRecallIndex.search() returns patterns sorted by cosine similarity
- [ ] src/config/sources.ts has semanticRecall config with enabled: false default
- [ ] searchSwiftContent.ts uses semantic recall as fallback when enabled AND lexical weak
- [ ] Conservative merge: semantic supplements lexical, doesn't replace
- [ ] All existing tests pass (455+)
- [ ] New semantic-recall tests pass
- [ ] npm run build succeeds
- [ ] npm run lint succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/003-semantic-recall-fallback/003-SUMMARY.md`
</output>
