---
phase: quick-002
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/pattern-formatter.ts
  - src/utils/swift-analysis.ts
autonomous: true

must_haves:
  truths:
    - "Pattern output includes descriptive title extracted from content"
    - "Pattern output shows 1-2 actual code snippets when available"
    - "Pattern output lists specific Swift techniques/APIs mentioned"
    - "Pattern output indicates complexity level"
    - "Excerpts end at sentence boundaries, not mid-word"
  artifacts:
    - path: "src/utils/pattern-formatter.ts"
      provides: "Enhanced formatPattern function with rich output"
      exports: ["formatPattern", "formatPatterns", "formatTopicPatterns", "formatSearchPatterns"]
    - path: "src/utils/swift-analysis.ts"
      provides: "Content extraction utilities"
      exports: ["detectTopics", "hasCodeContent", "calculateRelevance", "extractCodeSnippets", "extractTechniques", "detectComplexity", "extractDescriptiveTitle", "truncateAtSentence"]
  key_links:
    - from: "src/utils/pattern-formatter.ts"
      to: "src/utils/swift-analysis.ts"
      via: "imports extraction utilities"
      pattern: "import.*from.*swift-analysis"
---

<objective>
Enhance MCP response format to provide AI agents with richer, more actionable pattern information.

Purpose: Current responses have generic titles, no code snippets, broad topics, and truncated excerpts. AI agents need descriptive titles, actual code examples, specific techniques, complexity indicators, and clean excerpts to make informed decisions.

Output: Updated `pattern-formatter.ts` with enhanced formatting and new extraction utilities in `swift-analysis.ts`.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/utils/pattern-formatter.ts
@src/utils/swift-analysis.ts
@src/sources/free/rssPatternSource.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add content extraction utilities to swift-analysis.ts</name>
  <files>src/utils/swift-analysis.ts</files>
  <action>
Add four new exported functions to `swift-analysis.ts`:

1. `extractCodeSnippets(content: string, maxSnippets?: number): string[]`
   - Extract code from markdown code blocks (```swift or ```)
   - Extract code from HTML <pre><code> blocks
   - Return up to maxSnippets (default 2) snippets
   - Truncate each snippet to ~10 lines max
   - Skip empty or trivial snippets (< 2 lines)

2. `extractTechniques(content: string): string[]`
   - Match Swift-specific APIs/patterns: `@Observable`, `async/await`, `Task {}`, `withCheckedContinuation`, `@MainActor`, `Sendable`, `actor`, `@State`, `@Binding`, `@Environment`, `NavigationStack`, `@Query`, `@Model`, etc.
   - Match framework names when used in code context: SwiftUI, Combine, SwiftData, CoreData, UIKit
   - Return unique array, max 5 techniques
   - More specific than topics (e.g., "async/await" not just "concurrency")

3. `detectComplexity(content: string, topics: string[]): 'beginner' | 'intermediate' | 'advanced'`
   - beginner: basic syntax, simple examples, "introduction", "getting started", single concept
   - intermediate: multiple concepts combined, real-world patterns, error handling
   - advanced: performance optimization, low-level APIs, complex concurrency, custom property wrappers, macros
   - Use signals: word count, code complexity, topic count, presence of advanced keywords

4. `truncateAtSentence(text: string, maxLength: number): string`
   - Find last sentence boundary (. ! ?) before maxLength
   - If no boundary found within reasonable range (80% of maxLength), fall back to word boundary
   - Never cut mid-word
   - Return clean excerpt without trailing ellipsis (caller can add if needed)

