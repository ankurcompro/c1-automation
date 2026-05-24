import { test, expect } from '@playwright/test';
import { SupportAdminDashboardPage } from '../pages/SupportAdminDashboardPage';
import { SupportAdminSchoolLicencesPage } from '../pages/SupportAdminSchoolLicencesPage';
import { SupportAdminCreateLicencePage } from '../pages/SupportAdminCreateLicencePage';

const SCHOOL_NAME = 'Ankur Test School';

test.describe('Licence Creation - Form Validation', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    const dashboard = new SupportAdminDashboardPage(page);
    await dashboard.goto();
    await dashboard.searchAndSelectSchool(SCHOOL_NAME);
    await dashboard.openSchoolLicences();

    const licencesPage = new SupportAdminSchoolLicencesPage(page);
    await licencesPage.clickCreateLicence();
  });

  test(
    'TC_001: Licence name field tooltip shows 60 character limit message',
    { tag: ['@validation', '@tooltip', '@licence-name'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      await createPage.hoverLicenceNameTooltip();
      await expect(createPage.licenceNameTooltip).toBeVisible();
      const descTexts = await createPage.licenceNameTooltipDescriptions.allTextContents();
      expect(descTexts.join(' ')).toContain('Limit max number of characters to 60.');
    }
  );

  test(
    'TC_002: Error shown when Licence name exceeds 60 characters',
    { tag: ['@negative', '@validation', '@licence-name', '@character-limit'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      await createPage.fillName('a'.repeat(61));
      await expect(createPage.licenceNameError).toHaveText(
        'You have exceeded the maximum number of 60 characters for this field.'
      );
    }
  );

  test(
    'TC_003: Review button is disabled on initial page load',
    { tag: ['@validation', '@review-button', '@initial-state'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      await expect(createPage.reviewButton).toBeDisabled();
    }
  );

  test(
    'TC_004: Error shown when a duplicate Entitlement ID is added',
    { tag: ['@negative', '@validation', '@entitlement-id', '@duplicate'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      await createPage.addEntitlementId('ENT12345');
      await createPage.addDuplicateEntitlementId('ENT12345');
      await expect(createPage.duplicateEntitlementError).toHaveText(
        'This Entitlement ID has already been added'
      );
    }
  );

  test(
    'TC_005: Warning shown and add entitlement field disabled when 20 Entitlement IDs are added',
    { tag: ['@validation', '@entitlement-id', '@max-limit'] },
    async ({ page }) => {
      test.setTimeout(180000);

      const createPage = new SupportAdminCreateLicencePage(page);

      for (let i = 1; i <= 20; i++) {
        await createPage.addEntitlementId(`ENT${String(i).padStart(5, '0')}`);
      }

      await expect(createPage.maxEntitlementsWarning).toHaveText(
        'The maximum number of 20 IDs per licence has been reached'
      );
      await expect(createPage.addEntitlementButton).toBeDisabled();
    }
  );

  test(
    'TC_006: Historical start dates can be selected from the start date field',
    { tag: ['@validation', '@date-picker', '@start-date'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      // Navigate 1 month back to April 2026 and select a past date
      await createPage.selectStartDate(1, 'Apr', 2026, -1);

      await expect(page.locator('#schoolLicenceStartDate')).not.toHaveValue('');
    }
  );

  test(
    'TC_007: End date picker disables all dates before the selected start date',
    { tag: ['@validation', '@date-picker', '@end-date'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      // Set a future start date (1 month ahead = June 2026)
      await createPage.selectStartDate(1, 'Jun', 2026, 1);

      // Open end date picker — it opens on the current month (May 2026)
      // All May dates are before June 1, so they should all be disabled
      const endPicker = await createPage.openEndDatePicker();
      await expect(endPicker.locator('td.owl-dt-calendar-cell-disabled').first()).toBeVisible();
    }
  );

  test(
    'TC_008: Error shown when end date is manually entered earlier than start date',
    { tag: ['@negative', '@validation', '@date-picker', '@end-date'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      await createPage.selectStartDate(1, 'Jun', 2026, 1);
      // End date input is readonly — force the value via native setter to trigger Angular validation
      await createPage.forceSetEndDate('Fri, May 01, 2026');

      await expect(createPage.endDateError).toHaveText("End date can't be earlier than start date");
    }
  );

  test(
    'TC_009: Review button becomes enabled when all required fields are completed',
    { tag: ['@positive', '@validation', '@review-button'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      await createPage.addEntitlementId('ENT12345');
      await createPage.fillFormFields('Test Licence', '100');

      await expect(createPage.reviewButton).toBeEnabled();
    }
  );

  test(
    'TC_010: Error and tooltip shown when invalid character is entered in Student Limit field',
    { tag: ['@negative', '@validation', '@student-limit', '@tooltip'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      // input[type=number] blocks letters; use a decimal (1.5) which browser accepts
      // but Angular's whole-number validator rejects as invalid
      await createPage.enterInvalidStudentLimit('1.5');
      await expect(createPage.studentLimitError).toHaveText('Please enter a valid number');

      await createPage.hoverStudentLimitTooltip();
      await expect(createPage.studentLimitTooltip).toBeVisible();
      const tooltipTexts = await createPage.studentLimitTooltipDescriptions.allTextContents();
      expect(tooltipTexts.join(' ')).toContain(
        "Number of active students that can access the course materials. Access continues if the limit is exceeded, but usage will be tracked against the limit you set. The number must be a whole number and can't have decimals, alpha or special characters."
      );
    }
  );
});
