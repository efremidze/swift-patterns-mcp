# Patreon OAuth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement full Patreon OAuth integration with local callback server, API client, zip extraction, and interactive setup wizard.

**Architecture:** OAuth via local callback server on port 9876, tokens encrypted with keytar, content cached in ~/.swift-patterns-mcp/. Supports both API posts and zip file attachments.

**Tech Stack:** TypeScript, Node.js http module, keytar, adm-zip (all already in dependencies)

---

## Task 1: Create OAuth Flow Handler

**Files:**
- Create: `src/sources/premium/patreon-oauth.ts`

**Step 1: Create the OAuth module with types and constants**

```typescript
// src/sources/premium/patreon-oauth.ts

import http from 'http';
import { URL } from 'url';
import keytar from 'keytar';
import fs from 'fs';
import path from 'path';

const SERVICE_NAME = 'swift-patterns-mcp';
const ACCOUNT_NAME = 'patreon-tokens';
const CALLBACK_PORT = 9876;
const PATREON_AUTH_URL = 'https://www.patreon.com/oauth2/authorize';
const PATREON_TOKEN_URL = 'https://www.patreon.com/api/oauth2/token';

export interface PatreonTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
  scope: string;
}

export interface OAuthResult {
  success: boolean;
  tokens?: PatreonTokens;
  error?: string;
}
```

**Step 2: Add token storage functions**

```typescript
export async function saveTokens(tokens: PatreonTokens): Promise<void> {
  const encrypted = JSON.stringify(tokens);
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, encrypted);
}

export async function loadTokens(): Promise<PatreonTokens | null> {
  try {
    const encrypted = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    if (!encrypted) return null;
    return JSON.parse(encrypted) as PatreonTokens;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}

export function isTokenExpired(tokens: PatreonTokens): boolean {
  // Refresh 5 minutes before actual expiry
  return Date.now() >= (tokens.expires_at - 5 * 60 * 1000);
}
```

**Step 3: Add token refresh function**

```typescript
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<PatreonTokens> {
  const response = await fetch(PATREON_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };

  const tokens: PatreonTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };

  await saveTokens(tokens);
  return tokens;
}
```

**Step 4: Add OAuth flow with local callback server**

```typescript
export async function startOAuthFlow(
  clientId: string,
  clientSecret: string
): Promise<OAuthResult> {
  return new Promise((resolve) => {
    const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`;

    const authUrl = new URL(PATREON_AUTH_URL);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'identity campaigns campaigns.members');

    let serverClosed = false;

    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization Denied</h1><p>You can close this window.</p>');
        if (!serverClosed) {
          serverClosed = true;
          server.close();
          resolve({ success: false, error });
        }
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Error</h1><p>No authorization code received.</p>');
        return;
      }

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch(PATREON_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const data = await tokenResponse.json() as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
          scope: string;
        };

        const tokens: PatreonTokens = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + data.expires_in * 1000,
          scope: data.scope,
        };

        await saveTokens(tokens);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>✅ Authorization Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);

        if (!serverClosed) {
          serverClosed = true;
          server.close();
          resolve({ success: true, tokens });
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>Error</h1><p>Failed to complete authorization.</p>');
        if (!serverClosed) {
          serverClosed = true;
          server.close();
          resolve({ success: false, error: String(err) });
        }
      }
    });

    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      console.log(`\nOpening browser for Patreon authorization...`);
      console.log(`If browser doesn't open, visit: ${authUrl.toString()}\n`);

      // Open browser
      const { exec } = require('child_process');
      const cmd = process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${cmd} "${authUrl.toString()}"`);
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (!serverClosed) {
        serverClosed = true;
        server.close();
        resolve({ success: false, error: 'Authorization timed out after 60 seconds' });
      }
    }, 60000);
  });
}
```

**Step 5: Add helper to get valid access token**

```typescript
export async function getValidAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  if (isTokenExpired(tokens)) {
    try {
      const refreshed = await refreshAccessToken(clientId, clientSecret, tokens.refresh_token);
      return refreshed.access_token;
    } catch {
      // Refresh failed, need to re-authenticate
      await clearTokens();
      return null;
    }
  }

  return tokens.access_token;
}
```

**Step 6: Verify build compiles**

