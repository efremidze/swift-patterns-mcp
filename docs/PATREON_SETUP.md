# Patreon Integration Setup

Patreon integration is **completely optional** but unlocks premium content from iOS creators you already support.

## 📋 Prerequisites

- Active Patreon account
- Subscribed to at least one iOS creator
- 5 minutes for one-time setup

## 🚀 Setup Process

### Step 1: Start Setup

```bash
swift-patterns-mcp setup --patreon
```

### Step 2: Create Patreon OAuth App

The setup wizard will guide you to create a Patreon OAuth app:

1. Visit: https://www.patreon.com/portal/registration/register-clients
2. Click "Create Client"
3. Fill in:
   - **App Name**: `Swift MCP` (or your choice)
   - **Description**: `Personal iOS learning assistant`
   - **App Category**: `Productivity`
   - **Redirect URI**: `http://localhost:3000/patreon/callback`

4. Click "Create Client"
5. Copy your **Client ID** and **Client Secret**

### Step 3: Configure

Add to your environment:

```bash
# ~/.zshrc or ~/.bashrc
export PATREON_CLIENT_ID="your_client_id_here"
export PATREON_CLIENT_SECRET="your_client_secret_here"
```

Or create `.env` file in `~/.swift-patterns-mcp/`:
```bash
PATREON_CLIENT_ID=your_client_id_here
PATREON_CLIENT_SECRET=your_client_secret_here
```

### Step 4: Authenticate

```bash
swift-patterns-mcp setup --patreon
```

This will:
1. Open your browser
2. Ask you to log in to Patreon (if needed)
3. Request permission to access your memberships
4. Redirect back automatically

**What permissions**:
- ✅ View your identity
- ✅ View your memberships
- ✅ Access posts from campaigns you support

**What it CANNOT do**:
- ❌ Post as you
- ❌ Manage your pledge
- ❌ See payment info
- ❌ Access other users' content

### Step 5: Done! ✅

After successful setup:

```
✅ Patreon connected!

Found 3 active memberships:
  ✓ Kavsoft - $10/month
  ✓ iOS Insights - $5/month
  ✓ Swift Weekly - $15/month

📚 Analyzing content...
  Kavsoft: 127 posts (45 high-quality)
  iOS Insights: 89 posts (58 high-quality)
  Swift Weekly: 156 posts (76 high-quality)

Total: 179 premium patterns available! 🎉
```

## 💡 Using Patreon Content

### Query Examples

**Get patterns from all your subscriptions**:
```
"Show me SwiftUI animation patterns from my Patreon"
```

**Filter by quality**:
```
"Get high-quality async/await patterns from Patreon (min score 80)"
```

**Require code examples**:
```
"Find Patreon posts with SwiftUI code examples"
```

**Search specific creator**:
```
"What animation techniques has Kavsoft posted lately?"
```

## 🎯 What You Get

### Content Quality
- **Relevance Scoring** (0-100) - Automatic iOS relevance detection
- **Code Detection** - Identifies posts with Swift/SwiftUI code
- **Topic Extraction** - Auto-categorizes by topic
- **Zip Extraction** - Automatically extracts code from .zip files

### Features
- ✅ Multi-creator support (all subscriptions in one place)
- ✅ Quality filtering
- ✅ Code search across all posts
- ✅ Automatic updates
- ✅ Smart caching (fast after first load)

### Example Output

```
# High-Quality SwiftUI Patterns - Animation

## Advanced Particle Effects System
Creator: Kavsoft
Quality Score: 92/100
Code: swift, swiftui
Topics: animation, swiftui, advanced

📦 Downloadable Code: ParticleSystem.zip (12 files extracted)

Key Files:
- ParticleView.swift
- EmitterView.swift
- Particle.swift

[Full code preview with project structure]

[Read full post](https://patreon.com/posts/...)
```

## 🔒 Security & Privacy

### What's Stored
- ✅ OAuth tokens (encrypted in system keychain)
- ✅ Membership info (locally)
- ✅ Content cache (locally)

### What's NOT Stored
- ❌ Your password (never touches our code)
- ❌ Payment info (we never see it)
- ❌ Nothing uploaded to cloud

### Token Security
- Stored in **system keychain** (macOS Keychain, Windows Credential Vault, Linux Secret Service)
- Encrypted at rest
- Auto-refresh when expired
- Revokable at https://www.patreon.com/settings/apps

## 🔧 Troubleshooting

### "OAuth Failed"
- Check Client ID and Secret are correct
- Ensure Redirect URI is exactly: `http://localhost:3000/patreon/callback`
- Try: `swift-patterns-mcp setup --patreon --reset`

### "No Memberships Found"
- Confirm you have active Patreon subscriptions
- Check subscriptions at: https://www.patreon.com/settings/memberships
- Wait a few minutes and try again

### "Content Not Loading"
- Check internet connection
- Verify tokens: `swift-patterns-mcp source status patreon`
- Re-authenticate: `swift-patterns-mcp setup --patreon --reset`

## 📊 Quality Report

See what you're getting:

```bash
swift-patterns-mcp patreon report
```

Output:
```
Patreon Content Quality Report

Kavsoft
├─ Total: 127 posts
├─ With Code: 67 (53%)
├─ High Quality (≥70): 45 (35%)
└─ Avg Score: 72/100

iOS Insights
├─ Total: 89 posts
├─ With Code: 71 (80%)
├─ High Quality: 58 (65%)
└─ Avg Score: 78/100

Summary:
Total Cost: $30/month
High-Quality Posts: 179
Value: $0.17 per high-quality post
```

## 🔄 Managing Connection

### Check Status
```bash
swift-patterns-mcp source status patreon
```

### Disable (Keep Configured)
```bash
swift-patterns-mcp source disable patreon
```

### Re-enable
```bash
swift-patterns-mcp source enable patreon
```

### Remove Connection
```bash
swift-patterns-mcp setup --patreon --remove
```

This removes tokens and cached data.

## ❓ FAQ

**Q: Do I need Patreon?**
A: No! Swift MCP works great with free sources only. Patreon is optional premium content.

**Q: What creators should I subscribe to?**
A: We don't recommend specific creators. Subscribe to whoever teaches content you want to learn!

**Q: Can I share my Patreon content via swift-patterns-mcp?**
A: No. Content is only accessible to YOU, using YOUR Patreon login. It respects creator paywalls.

**Q: How often does content update?**
A: Automatically when you query. Cache refreshes every 24 hours.

**Q: Is this allowed by Patreon?**
A: Yes! This uses Patreon's official OAuth API for personal use.

**Q: What if I cancel a subscription?**
A: Content from that creator stops appearing immediately.

## 🎁 Value Proposition

**Without Patreon in swift-patterns-mcp**:
- Visit Patreon
- Browse through posts
- Download code manually
- Unzip files
- Find what you need
- Repeat for each creator

**With Patreon in swift-patterns-mcp**:
- Ask: "Show me animation patterns"
- Get curated results from ALL your creators
- Code automatically extracted
- Quality filtered
- Instant access

**Time saved**: Hours per week → Seconds per query 🚀

---

Need help? [Open an issue](../issues)
