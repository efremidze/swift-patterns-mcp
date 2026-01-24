# SwiftUI Agent Skill Inspiration

This note summarizes practical ideas from the SwiftUI Agent Skill repository and maps them to potential improvements for `swift-patterns-mcp`.

## What the SwiftUI Agent Skill emphasizes

- **Agent Skills open format**: ships a structured `SKILL.md` plus focused reference files that agents can jump into for specific topics.
- **Concise, task-oriented references**: small, topic-based guidance for state management, navigation/sheets, list performance, scrolling, modern APIs, and view structure.
- **Modern-first guidance**: highlights deprecated SwiftUI APIs and suggests up-to-date replacements.
- **Non-opinionated defaults**: focuses on correctness, practical pitfalls, and API choices rather than prescribing architecture.
- **Distribution options**: includes install steps for skills platforms (skills.sh), Claude Code plugin, and manual installation.

## Potential applications to swift-patterns-mcp

- **Offer an optional Skill package** that complements the MCP server with a `SKILL.md` + `references/` tree (e.g., `state-management.md`, `list-patterns.md`, `modern-apis.md`). This could be a separate folder in the repo or a companion repo, letting teams install it in Claude/Codex/Cursor while still using the MCP server for curated content.
- **Add concise checklists and “pitfall” sections** in docs for common SwiftUI workflows (lists, navigation, sheets, scrolling) to match the task-focused style of the skill references.
- **Include “modern API replacement” guidance** for SwiftUI deprecations to keep the MCP patterns up-to-date and actionable.
- **Provide installation guidance for skills** in the README (e.g., skills.sh, Claude Code plugin), alongside current MCP setup instructions, so teams can pick the best integration for their workflow.
- **Keep guidance non-prescriptive** (no forced architecture) while emphasizing correctness and performance pitfalls, aligning with the style of the skill’s documentation.

## Notes

This document is informational only and does not import or copy any source files.