Run: `npm run build`
Expected: No errors

**Step 7: Commit**

```bash
git add src/sources/premium/patreon-oauth.ts
git commit -m "feat(patreon): add OAuth flow handler with local callback server"
```

---

## Task 2: Create Zip Extractor

**Files:**
- Create: `src/sources/premium/patreon-zip.ts`

**Step 1: Create the zip extractor module**

```typescript
// src/sources/premium/patreon-zip.ts

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 100;

export interface ExtractedPattern {
  filename: string;
  content: string;
  type: 'swift' | 'markdown' | 'playground' | 'other';
  hasCode: boolean;
  topics: string[];
}

export interface ZipExtractionResult {
  success: boolean;
  patterns: ExtractedPattern[];
  warnings: string[];
}

function getSwiftMcpDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(home, '.swift-patterns-mcp');
}

function getCacheDir(): string {
  return path.join(getSwiftMcpDir(), 'cache', 'zips');
}

function detectFileType(filename: string): ExtractedPattern['type'] {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.swift': return 'swift';
    case '.md': case '.markdown': return 'markdown';
    case '.playground': return 'playground';
    default: return 'other';
  }
}

function detectTopics(content: string, filename: string): string[] {
  const text = `${filename} ${content}`.toLowerCase();
  const topics: string[] = [];

  const keywords: Record<string, string[]> = {
    'swiftui': ['swiftui', '@state', '@binding', '@observable', 'view'],
    'concurrency': ['async', 'await', 'actor', 'task', 'sendable'],
    'networking': ['urlsession', 'network', 'api', 'http', 'request'],
    'testing': ['xctest', 'test', 'mock', 'stub'],
    'architecture': ['mvvm', 'coordinator', 'repository', 'usecase'],
    'uikit': ['uikit', 'uiview', 'uitableview', 'uicollectionview'],
  };

  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) {
      topics.push(topic);
    }
  }

  return topics;
}

function hasCodeContent(content: string): boolean {
  return /\b(func|class|struct|protocol|extension|enum)\s+\w+/.test(content) ||
         content.includes('```swift') ||
         content.includes('```');
}
```

**Step 2: Add zip download function**

```typescript
export async function downloadZip(
  url: string,
  postId: string,
  accessToken: string
): Promise<string | null> {
  const cacheDir = getCacheDir();
  const zipPath = path.join(cacheDir, `${postId}.zip`);

  // Check if already cached
  if (fs.existsSync(zipPath)) {
    return zipPath;
  }

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error(`Failed to download zip: ${response.status}`);
      return null;
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_ZIP_SIZE) {
      console.warn(`Zip file too large (${contentLength} bytes), skipping`);
      return null;
    }

    // Ensure cache directory exists
    fs.mkdirSync(cacheDir, { recursive: true });

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(zipPath, buffer);

    return zipPath;
  } catch (error) {
    console.error('Zip download failed:', error);
    return null;
  }
}
```

**Step 3: Add zip extraction function**

```typescript
export function extractZip(zipPath: string, postId: string): ZipExtractionResult {
  const warnings: string[] = [];
  const patterns: ExtractedPattern[] = [];

  const destDir = path.join(getCacheDir(), postId);

  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    if (entries.length > MAX_FILES) {
      warnings.push(`Zip contains ${entries.length} files, extracting first ${MAX_FILES}`);
    }

    // Ensure destination exists
    fs.mkdirSync(destDir, { recursive: true });

    let count = 0;
    for (const entry of entries) {
      if (count >= MAX_FILES) break;
      if (entry.isDirectory) continue;

      const filename = entry.entryName;
      const type = detectFileType(filename);

      // Skip non-relevant files
      if (type === 'other') continue;

      try {
        const content = entry.getData().toString('utf8');
        const topics = detectTopics(content, filename);
        const hasCode = hasCodeContent(content);

        patterns.push({
          filename,
          content,
          type,
          hasCode,
          topics,
        });

        count++;
      } catch (err) {
        warnings.push(`Failed to read ${filename}: ${err}`);
      }
    }

    return { success: true, patterns, warnings };
  } catch (error) {
    return {
      success: false,
      patterns: [],
      warnings: [`Extraction failed: ${error}`],
    };
  }
}
```

**Step 4: Add main extraction entry point**

```typescript
export async function extractFromAttachment(
  attachmentUrl: string,
  postId: string,
  accessToken: string
): Promise<ZipExtractionResult> {
  const zipPath = await downloadZip(attachmentUrl, postId, accessToken);

  if (!zipPath) {
    return {
      success: false,
      patterns: [],
      warnings: ['Failed to download zip attachment'],
    };
  }

  return extractZip(zipPath, postId);
}

