# swift-mcp — Model Context Protocol Server

A Model Context Protocol (MCP) server that exposes curated Swift/SwiftUI patterns from top iOS developers.  
This MCP enables AI assistants and agents to access high-quality Swift/iOS learning content, such as:
- 🔍 Searching patterns and best practices
- 📄 Fetching articles and tutorials
- 🛠️ Finding code examples
- 🎓 Learning from leading iOS developers

## 🚀 Features

- **Pattern Search**: Find Swift/SwiftUI patterns from curated sources by topic or keyword
- **Content Discovery**: Access articles, tutorials, and code examples from top iOS developers
- **Multiple Sources**: Built-in free sources (Swift by Sundell, Antoine van der Lee) always available
- **Premium Integration**: Optional Patreon integration for accessing premium content from creators you support
- **Code Filtering**: Filter results to only show content with code examples
- **Quality Scoring**: Relevance-based ranking to surface the best matches
- **Flexible Configuration**: Enable/disable sources based on your preferences

## 📦 Requirements

Before running this MCP server, you'll need:
- **Node.js** 18.0.0 or higher  
- For basic usage (free sources): No additional requirements
- For Patreon integration (optional):
  - Patreon Creator account (free - no need to launch a creator page)
  - Patreon OAuth credentials (Client ID and Secret)
  - 10 minutes for one-time setup

## 🧠 Installation

### From npm

```sh
npm install -g @efremidze/swift-mcp
```

### From Source

```sh
git clone https://github.com/efremidze/swift-mcp
cd swift-mcp
npm install
npm run build
npm link
```

## 🔧 Configuration

### Basic Setup (Free Sources)

No configuration needed! Free sources work out of the box:

```bash
swift-mcp setup
```

### MCP Client Configuration

Add to your MCP client configuration:

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "swift": {
      "command": "npx",
      "args": ["-y", "@efremidze/swift-mcp@latest"]
    }
  }
}
```

#### Cursor

Create `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "swift": {
      "command": "npx",
      "args": ["-y", "@efremidze/swift-mcp@latest"]
    }
  }
}
```

#### Windsurf

Create `.windsurf/mcp.json`:
```json
{
  "mcpServers": {
    "swift": {
      "command": "npx",
      "args": ["-y", "@efremidze/swift-mcp@latest"]
    }
  }
}
```

### Advanced Configuration

Configuration file location: `~/.swift-mcp/config.json`

```json
{
  "sources": {
    "sundell": { "enabled": true },
    "vanderlee": { "enabled": true },
    "pointfree": { "enabled": true },
    "patreon": { "enabled": false }
  }
}
```

## 📚 Content Sources

### Free Sources
Always enabled, no authentication needed:

| Source | Content Type | Update Frequency |
|--------|--------------|------------------|
| Swift by Sundell | Articles, patterns | Weekly |
| Antoine van der Lee | Tutorials, tips | Weekly |
| Point-Free | OSS repos | On release |

### Premium Sources (Optional)
Requires authentication:

| Source | What You Get | Setup |
|--------|--------------|-------|
| Patreon | Your subscriptions | OAuth |
| GitHub Sponsors* | Your sponsors | OAuth |

*Coming soon

## 💡 Usage Examples

Once configured in your MCP client, you can query the server through your AI assistant:

```typescript
// Search for patterns from free sources
"Show me SwiftUI animation patterns"
→ Returns from Sundell, van der Lee

// Find content with code examples
"Find async/await examples with code"
→ Returns articles containing code examples

// Search specific source
"What does Sundell say about testing?"
→ Returns only from Swift by Sundell

// With Patreon enabled
"Show me advanced SwiftUI patterns from my Patreon"
→ Returns from your Patreon subscriptions + free sources

// List available sources
"List all content sources"
→ Shows enabled/disabled sources and their status
```

## ⚙️ Managing Sources

```bash
# List all sources and their status
swift-mcp source list

# Enable Patreon
swift-mcp source enable patreon

# Disable a source
swift-mcp source disable pointfree
```

## 🔐 Patreon Integration (Optional)

### Requirements
- Patreon Creator account (free - no need to launch a page)
- 10 minutes one-time setup
- Your own OAuth credentials

### Why Creator Account?
Patreon requires OAuth apps to be registered by creators. 
You don't need to launch a creator page - just become a creator.

### Setup

```bash
swift-mcp setup --patreon
```

This will:
1. Guide you through creating Patreon OAuth credentials
2. Open your browser for Patreon authentication
3. Connect your subscriptions
4. Analyze your content
5. Enable premium pattern access

### What You Get
- Access content from creators you support
- Automatic code extraction from zips
- Advanced filtering and search
- Quality filtering
- Worth the 10-minute setup!

## 🛠️ Development

```bash
# Build the project
npm run build

# Watch mode for development
npm run watch

# Run linter
npm run lint
```

## 📖 Documentation

For more detailed information, see:
- [Quick Start Guide](./QUICKSTART.md)
- [GitHub Repository](https://github.com/efremidze/swift-mcp)
- [Issues & Support](https://github.com/efremidze/swift-mcp/issues)

## 📄 License

MIT License - See [LICENSE](./LICENSE) file for details

## 👤 Author

**Lasha Efremidze**
- GitHub: [@efremidze](https://github.com/efremidze)

## 🙏 Acknowledgments

Special thanks to the iOS developer community and content creators:
- [Swift by Sundell](https://www.swiftbysundell.com/) by John Sundell
- [SwiftLee](https://www.avanderlee.com/) by Antoine van der Lee
- [Point-Free](https://www.pointfree.co/) by Brandon Williams & Stephen Celis
