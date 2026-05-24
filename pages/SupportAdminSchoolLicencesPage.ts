import { Page, Locator } from '@playwright/test';

export class SupportAdminSchoolLicencesPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async clickCreateLicence() {
    await this.page.locator('[qid="viewCreateSl-1"]').click();
  }

  getLicenceRow(licenceName: string): Locator {
    return this.page.locator('tr').filter({ hasText: licenceName });
  }

  async waitForLicenceActive(licenceName: string, maxRetries = 40, intervalMs = 5000) {
    const row = this.getLicenceRow(licenceName);
    await row.waitFor({ state: 'visible', timeout: 15000 });
    const refreshBtn = this.page.getByRole('button', { name: /refresh/i });
    for (let i = 0; i < maxRetries; i++) {
      if (await row.getByText('Active').isVisible()) break;
      await refreshBtn.click();
      await this.page.waitForTimeout(intervalMs);
    }
  }

  async openLicenceActions(licenceName: string) {
    await this.getLicenceRow(licenceName)
      .getByRole('button', { name: /open actions menu/i })
      .click();
  }

  async clickViewDetails() {
    await this.page
      .getByRole('link', { name: 'View Details' })
      .or(this.page.getByRole('button', { name: 'View Details' }))
      .first()
      .click();
  }
}