export function clearZipCache(): void {
  const cacheDir = getCacheDir();
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true });
  }
}
```

**Step 5: Verify build compiles**

Run: `npm run build`
Expected: No errors

**Step 6: Commit**

```bash
git add src/sources/premium/patreon-zip.ts
git commit -m "feat(patreon): add zip extractor for attachment downloads"
```

---

## Task 3: Update Patreon API Client

**Files:**
- Modify: `src/sources/premium/patreon.ts`

**Step 1: Replace the entire file with full implementation**

```typescript
// src/sources/premium/patreon.ts

import {
  getValidAccessToken,
  loadTokens,
  PatreonTokens,
} from './patreon-oauth.js';
import { extractFromAttachment, ExtractedPattern } from './patreon-zip.js';
import fs from 'fs';
import path from 'path';

const PATREON_API = 'https://www.patreon.com/api/oauth2/v2';

export interface PatreonPattern {
  id: string;
  title: string;
  url: string;
  publishDate: string;
  excerpt: string;
  content: string;
  creator: string;
  topics: string[];
  hasCode: boolean;
}

export interface Creator {
  id: string;
  name: string;
  url: string;
  isSwiftRelated: boolean;
}

interface PatreonPost {
  id: string;
  attributes: {
    title: string;
    content: string;
    url: string;
    published_at: string;
  };
  relationships?: {
    attachments?: { data: Array<{ id: string; type: string }> };
  };
}

interface PatreonCampaign {
  id: string;
  attributes: {
    name: string;
    url: string;
    summary?: string;
  };
}

function getSwiftMcpDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(home, '.swift-patterns-mcp');
}

function getConfigPath(): string {
  return path.join(getSwiftMcpDir(), 'patreon-creators.json');
}

function detectTopics(text: string): string[] {
  const topics: string[] = [];
  const lower = text.toLowerCase();

  const keywords: Record<string, string[]> = {
    'swiftui': ['swiftui', '@state', '@binding', '@observable'],
    'concurrency': ['async', 'await', 'actor', 'task'],
    'networking': ['urlsession', 'network', 'api call'],
    'testing': ['xctest', 'unit test', 'mock'],
    'architecture': ['mvvm', 'coordinator', 'clean architecture'],
    'uikit': ['uikit', 'uiview', 'autolayout'],
  };

  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(w => lower.includes(w))) {
      topics.push(topic);
    }
  }

  return topics;
}

function hasCodeContent(content: string): boolean {
  return /\b(func|class|struct|protocol|extension)\s+\w+/.test(content) ||
         content.includes('```');
}

function isSwiftRelated(name: string, summary?: string): boolean {
  const text = `${name} ${summary || ''}`.toLowerCase();
  const keywords = ['swift', 'swiftui', 'ios', 'apple', 'xcode', 'uikit', 'iphone', 'ipad'];
  return keywords.some(k => text.includes(k));
}

export class PatreonSource {
  private clientId: string;
  private clientSecret: string;
  private enabledCreators: string[] = [];

  constructor() {
    this.clientId = process.env.PATREON_CLIENT_ID || '';
    this.clientSecret = process.env.PATREON_CLIENT_SECRET || '';
    this.loadEnabledCreators();
  }

