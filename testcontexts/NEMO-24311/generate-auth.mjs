// One-off helper: log in as the MQA Sierra school admin used by the NEMO-24311
// test data and save the storage state the spec consumes.
// Hardened: goes straight to /login, dismisses the cookie banner, waits/retries
// for the form, and verifies the saved session actually reaches a bulk form.
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../auth/storageState.nemo24311.json');

// Credentials come from this suite's test-data file, not from .env or hard-coded
// constants. The file states: Login as admin with '<email>' as email and
// '<password>' as password.
const DATA_FILE = path.resolve(__dirname, 'NEMO_24311_test_data.txt');
const dataText = fs.readFileSync(DATA_FILE, 'utf8');
const credMatch = dataText.match(/'([^']+)'\s+as email and\s+'([^']+)'\s+as password/i);
if (!credMatch) {
  throw new Error(`Could not parse login email/password from ${DATA_FILE}`);
}
const EMAIL = credMatch[1];
const PASSWORD = credMatch[2];
const FORM_URL =
  'https://micro-nemo.comprodls.com/admin/admin/org_mqa-sierra-thor/children/new_csv';

const browser = await chromium.launch();
const page = await browser.newPage();

// Go straight to the login page (avoids the flaky home-page "Log in" button).
await page.goto('https://micro-nemo.comprodls.com/login', {
  waitUntil: 'domcontentloaded',
});

// Dismiss the cookie banner if it shows.
const cookies = page.locator('button:has-text("Accept")');
if (await cookies.first().isVisible().catch(() => false)) {
  await cookies.first().click().catch(() => {});
}

await page.getByRole('textbox', { name: 'Login' }).waitFor({ timeout: 60000 });
await page.getByRole('textbox', { name: 'Login' }).fill(EMAIL);
await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
await page.getByRole('button', { name: 'Log in' }).click();

await page.waitForURL(/\/admin\//, { timeout: 60000 });
await page.waitForLoadState('networkidle').catch(() => {});

// Verify the session really reaches a bulk form before saving it.
await page.goto(FORM_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
if (/\/login/.test(page.url())) {
  await browser.close();
  throw new Error('Login did not produce an authenticated session (still on /login).');
}

await page.context().storageState({ path: OUT });
console.log('Saved authenticated storage state to', OUT);
await browser.close();