5. `extractDescriptiveTitle(content: string, fallbackTitle: string): string`
   - Look for first H1 (# or <h1>) in content
   - If H1 is generic (e.g., contains only source name like "Swift by Sundell"), try H2
   - Clean HTML tags and extra whitespace
   - Return fallbackTitle if no good heading found
  </action>
  <verify>
Run: `npm run build` - TypeScript compiles without errors
Run: `npm test` - All existing tests pass (no regressions)
  </verify>
  <done>
Five new utility functions exported from swift-analysis.ts, all type-safe and documented.
  </done>
</task>

<task type="auto">
  <name>Task 2: Enhance formatPattern output in pattern-formatter.ts</name>
  <files>src/utils/pattern-formatter.ts</files>
  <action>
Update `pattern-formatter.ts` to use the new extraction utilities:

1. Add imports from swift-analysis.ts:
   ```typescript
   import { extractCodeSnippets, extractTechniques, detectComplexity, truncateAtSentence, extractDescriptiveTitle } from './swift-analysis.js';
   ```

2. Update `FormatOptions` interface - add new optional fields:
   ```typescript
   includeSnippets?: boolean;    // default: true
   includeTechniques?: boolean;  // default: true
   includeComplexity?: boolean;  // default: true
   maxSnippets?: number;         // default: 1
   ```

3. Update `formatPattern` function:
   - Extract descriptive title: `extractDescriptiveTitle(pattern.content, pattern.title)`
   - Use `truncateAtSentence(pattern.excerpt, opts.excerptLength)` instead of substring
   - Add complexity badge: `**Complexity**: intermediate`
   - Replace `**Code**: checkmark` with actual snippet(s) when `includeSnippets: true`:
     ```
     **Code Example**:
     ```swift
     // actual code here
     ```
     ```
   - Add techniques line: `**Techniques**: @Observable, async/await, Task`
   - Keep existing fields (Source, Quality, Topics) working as before

4. Update `formatTopicPatterns` to enable new options by default
5. Update `formatSearchPatterns` to enable new options by default

Maintain backward compatibility:
- All existing FormatOptions fields work unchanged
- Default behavior should be enhanced (new fields default to true)
- Callers can disable new features by passing false
  </action>
  <verify>
Run: `npm run build` - compiles without errors
Run: `npm test` - all 393 tests pass
Manual: Check formatted output in development shows richer information
  </verify>
  <done>
formatPattern produces output with:
- Descriptive title (not just "Newsletter 109")
- Actual code snippet(s) instead of checkmark
- Specific techniques listed
- Complexity level indicator
- Sentence-boundary excerpts
  </done>
</task>

<task type="auto">
  <name>Task 3: Add unit tests for new extraction utilities</name>
  <files>src/utils/__tests__/swift-analysis.test.ts</files>
  <action>
Create or extend test file for swift-analysis.ts utilities:

Test `extractCodeSnippets`:
- Extracts markdown code blocks (```swift ... ```)
- Extracts generic code blocks (``` ... ```)
- Extracts HTML code blocks (<pre><code>...</code></pre>)
- Respects maxSnippets limit
- Truncates long snippets
- Returns empty array when no code

Test `extractTechniques`:
- Detects Swift attributes (@Observable, @MainActor, @State)
- Detects concurrency patterns (async/await, Task, actor)
- Detects SwiftUI patterns (NavigationStack, @Query)
- Returns unique values
- Caps at 5 techniques

Test `detectComplexity`:
- Returns 'beginner' for simple intro content
- Returns 'intermediate' for combined concepts
- Returns 'advanced' for complex topics (macros, performance)

Test `truncateAtSentence`:
- Truncates at period
- Truncates at question mark
- Falls back to word boundary if no sentence end
- Never cuts mid-word

Test `extractDescriptiveTitle`:
- Extracts H1 from markdown
- Falls back to H2 if H1 is generic
- Returns fallback if no good title
- Cleans HTML tags
  </action>
  <verify>
Run: `npm test -- swift-analysis` - all new tests pass
Run: `npm test` - full suite passes (no regressions)
  </verify>
  <done>
Comprehensive test coverage for all five new utility functions, validating edge cases and expected behavior.
  </done>
</task>

</tasks>

<verification>
1. Build passes: `npm run build`
2. All tests pass: `npm test` (should be 393+ tests)
3. Type check passes: `npm run typecheck` (if available) or build success confirms
4. Manual verification: Run MCP server and observe enhanced output format
</verification>

<success_criteria>
- All five extraction utilities implemented and exported
- formatPattern produces enhanced output with all new fields
- All existing tests pass (backward compatibility maintained)
- New utility tests provide coverage for extraction logic
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/002-improve-mcp-response-format-for-ai-agent/002-SUMMARY.md`
</output>
