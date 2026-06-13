# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Tests

The default workflow is **three steps, in order**:

1. **Playwright MCP server** — run tests interactively via MCP browser tools (`mcp__playwright__*`) to navigate, verify each case, and report any failures via the GitHub MCP server.
2. **Playwright CLI (headless)** — immediately after the MCP run, run the same tests via `npx playwright test` (headless by default) to produce video recordings. Do not report GitHub issues from this run.
3. **Email report** — after the CLI run completes, send a test run summary email via the Resend MCP server (`resend-mcp`). Include: suite name, date, environment, browser, OS, pass/fail counts, failed test details with GitHub issue links, and list of passed tests.

**CLI usage:**

```bash
# Run all tests
npx playwright test

# Run a specific test file
npx playwright test tests/licence-form-validation.spec.ts

# Run in headed mode (visible browser)
npx playwright test tests/licence-form-validation.spec.ts --headed

# Run by tag
npx playwright test --grep @negative

# Open the HTML report after a run
npx playwright show-report
```

There are no `npm run` scripts — always use `npx playwright test` directly.

`test.only` is allowed locally for focused runs. It is blocked on CI (`forbidOnly: true`), so never commit `test.only`.

## Test Run Improvements

- **Follow the three-step default:** MCP server run first (verification + issue reporting), then CLI run (video recording), then email report via Resend MCP. Never skip any step.
- **Use the Page Object Model during the MCP run too.** Drive the interactive MCP run with the same locators/actions defined in `pages/` (role + accessible name, e.g. `getByRole('link', { name: 'Cambridge One Home' })`), not improvised CSS selectors or `browser_evaluate` hacks. If a locator/action is missing, add it to the page object rather than inlining it. The MCP run and the CLI spec should stay consistent.
- **Always run the browser maximized.** Use `browser_resize` (or equivalent) to set the viewport to the full screen size before starting a test run.

## Authentication

`global-setup.ts` runs before any test suite. It launches Chromium, logs in, and saves the browser's storage state to `auth/storageState.chromium.json`. Tests consume the saved state so they start already authenticated — no login steps needed inside test files.

**Login credentials never come from `.env`.** Each suite reads its login from its own test-context data file, so different suites can use different users:
- `global-setup.ts` parses `testcontexts/GenericTestData.txt` (`Login email - …` / `Login password - …`) for the SupportAdmin user.
- `testcontexts/NEMO-24311/generate-auth.mjs` parses `NEMO_24311_test_data.txt` (`Login as admin with '<email>' as email and '<password>' as password`).

When adding a suite, put its login in that suite's `*_test_data.txt` and parse it in setup — do not add `LOGIN_*` vars to `.env`.

Firefox and WebKit login calls are commented out in `global-setup.ts` (and their projects are also commented out in `playwright.config.ts`). To re-enable a browser, uncomment the corresponding `login(...)` line in `global-setup.ts` and the matching project in `playwright.config.ts`.

If auth fails or the session is stale, delete the files in `auth/` and re-run; `global-setup` will regenerate them.

## Execution Configuration

Defined in `playwright.config.ts`:

| Setting | Local | CI |
|---------|-------|----|
| Workers | 2 | 1 |
| Retries | 0 | 2 |
| Within-file order | Sequential (`fullyParallel: false`) | Sequential |
| Video | `on` (every run) | `on` (every run) |
| Trace | `on-first-retry` | `on-first-retry` |
| Screenshot | `only-on-failure` | `only-on-failure` |

`fullyParallel: false` means test files can run in parallel across workers, but tests **within a single file always run sequentially** in definition order. This is required for test suites where later tests depend on state created by earlier ones (e.g. TC_015 relies on TC_014 having created a licence). Do **not** use `test.describe.serial()` to achieve ordering — it skips remaining tests on any failure, which is not the desired behaviour here.

Video is recorded for every run. To save space, change `video: 'on'` to `'retain-on-failure'` in `playwright.config.ts`.

## Test Suites & Auth Models

Two independent suites live in `tests/`, each driven by a **different login user and storage state**:

| Suite | Page object | User / auth | Storage state |
|-------|-------------|-------------|---------------|
| `licence-form-validation.spec.ts` | `SupportAdmin*Page` | SupportAdmin — credentials parsed from `testcontexts/GenericTestData.txt` by `global-setup.ts` | `auth/storageState.chromium.json` (config default) |
| `nemo-24311-warning-modal.spec.ts` | `SchoolAdminBulkFormsPage` | MQA Sierra school admin (`asgardmqaadmin1@mailsac.com`), **not** the global-setup user | `auth/storageState.nemo24311.json` via per-file `test.use({ storageState })` |

