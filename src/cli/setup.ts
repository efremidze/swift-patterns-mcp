// src/cli/setup.ts

import readline from "readline"
import { startOAuthFlow, loadTokens } from "../sources/premium/patreon-oauth.js"
import PatreonSource, { PatreonCreator } from "../sources/premium/patreon.js"
import SourceManager from "../config/sources.js"

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve))
}

function print(msg: string): void {
  console.log(msg)
}

async function setupPatreon(): Promise<void> {
  print("\n🔐 Patreon Setup")
  print("━━━━━━━━━━━━━━━━\n")

  const clientId = process.env.PATREON_CLIENT_ID
  const clientSecret = process.env.PATREON_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    print("❌ Missing Patreon credentials.\n")
    print("Please set these environment variables:")
    print("  PATREON_CLIENT_ID=your_client_id")
    print("  PATREON_CLIENT_SECRET=your_client_secret\n")
    print("Get credentials at: https://www.patreon.com/portal/registration/register-clients")
    rl.close()
    process.exit(1)
  }

  // Check if already configured
  const existingTokens = await loadTokens()
  if (existingTokens) {
    const answer = await question("Patreon is already configured. Reconfigure? (y/N): ")
    if (answer.toLowerCase() !== "y") {
      print("\nSetup cancelled.")
      rl.close()
      return
    }
  }

  // Step 1: OAuth
  print("Step 1/2: Authentication")
  const result = await startOAuthFlow(clientId, clientSecret)

  if (!result.success) {
    print(`\n❌ Authorization failed: ${result.error}`)
    rl.close()
    process.exit(1)
  }

  print("✓ Authenticated successfully!\n")

  // Step 2: Fetch patron memberships
  print("Step 2/2: Fetching Patron Memberships")
  print("Scanning your subscriptions...\n")

  const patreon = new PatreonSource()

  let creators: PatreonCreator[]
  try {
    creators = await patreon.getPatronMemberships()
  } catch (err) {
    print(`❌ ${err instanceof Error ? err.message : String(err)}`)
    rl.close()
    process.exit(1)
  }

  print(`Found ${creators.length} active patron membership(s):\n`)

  creators.forEach((c, i) => {
    const swift = c.isSwiftRelated ? " (Swift/iOS)" : ""
    print(`  [${i + 1}] ${c.name}${swift}`)
  })

  const swiftCount = creators.filter((c) => c.isSwiftRelated).length
  if (swiftCount > 0) {
    print(`\n✨ ${swiftCount} Swift/iOS related creator(s) detected!`)
  }

  // Mark as configured
  const sourceManager = new SourceManager()
  sourceManager.markSourceConfigured("patreon")

  print("\n✅ Setup complete!\n")
  print("Your Patreon subscriptions are now connected.")
  print("Use 'get_patreon_patterns' in your AI assistant to access content.\n")

  rl.close()
}

// Parse args
const args = process.argv.slice(2)

if (args.includes("--patreon") || args.includes("-p")) {
  setupPatreon().catch((err) => {
    console.error("Setup failed:", err)
    process.exit(1)
  })
} else if (args.includes("--help") || args.includes("-h")) {
  print("swift-mcp setup\n")
  print("Usage:")
  print("  swift-mcp setup --patreon    Set up Patreon integration")
  print("  swift-mcp setup --help       Show this help")
  process.exit(0)
} else {
  print("swift-mcp setup\n")
  print("Available options:")
  print("  --patreon    Set up Patreon integration")
  print("\nRun: swift-mcp setup --patreon")
  process.exit(0)
}