  private loadEnabledCreators(): void {
    try {
      const configPath = getConfigPath();
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.enabledCreators = data.enabledCreators || [];
      }
    } catch {
      this.enabledCreators = [];
    }
  }

  saveEnabledCreators(creatorIds: string[]): void {
    this.enabledCreators = creatorIds;
    const configPath = getConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ enabledCreators: creatorIds }, null, 2));
  }

  async isConfigured(): Promise<boolean> {
    if (!this.clientId || !this.clientSecret) return false;
    const tokens = await loadTokens();
    return tokens !== null;
  }

  async getSubscribedCreators(): Promise<Creator[]> {
    const accessToken = await getValidAccessToken(this.clientId, this.clientSecret);
    if (!accessToken) return [];

    try {
      const response = await fetch(
        `${PATREON_API}/campaigns?fields[campaign]=name,url,summary`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        console.error(`Failed to fetch campaigns: ${response.status}`);
        return [];
      }

      const data = await response.json() as { data: PatreonCampaign[] };

      return data.data.map(campaign => ({
        id: campaign.id,
        name: campaign.attributes.name,
        url: campaign.attributes.url,
        isSwiftRelated: isSwiftRelated(
          campaign.attributes.name,
          campaign.attributes.summary
        ),
      }));
    } catch (error) {
      console.error('Failed to fetch creators:', error);
      return [];
    }
  }

  async detectSwiftCreators(): Promise<Creator[]> {
    const creators = await this.getSubscribedCreators();
    return creators.filter(c => c.isSwiftRelated);
  }

  async fetchPatterns(creatorId?: string): Promise<PatreonPattern[]> {
    const accessToken = await getValidAccessToken(this.clientId, this.clientSecret);
    if (!accessToken) return [];

    const patterns: PatreonPattern[] = [];
    const creatorsToFetch = creatorId
      ? [creatorId]
      : this.enabledCreators;

    for (const cid of creatorsToFetch) {
      try {
        const posts = await this.fetchCreatorPosts(cid, accessToken);
        patterns.push(...posts);
      } catch (error) {
        console.error(`Failed to fetch posts for creator ${cid}:`, error);
      }
    }

    // Sort by date (newest first)
    patterns.sort((a, b) =>
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );

    return patterns;
  }

  private async fetchCreatorPosts(
    creatorId: string,
    accessToken: string
  ): Promise<PatreonPattern[]> {
    const response = await fetch(
      `${PATREON_API}/campaigns/${creatorId}/posts?fields[post]=title,content,url,published_at`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.status}`);
    }

    const data = await response.json() as {
      data: PatreonPost[];
      included?: Array<{ id: string; type: string; attributes: { url: string } }>;
    };

    const patterns: PatreonPattern[] = [];

    for (const post of data.data) {
      const content = post.attributes.content || '';
      const title = post.attributes.title || '';

      // Extract from title first (metadata-first approach)
      let topics = detectTopics(title);
      if (topics.length === 0) {
        // Fallback to content scanning
        topics = detectTopics(content);
      }

      patterns.push({
        id: `patreon-${post.id}`,
        title,
        url: post.attributes.url,
        publishDate: post.attributes.published_at,
        excerpt: content.substring(0, 300),
        content,
        creator: creatorId,
        topics,
        hasCode: hasCodeContent(content),
      });

      // Check for zip attachments
      if (post.relationships?.attachments?.data) {
        for (const attachment of post.relationships.attachments.data) {
          const included = data.included?.find(
            i => i.id === attachment.id && i.type === 'attachment'
          );
          if (included?.attributes?.url?.endsWith('.zip')) {
            const result = await extractFromAttachment(
              included.attributes.url,
              post.id,
              accessToken
            );
            if (result.success) {
              for (const extracted of result.patterns) {
                patterns.push({
                  id: `patreon-${post.id}-${extracted.filename}`,
                  title: `${title} - ${extracted.filename}`,
                  url: post.attributes.url,
                  publishDate: post.attributes.published_at,
                  excerpt: extracted.content.substring(0, 300),
                  content: extracted.content,
                  creator: creatorId,
                  topics: extracted.topics,
                  hasCode: extracted.hasCode,
                });
              }
            }
          }
        }
      }
    }

    return patterns;
  }

  async searchPatterns(query: string): Promise<PatreonPattern[]> {
    const patterns = await this.fetchPatterns();
    const lowerQuery = query.toLowerCase();

    return patterns.filter(p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.content.toLowerCase().includes(lowerQuery) ||
      p.topics.some(t => t.includes(lowerQuery))
    );
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export default PatreonSource;
```

**Step 2: Verify build compiles**

Run: `npm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/sources/premium/patreon.ts
git commit -m "feat(patreon): implement full API client with post fetching and zip support"
```

---

## Task 4: Create CLI Setup Wizard

**Files:**
- Create: `src/cli/setup.ts`

**Step 1: Create the CLI directory and setup file**

```typescript
// src/cli/setup.ts

import readline from 'readline';
import { startOAuthFlow, loadTokens } from '../sources/premium/patreon-oauth.js';
import PatreonSource from '../sources/premium/patreon.js';
import SourceManager from '../config/sources.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function print(msg: string): void {
  console.log(msg);
}

async function setupPatreon(): Promise<void> {
  print('\n🔐 Patreon Setup');
  print('━━━━━━━━━━━━━━━━\n');

  const clientId = process.env.PATREON_CLIENT_ID;
  const clientSecret = process.env.PATREON_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    print('❌ Missing Patreon credentials.\n');
    print('Please set these environment variables:');
    print('  PATREON_CLIENT_ID=your_client_id');
    print('  PATREON_CLIENT_SECRET=your_client_secret\n');
    print('Get credentials at: https://www.patreon.com/portal/registration/register-clients');
    rl.close();
    process.exit(1);
  }

  // Check if already configured
  const existingTokens = await loadTokens();
  if (existingTokens) {
    const answer = await question('Patreon is already configured. Reconfigure? (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      print('\nSetup cancelled.');
      rl.close();
      return;
    }
  }

  // Step 1: OAuth
  print('Step 1/3: Authentication');
  const result = await startOAuthFlow(clientId, clientSecret);

  if (!result.success) {
    print(`\n❌ Authorization failed: ${result.error}`);
    rl.close();
    process.exit(1);
  }

  print('✓ Authenticated successfully!\n');

  // Step 2: Detect creators
  print('Step 2/3: Detecting Swift/iOS Creators');
  print('Scanning your subscriptions...\n');

  const patreon = new PatreonSource();
  const allCreators = await patreon.getSubscribedCreators();
  const swiftCreators = allCreators.filter(c => c.isSwiftRelated);

  if (allCreators.length === 0) {
    print('No Patreon subscriptions found.');
    print('Subscribe to iOS/Swift creators on Patreon, then run setup again.');
    rl.close();
    return;
  }

  // Display creators with pre-selection
  const selected = new Set(swiftCreators.map(c => c.id));

  print(`Found ${allCreators.length} subscriptions:\n`);

  function displayCreators(): void {
    allCreators.forEach((c, i) => {
      const check = selected.has(c.id) ? '✓' : ' ';
      const swift = c.isSwiftRelated ? ' (Swift/iOS)' : '';
      print(`  ${check} [${i + 1}] ${c.name}${swift}`);
    });
  }

  displayCreators();

  print('\nToggle numbers to change selection, or press Enter to confirm.');

  while (true) {
    const input = await question('\nToggle (or Enter to confirm): ');

    if (input.trim() === '') {
      break;
    }

    const nums = input.split(/[\s,]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));

    for (const num of nums) {
      if (num >= 1 && num <= allCreators.length) {
        const creator = allCreators[num - 1];
        if (selected.has(creator.id)) {
          selected.delete(creator.id);
        } else {
          selected.add(creator.id);
        }
      }
    }

    print('\nUpdated selection:');
    displayCreators();
  }

  if (selected.size === 0) {
    print('\n⚠️  No creators selected. You can run setup again later.');
    rl.close();
    return;
  }

  // Save selected creators
  patreon.saveEnabledCreators(Array.from(selected));

  // Step 3: Initial sync
  print('\nStep 3/3: Initial Sync');
  print(`Fetching content from ${selected.size} creator(s)...\n`);

  const patterns = await patreon.fetchPatterns();

  const creatorStats = new Map<string, { posts: number; withCode: number }>();
  for (const p of patterns) {
    if (!creatorStats.has(p.creator)) {
      creatorStats.set(p.creator, { posts: 0, withCode: 0 });
    }
    const stats = creatorStats.get(p.creator)!;
    stats.posts++;
    if (p.hasCode) stats.withCode++;
  }

  for (const [creatorId, stats] of creatorStats) {
    const creator = allCreators.find(c => c.id === creatorId);
    print(`  ${creator?.name || creatorId}: ${stats.posts} posts (${stats.withCode} with code)`);
  }

  // Mark as configured
  const sourceManager = new SourceManager();
  sourceManager.markSourceConfigured('patreon');

  print('\n✅ Setup complete!\n');
  print(`Found ${patterns.length} posts across ${selected.size} creator(s).`);
  print("Use 'get_patreon_patterns' in your AI assistant to search them.\n");

  rl.close();
}

// Parse args
const args = process.argv.slice(2);

if (args.includes('--patreon') || args.includes('-p')) {
  setupPatreon().catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
} else if (args.includes('--help') || args.includes('-h')) {
  print('swift-patterns-mcp setup\n');
  print('Usage:');
  print('  swift-patterns-mcp setup --patreon    Set up Patreon integration');
  print('  swift-patterns-mcp setup --help       Show this help');
  process.exit(0);
} else {
  print('swift-patterns-mcp setup\n');
  print('Available options:');
  print('  --patreon    Set up Patreon integration');
  print('\nRun: swift-patterns-mcp setup --patreon');
  process.exit(0);
}
```

**Step 2: Verify build compiles**

Run: `npm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/cli/setup.ts
git commit -m "feat(cli): add interactive Patreon setup wizard"
```

---

## Task 5: Update MCP Server Integration

**Files:**
- Modify: `src/index.ts`

**Step 1: Update get_patreon_patterns handler**

Find this code block in `src/index.ts`:

```typescript
case "get_patreon_patterns": {
  if (!sourceManager.isSourceConfigured('patreon')) {
```

Replace the entire case block with:

```typescript
case "get_patreon_patterns": {
  if (!sourceManager.isSourceConfigured('patreon')) {
    return {
      content: [{
        type: "text",
        text: `⚙️ Patreon not configured.

Set it up with: swift-patterns-mcp setup --patreon`,
      }],
    };
  }

  const topic = args?.topic as string;
  const requireCode = args?.requireCode as boolean;

  const patreon = new PatreonSource();
  let patterns = topic
    ? await patreon.searchPatterns(topic)
    : await patreon.fetchPatterns();

  if (requireCode) {
    patterns = patterns.filter(p => p.hasCode);
  }

  if (patterns.length === 0) {
    return {
      content: [{
        type: "text",
        text: `No Patreon patterns found${topic ? ` for "${topic}"` : ''}${requireCode ? ' with code' : ''}.`,
      }],
    };
  }

  const formatted = patterns.slice(0, 10).map(p => `
## ${p.title}
**Creator**: ${p.creator}
**Date**: ${new Date(p.publishDate).toLocaleDateString()}
${p.hasCode ? '**Has Code**: ✅' : ''}
**Topics**: ${p.topics.length > 0 ? p.topics.join(', ') : 'General'}

${p.excerpt}...

**[Read full post](${p.url})**
`).join('\n---\n');

  return {
    content: [{
      type: "text",
      text: `# Patreon Patterns${topic ? `: ${topic}` : ''}

Found ${patterns.length} posts from your subscriptions:

${formatted}

${patterns.length > 10 ? `\n*Showing top 10 of ${patterns.length} results*` : ''}`,
    }],
  };
}
```

**Step 2: Add PatreonSource import at the top**

Find this line:

```typescript
let PatreonSource: any = null;
```

Keep that, but also add below the catch block (around line 24):

```typescript
// Import PatreonSource class for use
import PatreonSourceClass from './sources/premium/patreon.js';
```

Then update the get_patreon_patterns case to use:

```typescript
const patreon = new PatreonSourceClass();
```

**Step 3: Verify build compiles**

Run: `npm run build`
Expected: No errors

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(mcp): integrate Patreon patterns into MCP server"
```

---

## Task 6: Test End-to-End Flow

**Step 1: Build the project**

Run: `npm run build`
Expected: Build succeeds

**Step 2: Test CLI help**

Run: `node build/cli/setup.js --help`
Expected: Shows help text

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: finalize Patreon OAuth implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | OAuth Flow Handler | `patreon-oauth.ts` |
| 2 | Zip Extractor | `patreon-zip.ts` |
| 3 | API Client Update | `patreon.ts` |
| 4 | CLI Setup Wizard | `cli/setup.ts` |
| 5 | MCP Server Integration | `index.ts` |
| 6 | End-to-End Test | Build verification |
