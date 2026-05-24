import { Page, Locator } from '@playwright/test';

export class SupportAdminLicenceDetailsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async clickEntitlementsTab() {
    await this.page.locator('[qid="viewSlic-6"]').click();
  }

  getEntitlementLocator(id: string): Locator {
    return this.page.getByText(id, { exact: false });
  }
}