The NEMO-24311 storage state is generated out-of-band by `testcontexts/NEMO-24311/generate-auth.mjs` (run `node testcontexts/NEMO-24311/generate-auth.mjs`), **not** by `global-setup.ts`. Its session token is **short-lived** — regenerate it immediately before **both** the MCP run and the CLI run. If the token expires mid-run, every subsequent test fails fast with "Not authenticated — redirected to /login" (the guard in `SchoolAdminBulkFormsPage.goto`).

When adding a suite that needs a non-default user, follow the NEMO-24311 pattern: a dedicated `generate-auth.mjs` + `test.use({ storageState })` at the top of the spec, rather than changing `global-setup.ts`.

## Architecture

### Page Object Model (POM)

All page interactions live in `pages/`. Each page class:
- Takes a `Page` from Playwright in its constructor
- Exposes locators as `get` properties (returning `Locator`)
- Exposes actions as `async` methods
- Has `waitFor*` helpers for async state (e.g. `waitForErrorHeader`)

Page class names are **prefixed with the user type** — e.g. `SupportAdmin` — so classes are identifiable by which user role interacts with them.

### Licence Lifecycle Helpers

`SupportAdminSchoolLicencesPage` has two helpers that encapsulate the full licence lifecycle:

- **`waitForLicenceActive(licenceName)`** — polls with the Refresh button until the licence row shows "Active". Use before any operation that requires an Active licence (edit, delete).
- **`deleteLicence(licenceName)`** — waits for Active, opens the actions kebab menu, clicks Delete, confirms in the "Delete?" modal, dismisses the "being deleted" dialog, then polls until the row disappears. Handles the intermediate "Deleting" status automatically.

### Test Cleanup Pattern

Tests that successfully create a licence must clean it up in `test.afterAll`. The standard pattern:

```typescript
test.afterAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: 'auth/storageState.chromium.json' });
  const page = await context.newPage();
  try {
    // navigate to licences page, then:
    await licencesPage.deleteLicence(LICENCE_NAME);
  } catch {
    // licence absent or already deleted — safe to ignore
  } finally {
    await context.close();
  }
});
```

Only tests that call `waitForSuccessDialog()` actually create a persistent licence. Tests that end with `waitForErrorHeader()` leave no record in the database.

### Test Files

Tests in `tests/` follow this structure:
- One `test.describe` block per feature/scenario
- `test.setTimeout(ms)` set once at the describe level as the default for all tests and `beforeEach` hooks in that block
- `beforeEach` navigates to the starting state (avoids repeating navigation in every test)
- Individual test cases tagged with `{ tag: [...] }` using `@scope` strings
- Tests that need a longer timeout override with `test.setTimeout(ms)` at the start of the test body

### Reporters

Three reporters run on every `npx playwright test` execution (wired in `playwright.config.ts`):

