import { Page, Locator } from '@playwright/test';

export class SupportAdminCreateLicencePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async fillName(name: string) {
    await this.page.getByPlaceholder('Enter licence name').fill(name);
  }

  async fillStudentLimit(limit: string) {
    await this.page.getByRole('spinbutton').fill(limit);
  }

  private async pickDate(
    inputId: string,
    pickerIndex: number,
    day: number,
    monthName: string,
    year: number,
    monthsAhead = 0
  ) {
    await this.page.locator(`#${inputId}`).click();
    const picker = this.page.locator(`#owl-dt-picker-${pickerIndex}`);
    await picker.waitFor({ state: 'visible', timeout: 5000 });
    const nextBtn = picker.getByRole('button', { name: 'Next month' });
    for (let i = 0; i < monthsAhead; i++) {
      await nextBtn.click();
    }
    await picker.getByRole('cell', { name: `${monthName} ${day}, ${year}` }).click();
    await picker.getByRole('button', { name: 'Set' }).click();
  }

  async fillFormFields(licenceName: string, studentLimit: string) {
    await this.fillName(licenceName);
    await this.fillStudentLimit(studentLimit);
    // picker-0 = start date (May 15, 2026 — current month, no navigation)
    await this.pickDate('schoolLicenceStartDate', 0, 15, 'May', 2026, 0);
    // picker-1 = end date (May 30, 2027 — 12 months ahead)
    await this.pickDate('schoolLicenceEndDate', 1, 30, 'May', 2027, 12);
  }

  async addEntitlementId(id: string) {
    await this.page.locator('button.add-ent-id').click();
    const idInput = this.page.getByPlaceholder('Enter Entitlement ID').last();
    await idInput.waitFor({ state: 'visible', timeout: 5000 });
    await idInput.click();
    await idInput.fill(id);
    await this.page.locator('button.add-btn').click();
  }

  async addDuplicateEntitlementId(id: string) {
    await this.page.locator('button.add-ent-id').click();
    const idInput = this.page.getByPlaceholder('Enter Entitlement ID').last();
    await idInput.waitFor({ state: 'visible', timeout: 5000 });
    await idInput.fill(id);
  }

  async selectStartDate(day: number, monthAbbr: string, year: number, monthOffset = 0) {
    await this.page.locator('#schoolLicenceStartDate').click();
    const picker = this.page.locator('#owl-dt-picker-0');
    await picker.waitFor({ state: 'visible', timeout: 5000 });
    if (monthOffset > 0) {
      const nextBtn = picker.getByRole('button', { name: 'Next month' });
      for (let i = 0; i < monthOffset; i++) await nextBtn.click();
    } else if (monthOffset < 0) {
      const prevBtn = picker.getByRole('button', { name: 'Previous month' });
      for (let i = 0; i < Math.abs(monthOffset); i++) await prevBtn.click();
    }
    await picker.getByRole('cell', { name: `${monthAbbr} ${day}, ${year}` }).click();
    await picker.getByRole('button', { name: 'Set' }).click();
  }

  async openEndDatePicker(): Promise<Locator> {
    await this.page.locator('#schoolLicenceEndDate').click();
    const picker = this.page.locator('#owl-dt-picker-1');
    await picker.waitFor({ state: 'visible', timeout: 5000 });
    return picker;
  }

  async forceSetEndDate(value: string) {
    // End date input is readonly; use native setter to trigger Angular validation
    await this.page.evaluate((val: string) => {
      const input = document.querySelector('#schoolLicenceEndDate') as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeSetter.call(input, val);
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }, value);
    await this.page.waitForTimeout(500);
  }

  async enterInvalidStudentLimit(value: string) {
    // input[type=number] blocks alphabetic chars; use native setter with a decimal to trigger validation
    await this.page.evaluate((val: string) => {
      const input = document.querySelector('#create-school-licence-user-limit') as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeSetter.call(input, val);
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }, value);
    await this.page.waitForTimeout(500);
  }

  async clickReview() {
    await this.page.locator('[qid="create-ent-2"]').click();
  }

  async clickCreate() {
    await this.page.locator('button.btn-create').click();
  }

  // ── Licence name field ────────────────────────────────────────────────────

  get licenceNameTooltipIcon(): Locator {
    return this.page.locator('img[alt="Licence name info"]');
  }

  get licenceNameTooltip(): Locator {
    return this.page.locator('.custom-tooltip-wrapper:has(img[alt="Licence name info"]) .custom-tooltip');
  }

  get licenceNameTooltipDescriptions(): Locator {
    return this.page.locator('.custom-tooltip-wrapper:has(img[alt="Licence name info"]) .custom-tooltip-desc');
  }

  get licenceNameError(): Locator {
    return this.page.locator('small.error-info').filter({ hasText: /characters for this field/ });
  }

  async hoverLicenceNameTooltip() {
    await this.licenceNameTooltipIcon.hover();
  }

  // ── Entitlement ID section ────────────────────────────────────────────────

  get duplicateEntitlementError(): Locator {
    return this.page.locator('small.error-info.d-block.mt-1');
  }

  get maxEntitlementsWarning(): Locator {
    return this.page.locator('small.error-info.d-block').filter({ hasText: 'maximum number of 20' });
  }

  get addEntitlementButton(): Locator {
    return this.page.locator('button.add-ent-id');
  }

  // ── Date fields ───────────────────────────────────────────────────────────

  get endDateError(): Locator {
    return this.page.locator('small.error-info').filter({ hasText: "End date can't" });
  }

  // ── Student limit field ───────────────────────────────────────────────────

  get studentLimitTooltipIcon(): Locator {
    return this.page.locator('img[alt="Student limit info"]');
  }

  get studentLimitTooltip(): Locator {
    return this.page.locator('.custom-tooltip-wrapper:has(img[alt="Student limit info"]) .custom-tooltip');
  }

  get studentLimitTooltipDescriptions(): Locator {
    return this.page.locator('.custom-tooltip-wrapper:has(img[alt="Student limit info"]) .custom-tooltip-desc');
  }

  get studentLimitError(): Locator {
    return this.page.locator('small.error-info').filter({ hasText: 'Please enter a valid number' });
  }

  async hoverStudentLimitTooltip() {
    await this.studentLimitTooltipIcon.hover();
  }

  // ── Post-submit feedback ──────────────────────────────────────────────────

  get errorHeader(): Locator {
    return this.page.getByText('The following error(s) has occurred:');
  }

  get errorItems(): Locator {
    return this.page.locator('li').filter({ hasText: 'is either invalid or does not exist' });
  }

  // Top-level items in the API error list (direct children, excludes nested EID sub-lists)
  get licenceApiErrors(): Locator {
    return this.page.locator('.entitlement-error-list > .error-info');
  }

  get reviewButton(): Locator {
    return this.page.getByRole('button', { name: 'Review' });
  }

  async waitForErrorHeader(timeout = 15000) {
    await this.errorHeader.waitFor({ state: 'visible', timeout });
  }

  get successDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  async waitForSuccessDialog(timeout = 15000) {
    await this.successDialog.waitFor({ state: 'visible', timeout });
  }

  async clickBackToSchoolLicences() {
    await this.successDialog.getByRole('button', { name: 'Back to School licences' }).click();
  }
}
