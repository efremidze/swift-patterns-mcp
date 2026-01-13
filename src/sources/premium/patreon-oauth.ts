// src/sources/premium/patreon-oauth.ts

import http from "http"
import { exec } from "child_process"
import keytar from "keytar"

const SERVICE_NAME = "swift-mcp"
const ACCOUNT_NAME = "patreon-tokens"
const CALLBACK_PORT = 9876

const PATREON_AUTHORIZE_URL = "https://www.patreon.com/oauth2/authorize"
const PATREON_TOKEN_URL = "https://www.patreon.com/api/oauth2/token"

export const PATREON_SCOPES = [
  "identity",           // REQUIRED: patron memberships live here
  "campaigns",          // creator-owned campaigns (optional)
  "campaigns.members"   // members of creator-owned campaigns (optional)
].join(" ")

export interface PatreonTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  scope: string
}

export interface OAuthResult {
  success: boolean
  tokens?: PatreonTokens
  error?: string
}

// =============================================================================
// Token Storage (keytar)
// =============================================================================

export async function saveTokens(tokens: PatreonTokens): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify(tokens))
}

export async function loadTokens(): Promise<PatreonTokens | null> {
  try {
    const stored = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
    if (!stored) return null
    return JSON.parse(stored) as PatreonTokens
  } catch {
    return null
  }
}

export async function clearTokens(): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
}

export function isTokenExpired(tokens: PatreonTokens): boolean {
  // Refresh 5 minutes before actual expiry
  return Date.now() >= (tokens.expires_at - 5 * 60 * 1000)
}

// =============================================================================
// Token Exchange & Refresh
// =============================================================================

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string
): Promise<PatreonTokens> {
  const res = await fetch(PATREON_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  })

  if (!res.ok) {
    throw new Error(`Patreon token exchange failed: ${res.status}`)
  }

  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope
  }
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<PatreonTokens> {
  const res = await fetch(PATREON_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  })

  if (!res.ok) {
    throw new Error(`Patreon token refresh failed: ${res.status}`)
  }

  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string
  }

  const tokens: PatreonTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope
  }

  await saveTokens(tokens)
  return tokens
}

// =============================================================================
// Get Valid Access Token (auto-refresh if expired)
// =============================================================================

export async function getValidAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const tokens = await loadTokens()
  if (!tokens) return null

  if (isTokenExpired(tokens)) {
    try {
      const refreshed = await refreshAccessToken(clientId, clientSecret, tokens.refresh_token)
      return refreshed.access_token
    } catch {
      await clearTokens()
      return null
    }
  }

  return tokens.access_token
}

// =============================================================================
// OAuth Flow with Local Callback Server
// =============================================================================

export async function startOAuthFlow(
  clientId: string,
  clientSecret: string
): Promise<OAuthResult> {
  return new Promise((resolve) => {
    const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`

    const authUrl = new URL(PATREON_AUTHORIZE_URL)
    authUrl.searchParams.set("client_id", clientId)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", PATREON_SCOPES)

    let serverClosed = false

    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith("/callback")) {
        res.writeHead(404)
        res.end("Not found")
        return
      }

      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`)
      const code = url.searchParams.get("code")
      const error = url.searchParams.get("error")

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end("<h1>Authorization Denied</h1><p>You can close this window.</p>")
        if (!serverClosed) {
          serverClosed = true
          server.close()
          resolve({ success: false, error })
        }
        return
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" })
        res.end("<h1>Error</h1><p>No authorization code received.</p>")
        return
      }

      try {
        const tokens = await exchangeCodeForToken(clientId, clientSecret, redirectUri, code)
        await saveTokens(tokens)

        res.writeHead(200, { "Content-Type": "text/html" })
        res.end(`
          <html>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>Authorization Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `)

        if (!serverClosed) {
          serverClosed = true
          server.close()
          resolve({ success: true, tokens })
        }
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html" })
        res.end("<h1>Error</h1><p>Failed to complete authorization.</p>")
        if (!serverClosed) {
          serverClosed = true
          server.close()
          resolve({ success: false, error: String(err) })
        }
      }
    })

    server.listen(CALLBACK_PORT, "127.0.0.1", () => {
      console.log(`\nOpening browser for Patreon authorization...`)
      console.log(`If browser doesn't open, visit: ${authUrl.toString()}\n`)

      // Open browser
      const cmd = process.platform === "darwin" ? "open" :
                  process.platform === "win32" ? "start" : "xdg-open"
      exec(`${cmd} "${authUrl.toString()}"`)
    })

    // Timeout after 120 seconds
    setTimeout(() => {
      if (!serverClosed) {
        serverClosed = true
        server.close()
        resolve({ success: false, error: "Authorization timed out after 120 seconds" })
      }
    }, 120000)
  })
}
