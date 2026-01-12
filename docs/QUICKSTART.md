# Quick Start Guide

## 🚀 Get Started in 2 Minutes

### 1. Install

```bash
npm install -g swift-mcp
```

### 2. Use Immediately

That's it! No setup needed for free sources.

### Try it:

In Cursor, Claude Code, or any MCP-compatible assistant:

**"Show me SwiftUI animation patterns"**

You'll get curated patterns from:
- Swift by Sundell
- Antoine van der Lee
- And more

## 🔧 Configure (Optional)

### Add to Your AI Assistant

#### Cursor

Create `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "swift": {
      "command": "npx",
      "args": ["-y", "swift-mcp@latest"]
    }
  }
}
```

#### Claude Code

```bash
claude mcp add swift -- npx -y swift-mcp@latest
```

#### Windsurf

Create `.windsurf/mcp.json`:
```json
{
  "mcpServers": {
    "swift": {
      "command": "npx",
      "args": ["-y", "swift-mcp@latest"]
    }
  }
}
```

## 💎 Add Premium Content (Optional)

Want to access patterns from iOS creators you support on Patreon?

```bash
swift-mcp setup --patreon
```

This opens your browser for secure OAuth login. Takes ~5 minutes.

## 📚 Example Queries

Try asking your AI assistant:

- "Show me SwiftUI animation patterns"
- "What does Sundell say about testing?"
- "Find async/await examples with code"
- "Show me performance tips from van der Lee"
- "Get iOS architecture patterns"

## 🎯 What You Get

### Free Sources (Always)
✅ Swift by Sundell articles
✅ Antoine van der Lee tutorials

### With Patreon (Optional)
✅ Premium content from your subscriptions
✅ Multi-creator support
✅ Advanced filtering

## 🆘 Need Help?

- Documentation: [Full Docs](https://github.com/yourusername/swift-mcp)
- Issues: [GitHub Issues](https://github.com/yourusername/swift-mcp/issues)

## 🔄 Next Steps

1. ✅ Install swift-mcp
2. ✅ Try a query
3. ⏳ Optional: Set up Patreon
4. ⏳ Explore advanced features

Happy coding! 🎉
