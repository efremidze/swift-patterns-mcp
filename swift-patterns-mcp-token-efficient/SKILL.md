---

name: swift-patterns-mcp-token-efficient
description: Use swift-patterns-mcp MCP tools in a token-efficient way: search narrowly, return only top results, keep excerpts short, summarize and apply patterns instead of dumping text.
metadata:
short-description: Token-efficient Swift/SwiftUI pattern retrieval
------------------------------------------------------------------

# swift-patterns-mcp (Token-Efficient Mode)

## Purpose

Use this skill when you want **high-signal Swift / SwiftUI / iOS best practices** while minimizing tokens.

This skill prioritizes:

* ✅ top 1–3 results (not 10)
* ✅ short excerpts (not long dumps)
* ✅ applied recommendations (not copied text)
* ✅ minimal formatting + minimal metadata

---

## When to Use

Use this skill if:

* you’re in an agent workflow with limited context budget
* you want a fast answer + a concrete recommendation
* you’re doing iterative work (small loops) and don’t want huge responses

---

## Core Behavior Rules (Must Follow)

### 1) Narrow the search first

Prefer **very specific queries** instead of broad topics.

✅ Good:

* “swiftui navigation stack deep link”
* “asyncstream cancellation best practice”
* “swift dependency injection protocol mock”

❌ Bad:

* “swiftui navigation”
* “swift concurrency”
* “testing”

---

### 2) Return fewer results

**Default: return only the top 3 matches.**
If the user asks for more, expand to 5 max.

---

### 3) Keep excerpts short

Never paste long text blocks.

* Prefer excerpts around **120–200 characters**
* Only include a slightly longer excerpt if the user explicitly asks for “quote it” or “show the excerpt”

---

### 4) Summarize + apply patterns

Always transform retrieved patterns into action.

Your output must be structured like:

1. ✅ Recommendation (1 sentence)
2. Why (max 3 bullets)
3. Implementation / next step (code or checklist)
4. Tradeoff (1 short line, optional)

---

### 5) Prefer code over prose (but keep it small)

When helpful, show minimal code:

✅ Do:

* 15–40 lines max for examples
* focus on the core technique only

❌ Don’t:

* entire files
* multiple variants unless requested
* long explanations before code

---

## Response Templates

### Template A — Quick pattern answer

**Recommendation:** <1 sentence>

**Why:**

* <bullet>
* <bullet>
* <bullet>

**Example:**

```swift
// minimal example
```

**Tradeoff:** <1 line>

---

### Template B — Compare two approaches (tiny)

**Pick:** Approach A ✅

**Reason:**

* <bullet>
* <bullet>

**Avoid B if:**

* <bullet>

---

## Escalation Rules (When to spend more tokens)

Only provide more detail if:

* user asks for deeper explanation
* user asks for “show more options”
* the first 1–2 patterns disagree or are unclear
* implementation depends on constraints (iOS version, UIKit vs SwiftUI, app architecture)

---

## Success Checklist

Before responding, confirm:

* [ ] I limited results to 1–3 by default
* [ ] I avoided long excerpts
* [ ] I summarized and applied the pattern
* [ ] I gave an actionable next step (code or checklist)
