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
  console.log('Please log in. Waiting for session cookie...');

  // Poll for session cookie instead of waiting for Enter
  let cookies = await context.cookies('https://www.patreon.com');
  let sessionCookie = cookies.find(c => c.name === 'session_id');

  while (!sessionCookie) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    cookies = await context.cookies('https://www.patreon.com');
    sessionCookie = cookies.find(c => c.name === 'session_id');
  }

  console.log('Login detected!');

  // Debug: log all cookie names
  console.log('Available cookies:', cookies.map(c => c.name).join(', '));

  fs.writeFileSync(COOKIE_FILE, sessionCookie.value);
  console.log('Saved session_id!');
  await context.close();
})();
