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

  getLicenceStatus(licenceName: string): Locator {
    return this.getLicenceRow(licenceName).getByText(/^Creating$/, { exact: true });
  }

  getLicenceViewDetailsButton(licenceName: string): Locator {
    return this.getLicenceRow(licenceName).locator('[qid="viewSlic-2"]');
  }

  getLicenceEditButton(licenceName: string): Locator {
    return this.getLicenceRow(licenceName).locator('[qid="viewSlic-3"]');
  }

  getLicenceDeleteButton(licenceName: string): Locator {
    return this.getLicenceRow(licenceName).locator('[qid="viewSlic-4"]');
  }

  async deleteLicence(licenceName: string) {
    await this.waitForLicenceActive(licenceName);
    await this.openLicenceActions(licenceName);
    await this.getLicenceDeleteButton(licenceName).click();
    // Confirm in the "Delete?" modal
    await this.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    // Dismiss the "being deleted" confirmation dialog
    await this.page.getByRole('dialog').getByRole('button', { name: 'Back to School Licences' }).click();
    // Poll with refresh until the row disappears (passes through a "Deleting" intermediate state)
    const row = this.getLicenceRow(licenceName);
    const refreshBtn = this.page.getByRole('button', { name: /refresh/i });
    for (let i = 0; i < 20; i++) {
      if (!(await row.isVisible())) break;
      await refreshBtn.click();
      await this.page.waitForTimeout(3000);
    }
  }
}
