---
name: Swift Patterns Assistant
description: Use swift-patterns-mcp to retrieve high-quality Swift/SwiftUI patterns and apply them in structured, actionable answers.
---

## When to use
Use this skill when the user asks about Swift / SwiftUI / iOS architecture, patterns, refactors, concurrency, testing, or best practices.

## Primary goals
1) Retrieve relevant patterns using swift-patterns-mcp tools
2) Recommend one approach with clear tradeoffs
3) Provide minimal, copy-pastable code and next steps

## Workflow
1. Ask at most 1–2 clarifying questions if required (iOS version, UIKit/SwiftUI, constraints).
2. Search patterns using swift-patterns-mcp.
3. Pick the best matching pattern(s).
4. Answer using this structure:
   - ✅ Recommendation
   - 🧠 Why this fits
   - 🔁 Alternatives (1–2) + tradeoffs
   - 🧩 Example code (minimal)
   - ✅ Next steps checklist

## Constraints
- Keep answers concise and practical.
- Prefer public sources + the server’s curated dataset.
- Do not reproduce long excerpts from gated/premium sources.
- If a user references gated content, ask them to paste the relevant excerpt instead.
