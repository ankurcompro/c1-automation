import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_DIR = 'auth';

/**
 * Login credentials come from the suite's test-context data file, not `.env`.
 * `GenericTestData.txt` holds the SupportAdmin login as:
 *   Login email - <email>
 *   Login password - <password>
 */
function readCredentials(): { email: string; password: string } {
  const file = path.resolve(__dirname, 'testcontexts/GenericTestData.txt');
  const text = fs.readFileSync(file, 'utf8');
  const email = text.match(/Login email\s*-\s*(.+)/)?.[1]?.trim();
  const password = text.match(/Login password\s*-\s*(.+)/)?.[1]?.trim();
  if (!email || !password) {
    throw new Error(`Could not read login email/password from ${file}`);
  }
  return { email, password };
}

async function login(browserType: typeof chromium, authFile: string) {
  const { email, password } = readCredentials();
  const browser = await browserType.launch();
  const page = await browser.newPage();

  await page.goto('https://micro-nemo.comprodls.com/');
  const acceptCookies = page.locator('button:has-text("Accept cookies")');
  if (await acceptCookies.isVisible()) await acceptCookies.click();

  await page.locator('#onboarding-header-login-btn').click();
  const loginForm = page.locator('#gigya-login-form');
  await loginForm.waitFor({ state: 'visible', timeout: 30000 });
  await loginForm.locator('input[placeholder*="username" i], input[placeholder*="email" i]').first().fill(email);
  await loginForm.locator('input[type="password"]').first().fill(password);
  await loginForm.locator('input[type="password"]').first().press('Enter');
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });

  await page.context().storageState({ path: authFile });
  await browser.close();
}

async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Only Chromium is active in playwright.config.ts; skip Firefox/WebKit to avoid hangs
  await login(chromium, path.join(AUTH_DIR, 'storageState.chromium.json'));
  // await login(firefox,  path.join(AUTH_DIR, 'storageState.firefox.json'));
  // await login(webkit,   path.join(AUTH_DIR, 'storageState.webkit.json'));
}

export default globalSetup;
