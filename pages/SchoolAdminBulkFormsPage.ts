import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object for the school-admin bulk "add students" forms covered by
 * NEMO-24311 (warning modal when navigating away from a dirty bulk form).
 *
 * Five forms share one header (CUP logo, notification bell, account menu) and a
 * common "leave page" guard. Class names are prefixed with the user role
 * (SchoolAdmin) per repo convention.
 */

const ORG_BASE =
  'https://micro-nemo.comprodls.com/admin/admin/org_mqa-sierra-thor';

export const BULK_FORM_URLS = {
  new_child_username: `${ORG_BASE}/children/new_csv`,
  new_adult_username: `${ORG_BASE}/username-adult/new_csv`,
  new_adult_email: `${ORG_BASE}/email-adult/invite`,
  existing_child_username: `${ORG_BASE}/username/existing`,
  existing_adult_email: `${ORG_BASE}/email/invite`,
} as const;

export type BulkFormKey = keyof typeof BULK_FORM_URLS;

export class SchoolAdminBulkFormsPage {
  constructor(private readonly page: Page) {}

  // ---- header / global navigation triggers ----
  get cupLogo(): Locator {
    return this.page.getByRole('link', { name: 'Cambridge One Home' });
  }
  get backLink(): Locator {
    return this.page.getByRole('link', { name: 'Go Back' });
  }
  get notificationBell(): Locator {
    return this.page.getByRole('button', { name: /Notifications/ });
  }
  get accountMenuButton(): Locator {
    return this.page.getByRole('button', { name: 'Manage your account' });
  }
  get myProfileLink(): Locator {
    return this.page.getByRole('link', { name: 'My profile' });
  }
  get logoutButton(): Locator {
    return this.page.getByRole('button', { name: 'Log out' });
  }
  get uploadButton(): Locator {
    return this.page.getByRole('button', { name: 'Upload file' });
  }

  // ---- modals ----
  get warningDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Warning' });
  }
  get leaveDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Leave this page?' });
  }

  async goto(form: BulkFormKey) {
    await this.page.goto(BULK_FORM_URLS[form]);
    await this.page.waitForLoadState('domcontentloaded');
    // Fail fast (and clearly) if the session has expired and we were bounced to
    // the login page, instead of waiting out the per-test timeout on a missing
    // form element.
    if (/\/login/.test(this.page.url())) {
      throw new Error(
        'Not authenticated — redirected to /login. Regenerate auth: ' +
          'node testcontexts/NEMO-24311/generate-auth.mjs',
      );
    }
  }

  /** Upload a CSV via the "+ Upload file" button's hidden file chooser. */
  async uploadCsv(absolutePath: string) {
    const [chooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.uploadButton.click(),
    ]);
    await chooser.setFiles(absolutePath);
  }

  /** Open the bell, then click the first notification in the drop-down. */
  async clickFirstNotification() {
    await this.notificationBell.click();
    await this.page
      .getByRole('region', { name: 'notifications' })
      .getByRole('button')
      .filter({ hasText: /ready|available/ })
      .first()
      .click();
  }

  async openAccountMenu() {
    await this.accountMenuButton.click();
  }

  /** Assert the username-create-form "Warning" modal (data is discarded). */
  async expectWarningModal() {
    await expect(this.warningDialog).toBeVisible();
    await expect(
      this.warningDialog.getByRole('heading', { name: 'Warning' }),
    ).toBeVisible();
    await expect(
      this.warningDialog.getByText(
        'If you leave this page now, all the data in the form will be lost.',
      ),
    ).toBeVisible();
    await expect(
      this.warningDialog.getByText('Do you still want to leave?'),
    ).toBeVisible();
    await expect(
      this.warningDialog.getByRole('link', { name: 'Yes, leave the page' }),
    ).toBeVisible();
    await expect(
      this.warningDialog.getByRole('link', { name: 'No, go back to the form' }),
    ).toBeVisible();
  }

  /**
   * Assert the email / existing-account "Leave this page?" modal (form saved).
   * `body` differs slightly between the adult-email and existing-child forms.
   */
  async expectLeaveModal(body: string) {
    await expect(this.leaveDialog).toBeVisible();
    await expect(
      this.leaveDialog.getByRole('heading', { name: 'Leave this page?' }),
    ).toBeVisible();
    await expect(this.leaveDialog.getByText(body)).toBeVisible();
    await expect(this.leaveDialog.getByText("I'll return later")).toBeVisible();
    await expect(this.leaveDialog.getByText('Back to form')).toBeVisible();
  }

  /** No leave-guard modal of either kind is present. */
  async expectNoModal() {
    await expect(this.warningDialog).toHaveCount(0);
    await expect(this.leaveDialog).toHaveCount(0);
  }
}
