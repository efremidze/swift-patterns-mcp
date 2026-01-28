#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [,, url, out] = process.argv;
const cookieFile = '.patreon-session';
const PATREON_DL_PACKAGE = 'patreon-dl@3.6.0';
const PATREON_DL_COMMAND = `npx --yes ${PATREON_DL_PACKAGE}`;

if (!fs.existsSync(cookieFile)) {
  console.log('No session cookie — running browser auth...');
  // extract-cookie.js is in build/tools/ relative to this file in build/sources/premium/
  const extractCookiePath = path.join(__dirname, '..', '..', 'tools', 'extract-cookie.js');
  execSync(`node "${extractCookiePath}"`, { stdio: 'inherit' });
}

const session = fs.readFileSync(cookieFile, 'utf8').trim();
console.log('Downloading with patreon-dl...');
execSync(`${PATREON_DL_COMMAND} -c "session_id=${session}" -o "${out}" "${url}"`, { stdio: 'inherit' });
