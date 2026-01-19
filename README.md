# swift-mcp

### 🎯 Curated Swift/SwiftUI Patterns from Top iOS Developers

[![NPM Version](https://img.shields.io/npm/v/@efremidze/swift-mcp)](https://www.npmjs.com/package/@efremidze/swift-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/node/v/@efremidze/swift-mcp)](https://nodejs.org)

**An MCP server providing curated Swift and SwiftUI best practices from leading iOS developers, including patterns and real-world code examples from Swift by Sundell, SwiftLee, and other trusted sources.**

[Quick Start](#-quick-start) • [Features](#-features) • [Usage](#-usage-examples) • [Contributing](#-contributing)

---

## 🎯 About

**swift-mcp** is a Model Context Protocol (MCP) server that provides your AI assistant with access to curated Swift and SwiftUI patterns, best practices, and code examples from top iOS developers and educators.

Whether you're building a new iOS app or looking for solutions to common Swift problems, swift-mcp gives your AI assistant the knowledge to provide expert-level guidance based on real-world patterns from the Swift community.

### Why swift-mcp?

- ✅ **Curated Content**: Only high-quality patterns from trusted iOS developers
- ✅ **Always Up-to-Date**: Automatically fetches the latest articles and patterns
- ✅ **MCP Native**: Works seamlessly with Claude, Cursor, Windsurf, and other MCP-compatible tools
- ✅ **Privacy First**: Free sources require no authentication
- ✅ **Extensible**: Optional Patreon integration for premium content

## 🌟 Features

### Core Features

- 🎓 **Expert Knowledge Base**: Access patterns from Swift by Sundell, Antoine van der Lee, and more
- 🔍 **Intelligent Search**: Query by topic, pattern, or specific iOS concepts
- 🎯 **Quality Filtering**: Configurable quality thresholds ensure only the best content
- 📚 **Multiple Sources**: Aggregate knowledge from various trusted educators
- 🔄 **Auto-Updates**: Content automatically refreshes from RSS feeds
- ⚡ **Fast Performance**: Efficient caching and indexed search

### Built-in Sources (Free)
- ✅ **Swift by Sundell** - Articles, patterns, and best practices
- ✅ **Antoine van der Lee** - Tutorials, tips, and deep dives
- ✅ **Point-Free** - Open source libraries and patterns

### Premium Sources (Optional)
- 🔐 **Patreon Integration** - Access premium content from creators you support

## 📋 Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **MCP-Compatible AI Assistant**: Claude Desktop, Cursor, Windsurf, or VS Code with Copilot

## 🚀 Quick Start

### Install

```bash
npm install -g @efremidze/swift-mcp
```

### Configure Your AI Assistant

#### Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=swift&config=eyJjb21tYW5kIjoibnB4IC15IEBlZnJlbWlkemUvc3dpZnQtbWNwQGxhdGVzdCJ9)

Or manually add to **Cursor Settings** → **Tools** → **MCP Servers**:

`.cursor/mcp.json`:
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

Alternatively, add the following to your `~/.cursor/mcp.json` file. To learn more, see the Cursor documentation.

#### Claude Code

Run this command in your terminal:

```bash
claude mcp add swift -- npx -y @efremidze/swift-mcp@latest
```

Or manually add to your project's `.mcp.json` file:

`.mcp.json`
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

After adding the configuration, restart Claude Code and run /mcp to see the HeroUI MCP server in the list. If you see Connected, you're ready to use it.

See the Claude Code MCP documentation for more details.

#### Windsurf

Add the HeroUI server to your project's `.windsurf/mcp.json` configuration file:

`.windsurf/mcp.json`
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

After adding the configuration, restart Windsurf to activate the MCP server.

See the Windsurf MCP documentation for more details.

#### VS Code

To configure MCP in VS Code with GitHub Copilot, add the swift-mcp server to your project's `.vscode/mcp.json` configuration file:

`.vscode/mcp.json`
```json
{
  "mcp": {
    "servers": {
      "swift": {
        "command": "npx",
        "args": ["-y", "@efremidze/swift-mcp@latest"]
      }
    }
  }
}
```

After adding the configuration, open `.vscode/mcp.json` and click Start next to the heroui-react server.

See the VS Code MCP documentation for more details.

### Test It Out

In your AI assistant, try:

```
"Show me SwiftUI animation patterns"
"What does Sundell say about testing?"
"Explain navigation patterns in SwiftUI"
```

## 🔧 Configuration

The configuration file is automatically created at `~/.swift-mcp/config.json`:

```json
{
  "sources": {
    "sundell": { "enabled": true, "quality": 60 },
    "vanderlee": { "enabled": true, "quality": 60 },
    "pointfree": { "enabled": false, "quality": 60 },
    "patreon": { "enabled": false }
  },
  "cache": {
    "ttl": 86400
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable a source |
| `quality` | number | `60` | Minimum quality score (0-100) |
| `cache.ttl` | number | `86400` | Cache time-to-live in seconds |

## 🔑 Environment Variables

swift-mcp uses environment variables for optional premium features. Free sources work without any configuration.

### Available Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PATREON_CLIENT_ID` | For Patreon | OAuth client ID from Patreon Developer Portal |
| `PATREON_CLIENT_SECRET` | For Patreon | OAuth client secret from Patreon Developer Portal |
| `YOUTUBE_API_KEY` | For YouTube | Google API key for YouTube content |

### Setting Variables in MCP Client Config (Recommended)

The recommended way to configure environment variables is through your MCP client's configuration file. This passes variables directly to the swift-mcp server.

#### Cursor

```json
{
  "mcpServers": {
    "swift": {
      "command": "npx",
      "args": ["-y", "@efremidze/swift-mcp@latest"],
      "env": {
        "PATREON_CLIENT_ID": "your_client_id",
        "PATREON_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

#### Claude Desktop

```json
{
  "mcpServers": {
    "swift": {
      "command": "npx",
      "args": ["-y", "@efremidze/swift-mcp@latest"],
      "env": {
        "PATREON_CLIENT_ID": "your_client_id",
        "PATREON_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

#### Windsurf

```json
{
  "mcpServers": {
    "swift": {
      "command": "npx",
      "args": ["-y", "@efremidze/swift-mcp@latest"],
      "env": {
        "PATREON_CLIENT_ID": "your_client_id",
        "PATREON_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

#### VS Code

```json
{
  "mcp": {
    "servers": {
      "swift": {
        "command": "npx",
        "args": ["-y", "@efremidze/swift-mcp@latest"],
        "env": {
          "PATREON_CLIENT_ID": "your_client_id",
          "PATREON_CLIENT_SECRET": "your_client_secret"
        }
      }
    }
  }
}
```

### Local Development

For local development and testing, you can use a `.env` file in the project root:

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Add your credentials:
   ```bash
   # .env
   PATREON_CLIENT_ID=your_client_id
   PATREON_CLIENT_SECRET=your_client_secret
   YOUTUBE_API_KEY=your_api_key
   ```

3. The `.env` file is automatically loaded when running the server locally.

> **Note:** Never commit `.env` files to version control. The `.env` file is already in `.gitignore`.

## 💡 Usage Examples

Once installed, ask your AI assistant natural questions:

### Basic Queries

```
"Show me best practices for SwiftUI animations"
→ Returns curated animation best practices from all free sources

"What does Sundell say about testing?"
→ Returns testing-related content specifically from Swift by Sundell

"Explain navigation patterns in SwiftUI"
→ Returns navigation architecture guidance and patterns
```

### Advanced Queries

```
"Show me performance tips from van der Lee"
→ Filters to Antoine van der Lee's performance-related content

"Find iOS architecture patterns for a feature-based module (MVVM + coordinator)"
→ Returns architecture and design pattern articles

"Give me examples for SwiftUI infinite scrolling"
→ Returns infinite scrolling implementations and related patterns
```

### With Patreon Integration

```
"Show me advanced SwiftUI patterns from my Patreon"
→ Returns premium content from creators you support + free sources

"Get the latest content from creators I support"
→ Accesses your Patreon subscriptions for exclusive content
```

## 📚 Content Sources

### Free Sources

Currently supported, no authentication needed:

| Source | Creator | Content Type | Update Frequency |
|--------|---------|--------------|------------------|
| **Swift by Sundell** | John Sundell | Articles, patterns, best practices | Weekly |
| **Antoine van der Lee** | Antoine van der Lee | Tutorials, tips, deep dives | Weekly |
| **Point-Free** | Point-Free | Open source libraries, patterns | On release |

### Premium Sources

Requires authentication and active subscriptions:

| Source | What You Get | Setup Method | Status |
|--------|--------------|--------------|--------|
| **Patreon** | Premium content from iOS creators | OAuth 2.0 | ✅ Available |

## 🔐 Premium Integration (Optional)

### Patreon Integration

Unlock premium content from iOS creators you already support on Patreon.

#### Requirements

- Active Patreon account with at least one iOS creator subscription
- Patreon Creator account (free - no need to launch a creator page)
- 10 minutes for one-time OAuth setup

#### Why Creator Account?

Patreon requires OAuth apps to be registered by creators. You don't need to launch a creator page or become an active creator - just register as one to create an OAuth app for personal use.

#### Setup Steps

1. **Start the setup wizard:**
   ```bash
   swift-mcp setup --patreon
   ```

2. **Follow the interactive prompts** to:
   - Create a Patreon OAuth application
   - Set up redirect URIs
   - Configure credentials

3. **Complete OAuth authentication** in your browser

4. **Start using premium content** immediately!

#### What You Get

- ✅ Access to premium tutorials and patterns from creators you support
- ✅ Automatic extraction of code from downloadable content
- ✅ Quality filtering and advanced search
- ✅ Multi-creator support
- ✅ Private, secure authentication

📖 **Detailed Guide**: [Patreon Setup Documentation](docs/PATREON_SETUP.md)

## ⚙️ Commands

### Source Management

```bash
# List all available sources and their status
swift-mcp source list

# Enable a source
swift-mcp source enable <source-name>

# Disable a source
swift-mcp source disable <source-name>

# Examples
swift-mcp source enable patreon
swift-mcp source disable pointfree
```

### Configuration

```bash
# Run initial setup (creates config file)
swift-mcp setup

# Set up Patreon integration
swift-mcp setup --patreon

# View current configuration
cat ~/.swift-mcp/config.json
```

### Authentication

```bash
# Authenticate with Patreon
swift-mcp auth patreon

# Check authentication status
swift-mcp auth status
```

## 🏗️ How It Works

```mermaid
graph LR
    A[AI Assistant] --> B[swift-mcp Server]
    B --> C[Free Sources]
    B --> D[Premium Sources]
    C --> E[Swift by Sundell RSS]
    C --> F[van der Lee RSS]
    C --> G[Point-Free GitHub]
    D --> H[Patreon API]
```

1. **AI Assistant Query**: Your AI assistant sends a query through the MCP protocol
2. **swift-mcp Processing**: The server searches enabled sources based on your query
3. **Content Retrieval**: Fetches and parses content from RSS feeds, APIs, and cached data
4. **Quality Filtering**: Applies configurable quality thresholds
5. **Response**: Returns formatted, relevant patterns and examples to your AI assistant

## 🔧 Troubleshooting

### Common Issues

#### Installation Problems

**Error: Node version incompatible**
```bash
# Check your Node version
node --version

# Should be >= 18.0.0
# Update Node if needed: https://nodejs.org
```

**Error: Permission denied during global install**
```bash
# Use npx without global install
npx @efremidze/swift-mcp@latest

# Or fix npm permissions:
# https://docs.npmjs.com/resolving-eacces-permissions-errors
```

#### Configuration Issues

**Sources not returning results**
```bash
# Verify sources are enabled
swift-mcp source list

# Check configuration file exists
ls ~/.swift-mcp/config.json

# Re-run setup if needed
swift-mcp setup
```

#### Patreon Integration Issues

**OAuth redirect not working**
- Ensure redirect URI is exactly: `http://localhost:3000/patreon/callback`
- Check no other process is using port 3000
- Verify OAuth credentials are correctly set

**No premium content showing**
- Confirm you have active Patreon subscriptions to iOS creators
- Re-authenticate: `swift-mcp auth patreon`
- Check Patreon source is enabled: `swift-mcp source list`

### Getting Help

- 📖 [Full Documentation](docs/)
- 🐛 [Report Issues](https://github.com/efremidze/swift-mcp/issues)
- 💬 [Discussions](https://github.com/efremidze/swift-mcp/discussions)

## 🗺️ Roadmap

### Current Focus (v1.x)

- [x] Core MCP server implementation
- [x] Swift by Sundell RSS integration
- [x] Antoine van der Lee RSS integration
- [x] Basic source management
- [x] Patreon OAuth integration
- [ ] Point-Free GitHub integration
- [ ] Advanced quality filtering
- [ ] Code extraction from articles

### Future Plans (v2.x)

- [ ] Additional premium source integrations
- [ ] More free content sources (developer blogs, newsletters)
- [ ] Advanced content discovery and recommendations
- [ ] Better content filtering and categorization
- [ ] Local content caching improvements
- [ ] Advanced search with vector embeddings
- [ ] Custom source plugins

### Long-term Vision

- [ ] Community-contributed sources
- [ ] Pattern recommendation engine
- [ ] Code snippet validation
- [ ] Integration with Xcode
- [ ] Swift package ecosystem integration

## 🤝 Contributing

We welcome contributions! See our [contributing guidelines](CONTRIBUTING.md).

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/swift-mcp.git
cd swift-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run watch
```

### Areas We Need Help

- 🐛 Bug fixes and testing
- 📝 Documentation improvements
- 🎨 Adding new content sources
- ⚡ Performance optimization

### Code of Conduct

Please be respectful and constructive. We're here to build something great together!

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License - Copyright (c) 2024 Lasha Efremidze
```

## 🙏 Credits

### Created By

**Lasha Efremidze** - [GitHub](https://github.com/efremidze)

### Built With

- [Model Context Protocol](https://modelcontextprotocol.io) - The protocol enabling AI-to-tool communication
- [TypeScript](https://www.typescriptlang.org) - Language and tooling
- [rss-parser](https://github.com/rbren/rss-parser) - RSS feed parsing
- [Patreon API](https://www.patreon.com/platform/documentation/api) - Premium content integration

### Content Sources

Special thanks to the iOS developers and educators whose content makes this possible:

- 🌟 [John Sundell](https://swiftbysundell.com) - Swift by Sundell
- 🌟 [Antoine van der Lee](https://www.avanderlee.com) - SwiftLee
- 🌟 [Point-Free](https://www.pointfree.co) - Advanced Swift education

### Inspiration

This project was inspired by the need to bring expert iOS knowledge directly into AI-assisted development workflows.

---

**Made with ❤️ for the Swift community**

[⭐ Star this repo](https://github.com/efremidze/swift-mcp) • [🐛 Report Bug](https://github.com/efremidze/swift-mcp/issues) • [✨ Request Feature](https://github.com/efremidze/swift-mcp/issues)
