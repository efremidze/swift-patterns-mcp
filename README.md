# Swift MCP Server

An MCP server that brings Swift/SwiftUI best practices from leading iOS developers directly to your AI assistant.

<a href="https://glama.ai/mcp/servers/@efremidze/swift-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@efremidze/swift-mcp/badge" alt="Swift MCP server" />
</a>

![GitHub License](https://img.shields.io/github/license/efremidze/swift-mcp) 
![GitHub Last Commit](https://img.shields.io/github/last-commit/efremidze/swift-mcp) 
![Node Version](https://img.shields.io/badge/node-18.0.0%2B-blue)

## Available Tools

### 1. get_swift_pattern
Get Swift/SwiftUI patterns from curated free sources (Sundell, van der Lee, etc.).

**Parameters:**
- `topic`: Topic to search (e.g., "swiftui", "testing", "async-await", "performance")
- `source`: (Optional) Specific source to search - "all", "sundell", "vanderlee" (default: "all")
- `minQuality`: (Optional) Minimum quality score 0-100 (default: 60)

### 2. search_swift_content
Search all enabled sources for Swift/iOS content.

**Parameters:**
- `query`: Search query string
- `requireCode`: (Optional) Only return results with code examples (boolean)

### 3. list_content_sources
List all available content sources and their status (enabled/disabled, free/premium).

**Parameters:**
- None required

### 4. enable_source
Enable a content source. Note: Premium sources require setup first.

**Parameters:**
- `source`: Source ID (e.g., "patreon", "github-sponsors")

### 5. get_patreon_patterns
Get high-quality patterns from your Patreon subscriptions (requires Patreon enabled).

**Parameters:**
- `creator`: (Optional) Filter by creator name
- `topic`: (Optional) Topic to search
- `includeCode`: (Optional) Only return content with code examples (boolean)

## Installation

1. **Install the Package**
    ```bash
    npm install -g @efremidze/swift-mcp
    ```

2. **Client Configuration**
    
    Add to your MCP settings file:
    
    **Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
    ```json
    {
      "mcpServers": {
        "swift-mcp": {
          "command": "swift-mcp"
        }
      }
    }
    ```
    
    **Cursor** (`.cursor/mcp.json`):
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

3. **Optional: Configure Patreon Integration**
    ```bash
    swift-mcp setup --patreon
    ```

## Content Sources

### Free Sources (Always Enabled)
No authentication needed:

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

## Example Prompts

Here are some natural language prompts to trigger the tools:

### Basic Pattern Search
- "Show me SwiftUI animation patterns"
- "Find Swift testing patterns from Sundell"
- "Get async/await examples with high quality scores"
- "What are the best SwiftUI performance tips?"

### Source-Specific Queries
- "What does Sundell say about testing?"
- "Show me van der Lee's tutorials on Combine"
- "Get Point-Free patterns for functional programming"

### Code-Focused Queries
- "Find async/await examples with code"
- "Show me SwiftUI animation patterns with implementation examples"
- "Get testing patterns that include code samples"

### Content Discovery
- "List all available Swift content sources"
- "What sources are currently enabled?"
- "Show me the status of premium sources"

### Premium Content (Patreon Required)
- "Show me advanced SwiftUI patterns from my Patreon subscriptions"
- "Get iOS architecture patterns from Patreon creators I support"
- "Find SwiftUI code examples from my Patreon feed"

### Combined Tasks
- "List available sources, then show me SwiftUI patterns from the free ones"
- "Enable van der Lee source and search for memory management tips"
- "Search all sources for dependency injection patterns with code examples"

## Configuration

Configuration is stored in `~/.swift-mcp/config.json`:

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

### Managing Sources

```bash
# List all sources
swift-mcp source list

# Enable a source
swift-mcp source enable patreon

# Disable a source
swift-mcp source disable pointfree
```

## Patreon Integration (Optional)

**Requirements:**
- Patreon Creator account (free - no need to launch a page)
- 10 minutes one-time setup
- Your own OAuth credentials

**Why Creator Account?**
Patreon requires OAuth apps to be registered by creators. You don't need to launch a creator page - just become a creator.

**Setup:**
```bash
swift-mcp setup --patreon
```

**What You Get:**
- Access content from creators you support
- Automatic code extraction from zips
- Quality filtering and search
- Multi-creator support
- Worth the 10-minute setup!

## Features

### Built-in Sources
- ✅ Swift by Sundell articles
- ✅ Antoine van der Lee tutorials  
- ✅ Point-Free open source

### Premium (Optional)
- 🔐 **Patreon Integration** - Access content from creators you support
- 🔍 **Advanced Search** - Quality filtering and code-focused queries
- 📦 **Automatic Processing** - Extract and index code from downloads

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
