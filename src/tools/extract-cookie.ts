import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.patreon.com/login');

  console.log('Please log in, then press Enter in this terminal:');
  await new Promise(resolve => process.stdin.once('data', resolve));

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'session_id');
  if (!sessionCookie) {
    console.error('Session cookie not found!');
    process.exit(1);
  }

  fs.writeFileSync('.patreon-session', sessionCookie.value);
  console.log('Saved session_id!');
  await browser.close();
})();
