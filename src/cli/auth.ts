#!/usr/bin/env node

// src/cli/auth.ts

import 'dotenv/config';

import { clearPatreonAuth } from "../sources/premium/patreon-oauth.js"

function print(msg: string): void {
  console.log(msg)
}

async function resetAuth(): Promise<void> {
  print("\n🔄 Resetting Patreon Authentication")
  print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

  try {
    await clearPatreonAuth()
    print("✅ Authentication data cleared successfully!\n")
    print("Run 'swift-patterns-mcp setup --patreon' to re-authenticate.\n")
  } catch (err) {
    print(`❌ Failed to clear authentication: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
}

// Parse args
const args = process.argv.slice(2)

if (args.includes("reset") || args.includes("-r")) {
  resetAuth().catch((err) => {
    console.error("Reset failed:", err)
    process.exit(1)
  })
} else if (args.includes("--help") || args.includes("-h")) {
  print("swift-patterns-mcp auth\n")
  print("Usage:")
  print("  swift-patterns-mcp auth reset    Clear all Patreon authentication data")
  print("  swift-patterns-mcp auth --help   Show this help")
  process.exit(0)
} else {
  print("swift-patterns-mcp auth\n")
  print("Available commands:")
  print("  reset    Clear all Patreon authentication data")
  print("\nRun: swift-patterns-mcp auth reset")
  process.exit(0)
}