1. **`list`** — stdout progress
2. **`html`** — browsable HTML report (`npx playwright show-report`)
3. **`./reporters/video-rename-reporter`** — copies each recording into `videos/` named by test-case ID (see [Coding Improvements](#coding-improvements)).

A fourth reporter, **`./reporters/github-issue-reporter`**, is present in the repo but **currently commented out** in `playwright.config.ts`. Re-enable it (uncomment the reporter line) to auto-file issues on CLI failures. When enabled, on any test failure during `npx playwright test` it:
   - Searches GitHub for an existing open issue with the same title to avoid duplicates (searches by `automation-failure` label + title)
   - Uploads the failure screenshot to `test-screenshots/failure-{timestamp}.png` in the repo
   - Creates a GitHub issue with the error diff, stack trace, and screenshot link
   - Requires `.env`: `GITHUB_TOKEN`, `GITHUB_REPO` (`owner/repo`), `GITHUB_ASSIGNEE`
   - Disabled (with a console warning) if any of those env vars are missing

> **This auto-reporter does not fire during Playwright MCP server runs.** The GitHub MCP server (`mcp__github__create_issue`) is the default for all failure reporting — see [GitHub Reporting](#github-reporting).

## Selector Strategy

Apply selectors in this priority order:

1. `qid` or `id` attribute — preferred
2. Unique class scoped inside a parent element
3. Unique attribute value scoped inside a parent element
4. Element text — only when none of the above are feasible
5. Avoid tag name selectors — do not prefix selectors with any HTML element name (`div`, `span`, `ul`, `li`, `p`, `small`, `img`, `button`, `tr`, `td`, etc.). Use class, `qid`, `id`, or attribute selectors on their own.

## Test Authoring Rules

- **Assert against the spec, not the app.** If a test fails because the app output differs from the specification, do NOT update the expected value to make the test green. The failure is the bug report — leave the assertion as written and raise the discrepancy with the dev team.
- Set the default timeout once at `test.describe` level. Tests requiring more time override with their own `test.setTimeout()` inside the test body.

## Coding Improvements

- **Scroll before asserting text.** When verifying text on a page, scroll the target element into view before asserting, so the assertion runs against a fully-rendered, visible element.
- **Video file naming.** The `./reporters/video-rename-reporter` copies each test's recording into `videos/` named `<TC-id>__<title>__<status>.webm` (e.g. `TC-002__No_modal_when_form_empty...__passed.webm`) so recordings map back to their test case. Playwright's originals stay in `test-results/<hash>/video.webm` (the HTML report still links to those). Test titles **must** start with the TC id (e.g. `TC-001 ...`) for the prefix to be picked up. `videos/` is never auto-cleaned — files from previous runs accumulate there.
- **Do not pass `--reporter` on the CLI.** Passing `--reporter=list` (or any reporter flag) replaces all reporters in `playwright.config.ts`, silently disabling `video-rename-reporter`. Always run `npx playwright test` without a `--reporter` flag so all three configured reporters fire.

## GitHub Reporting

- **Only report failures via the GitHub MCP server** (`mcp__github__create_issue`) when tests are run via the **Playwright MCP server**.
- Do **not** create GitHub issues for failures from `npx playwright test` CLI runs.
- Label issues as `bug`. Include failure screenshot, OS version, and browser version in every issue.
- **Before creating an issue**, search for an existing open issue with the same test case ID (`mcp__github__search_issues`). If it still exists, do not duplicate. If it has been deleted or closed, create a fresh one.
- **Always explain a failure to the user before creating a GitHub issue.** For each failing test, describe: what the test asserts, what the app actually showed, and why the assertion fails. Then ask the user to confirm before calling `mcp__github__create_issue`.

## Email Reporting

Test run reports are sent via the **Resend MCP server** (`resend-mcp`, configured in `.mcp.json`).

Recipients are managed in `.env`:
```
REPORT_EMAIL_RECIPIENTS=email1@example.com,email2@example.com
```

Add or remove addresses from that comma-separated list to control who receives reports. The Resend API key is stored in `.mcp.json` under the `resend` server env.

## Test Case JSON Authoring

When asked to generate test cases, by default:
1. Derive test cases from the Acceptance Criteria listed in `testcontexts/ACs.txt`
2. Fetch pre-requisite steps from `testcontexts/GeneralPreRequisite.txt` and include them in **every** test case

When writing test cases in `test-cases.json`, include the generic pre-requisites from `GeneralPreRequisite.txt` in **every** test case.

These steps must appear at the start of the `steps` (or equivalent) array for each test case, before the test-specific steps.

**Test case order must match ACs.txt.** Assign TC IDs in the exact top-to-bottom sequence the Acceptance Criteria appear in `ACs.txt`. Do not reorder by AC number, type, or any other criterion.

## Generating Playwright Tests from test-cases.json

When asked to implement/generate Playwright test scripts from the json file, use the **Playwright MCP server only** (`mcp__playwright__*`). Do not use the Playwright CLI (`npx playwright test`) for this purpose.

## Test Context Files (`testcontexts/`)

| File | Purpose |
|------|---------|
| `ACs.txt` | Acceptance Criteria for the current feature under test |
| `ACs_TC1_to_TC10.txt` | ACs for the first TC batch (licence suite) |
| `GeneralPreRequisite.txt` | Pre-requisite steps included in every test case |
| `GenericTestData.txt` | Environment URL, SupportAdmin login, and test school name |
| `test-cases-tc1-to-tc10.json` | Generated test cases (TC-001–TC-010) for the licence suite |
| `test-cases-tc11-to-tc16.json` | Generated test cases (TC-011–TC-016) for the licence suite |
| `NEMO-24311/` | Suite-specific data: CSVs, test data file, `generate-auth.mjs` |

## Environments

| Name | Description |
|------|-------------|
| `thor` | Micro-nemo dev environment (default in `global-setup.ts`) |
| `qa` | QA environment (requires Cloudflare credentials) |
| `rel` | Release environment (requires Cloudflare credentials) |
| `prod` | Production environment |