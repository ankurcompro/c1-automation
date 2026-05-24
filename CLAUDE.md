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
npx playwright test tests/licence-invalid-entitlement.spec.ts

# Run in headed mode (visible browser)
npx playwright test tests/licence-invalid-entitlement.spec.ts --headed

# Run by tag
npx playwright test --grep @negative

# Open the HTML report after a run
npx playwright show-report
```

There are no `npm run` scripts — always use `npx playwright test` directly.

`test.only` is allowed locally for focused runs. It is blocked on CI (`forbidOnly: true`), so never commit `test.only`.

## Test Run Improvements

- **Follow the three-step default:** MCP server run first (verification + issue reporting), then CLI run (video recording), then email report via Resend MCP. Never skip any step.
- **Always run the browser maximized.** Use `browser_resize` (or equivalent) to set the viewport to the full screen size before starting a test run.

## Authentication

`global-setup.ts` runs before any test suite. It launches Chromium, Firefox, and WebKit sequentially, logs in using credentials from `.env` (`LOGIN_EMAIL`, `LOGIN_PASSWORD`), and saves each browser's storage state to `auth/storageState.{chromium,firefox,webkit}.json`. Tests consume the saved state so they start already authenticated — no login steps needed inside test files.

Currently only the Chromium project is active in `playwright.config.ts`. Firefox and WebKit projects are commented out.

If auth fails or the session is stale, delete the files in `auth/` and re-run; `global-setup` will regenerate them.

## Execution Configuration

Defined in `playwright.config.ts`:

| Setting | Local | CI |
|---------|-------|----|
| Workers | 2 | 1 |
| Retries | 0 | 2 |
| Parallel | `fullyParallel` | `fullyParallel` |
| Video | `on` (every run) | `on` (every run) |
| Trace | `on-first-retry` | `on-first-retry` |
| Screenshot | `only-on-failure` | `only-on-failure` |

Video is recorded for every run. To save space, change `video: 'on'` to `'retain-on-failure'` in `playwright.config.ts`.

## Architecture

### Page Object Model (POM)

All page interactions live in `pages/`. Each page class:
- Takes a `Page` from Playwright in its constructor
- Exposes locators as `get` properties (returning `Locator`)
- Exposes actions as `async` methods
- Has `waitFor*` helpers for async state (e.g. `waitForErrorHeader`)

Page class names are **prefixed with the user type** — e.g. `SupportAdmin` — so classes are identifiable by which user role interacts with them.

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
3. **`./reporters/github-issue-reporter`** — CI/CLI only. On any test failure during `npx playwright test`:
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
5. Avoid tag name selectors (`div`, `span`, `small`, `img`, etc.)

## Test Authoring Rules

- **Assert against the spec, not the app.** If a test fails because the app output differs from the specification, do NOT update the expected value to make the test green. The failure is the bug report — leave the assertion as written and raise the discrepancy with the dev team.
- Set the default timeout once at `test.describe` level. Tests requiring more time override with their own `test.setTimeout()` inside the test body.

## Coding Improvements

- **Scroll before asserting text.** When verifying text on a page, scroll the target element into view before asserting, so the assertion runs against a fully-rendered, visible element.
- **Video file naming.** Prefix each test video file name with the test case ID (e.g. `TC_001`).

## GitHub Reporting

- **Only report failures via the GitHub MCP server** (`mcp__github__create_issue`) when tests are run via the **Playwright MCP server**.
- Do **not** create GitHub issues for failures from `npx playwright test` CLI runs.
- Label issues as `bug`. Include failure screenshot, OS version, and browser version in every issue.
- **Before creating an issue**, search for an existing open issue with the same test case ID (`mcp__github__search_issues`). If it still exists, do not duplicate. If it has been deleted or closed, create a fresh one.

## Email Reporting

Test run reports are sent via the **Resend MCP server** (`resend-mcp`, configured in `.mcp.json`).

Recipients are managed in `.env`:
```
REPORT_EMAIL_RECIPIENTS=email1@example.com,email2@example.com
```

Add or remove addresses from that comma-separated list to control who receives reports. The Resend API key is stored in `.mcp.json` under the `resend` server env.

## Test Case JSON Authoring

When writing test cases in `test-cases.json`, include the generic pre-requisites from `GeneralPreRequisite.txt` in **every** test case.

These steps must appear at the start of the `steps` (or equivalent) array for each test case, before the test-specific steps.

## Test Context Files (`testcontexts/`)

| File | Purpose |
|------|---------|
| `ACs.txt` | Acceptance Criteria for the feature under test |
| `GeneralPreRequisite.txt` | Pre-requisite steps included in every test case |
| `testData.txt` | Environment URL, login credentials, and test school name |
| `webtestcontext.txt` | Standing instructions for test generation (selectors, environments, authoring rules) |
| `test-cases.json` | Generated test cases in JSON format, derived from ACs |

## Environments

| Name | Description |
|------|-------------|
| `thor` | Micro-nemo dev environment (default in `global-setup.ts`) |
| `qa` | QA environment (requires Cloudflare credentials) |
| `rel` | Release environment (requires Cloudflare credentials) |
| `prod` | Production environment |