# Project: swift-patterns-mcp Improvements

## Core Value

Improve swift-patterns-mcp reliability, usability, and code quality to deliver a production-ready MCP server for Swift/SwiftUI learning content.

## Overview

swift-patterns-mcp is an MCP server that provides AI assistants with curated Swift/SwiftUI patterns from top iOS developers. This improvement effort focuses on three areas:

1. **MCP Usability** - Better search, responses, and tool organization
2. **Patreon Integration** - More robust OAuth flow and content extraction
3. **Code Quality** - Consistent error handling, structured logging, test coverage

## Current State

- **Version**: 1.0.0 (published on npm as @efremidze/swift-patterns-mcp)
- **Stack**: TypeScript, Node.js 18+, MCP SDK
- **Sources**: Free (RSS-based) + Premium (Patreon, YouTube)
- **Known Issues**: See `.planning/codebase/CONCERNS.md`

## Goals

| Priority | Goal | Success Criteria |
|----------|------|------------------|
| High | Reliable Patreon OAuth | Token refresh works, errors handled gracefully |
| High | Test coverage for core logic | Utils and critical paths tested |
| Medium | Cleaner architecture | Tool handlers extracted from monolithic index.ts |
| Medium | Better MCP responses | Structured, consistent tool outputs |
| Low | Premium source testing | Patreon/YouTube integrations tested |

## Constraints

- **Backward Compatibility**: CLI commands and MCP tool names must remain stable
- **No Breaking Changes**: Existing users should not need to reconfigure
- **Graceful Degradation**: Premium features fail silently when unconfigured

## Key Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-16 | 6-phase improvement roadmap | Covers usability, Patreon, and quality goals |

## References

- Codebase documentation: `.planning/codebase/`
- README: `README.md`
- MCP SDK: `@modelcontextprotocol/sdk`

---

*Project initialized: 2026-01-16*
