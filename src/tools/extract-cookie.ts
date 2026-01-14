import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PROFILE_DIR = path.join(process.cwd(), '.patreon-profile');
const COOKIE_FILE = '.patreon-session';

(async () => {
  // Use persistent context - preserves login sessions across runs
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
  });

  const page = context.pages()[0] || await context.newPage();

  // Check if already logged in by looking for existing session cookie
  const existingCookies = await context.cookies('https://www.patreon.com');
  const existingSession = existingCookies.find(c => c.name === 'session_id');

  if (existingSession) {
    console.log('Found existing session from persistent profile!');
    fs.writeFileSync(COOKIE_FILE, existingSession.value);
    console.log('Saved session_id!');
    await context.close();
    return;
  }

  // No existing session, need to log in
  await page.goto('https://www.patreon.com/login');
  console.log('Please log in, then press Enter in this terminal:');
  await new Promise(resolve => process.stdin.once('data', resolve));

  const cookies = await context.cookies('https://www.patreon.com');

  // Debug: log all cookie names
  console.log('Available cookies:', cookies.map(c => c.name).join(', '));

  const sessionCookie = cookies.find(c => c.name === 'session_id');
  if (!sessionCookie) {
    console.error('Session cookie not found!');
    console.log('Full cookies:', JSON.stringify(cookies, null, 2));
    await context.close();
    process.exit(1);
  }

  fs.writeFileSync(COOKIE_FILE, sessionCookie.value);
  console.log('Saved session_id!');
  await context.close();
})();
