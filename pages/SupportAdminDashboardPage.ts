import { Page } from '@playwright/test';

export class SupportAdminDashboardPage {
  readonly page: Page;
  private readonly url = 'https://micro-nemo.comprodls.com/';

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(this.url);
    await this.page.keyboard.press('Escape');
  }

  async searchAndSelectSchool(schoolName: string) {
    const searchInput = this.page.locator('#search-group-dashboard');
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill(schoolName);
    await this.page
      .locator('.search-group-dropdown .dropdown-item')
      .filter({ hasText: `${schoolName} in Schools` })
      .click();
    await this.page
      .locator('.school-name')
      .filter({ hasText: schoolName })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
  }

  async openSchoolLicences() {
    await this.page.locator('[qid="sa-skl-5"]').click();
    await this.page.locator('[qid="sa-skl-10"]').click();
  }
}
