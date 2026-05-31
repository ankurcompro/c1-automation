import { test, expect } from '@playwright/test';
import { SupportAdminDashboardPage } from '../pages/SupportAdminDashboardPage';
import { SupportAdminSchoolLicencesPage } from '../pages/SupportAdminSchoolLicencesPage';
import { SupportAdminCreateLicencePage } from '../pages/SupportAdminCreateLicencePage';

const SCHOOL_NAME = 'Ankur Test School';
const LICENCE_NAME_AC19 = 'TC_014 - AC19 School Licence';

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

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'auth/storageState.chromium.json',
    });
    const page = await context.newPage();
    try {
      const dashboard = new SupportAdminDashboardPage(page);
      await dashboard.goto();
      await dashboard.searchAndSelectSchool(SCHOOL_NAME);
      await dashboard.openSchoolLicences();

      const licencesPage = new SupportAdminSchoolLicencesPage(page);
      const row = licencesPage.getLicenceRow(LICENCE_NAME_AC19);
      await row.waitFor({ state: 'visible', timeout: 5000 });
      await licencesPage.deleteLicence(LICENCE_NAME_AC19);
    } catch {
      // Licence absent or already deleted — nothing to clean up
    } finally {
      await context.close();
    }
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
        'You have exceeded the maximum number of 60 characters for this field'
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

  test(
    'TC_011: Error shown when two Entitlement IDs share the same Component ID',
    { tag: ['@negative', '@validation', '@entitlement-id', '@duplicate-component'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      await createPage.fillFormFields('TC_011 Test Licence', '100');
      await createPage.addEntitlementId('21538');
      await createPage.addEntitlementId('21400');
      await createPage.clickReview();
      await createPage.clickCreate();

      await createPage.waitForErrorHeader();
      const errorItem = createPage.licenceApiErrors.filter({ hasText: 'has the same Component ID projectworkkk' });
      await expect(errorItem).toContainText('Entitlement ID 21400');
      await expect(errorItem).toContainText('21538');
    }
  );

  test(
    'TC_012: Error shown when Entitlement ID is linked to a Component that does not exist in comproDLS',
    { tag: ['@negative', '@validation', '@entitlement-id', '@invalid-component'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      await createPage.fillFormFields('TC_012 Test Licence', '100');
      await createPage.addEntitlementId('21924');
      await createPage.clickReview();
      await createPage.clickCreate();

      await createPage.waitForErrorHeader();
      await expect(
        createPage.licenceApiErrors.filter({ hasText: 'r55practiceextraaaaaaaaaa' })
      ).toContainText('21924');
    }
  );

  test(
    'TC_013: Error shown when Entitlement ID does not exist or is invalid',
    { tag: ['@negative', '@validation', '@entitlement-id', '@invalid-eid'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      await createPage.fillFormFields('TC_013 Test Licence', '100');
      await createPage.addEntitlementId('00000');
      await createPage.clickReview();
      await createPage.clickCreate();

      await createPage.waitForErrorHeader();
      await expect(
        createPage.licenceApiErrors.filter({ hasText: 'The Entitlement ID 00000' })
      ).toContainText('is either invalid or does not exist');
    }
  );

  test(
    'TC_014: Licence in Creating status has correct UI — status is Creating, Edit/Delete disabled, View Details enabled',
    { tag: ['@positive', '@licence-creation', '@status', '@kebab-menu'] },
    async ({ page }) => {
      test.setTimeout(60000);

      const createPage = new SupportAdminCreateLicencePage(page);
      const licencesPage = new SupportAdminSchoolLicencesPage(page);

      await createPage.fillFormFields(LICENCE_NAME_AC19, '100');
      await createPage.addEntitlementId('18767');
      await createPage.clickReview();
      await createPage.clickCreate();

      await createPage.waitForSuccessDialog();
      await createPage.clickBackToSchoolLicences();

      const row = licencesPage.getLicenceRow(LICENCE_NAME_AC19);
      await row.waitFor({ state: 'visible', timeout: 10000 });

      // AC19a: status badge shows Creating immediately after submission
      await expect(licencesPage.getLicenceStatus(LICENCE_NAME_AC19)).toBeVisible({ timeout: 5000 });

      // AC19b/AC19c: open kebab menu and check action button states
      await licencesPage.openLicenceActions(LICENCE_NAME_AC19);
      await expect(licencesPage.getLicenceEditButton(LICENCE_NAME_AC19)).toBeDisabled();
      await expect(licencesPage.getLicenceDeleteButton(LICENCE_NAME_AC19)).toBeDisabled();
      await expect(licencesPage.getLicenceViewDetailsButton(LICENCE_NAME_AC19)).toBeEnabled();
    }
  );

  test(
    'TC_015: Error shown when Entitlement ID is already used in another school licence',
    { tag: ['@negative', '@validation', '@entitlement-id', '@already-exists'] },
    async ({ page }) => {
      const createPage = new SupportAdminCreateLicencePage(page);

      // EID 18767 was used in TC_014's licence (LICENCE_NAME_AC19); this test
      // relies on TC_014 having run first to put 18767 into an existing licence.
      await createPage.fillFormFields('TC_015 Test Licence', '100');
      await createPage.addEntitlementId('18767');
      await createPage.clickReview();
      await createPage.clickCreate();

      await createPage.waitForErrorHeader();
      await expect(
        createPage.licenceApiErrors.filter({ hasText: 'already exists in another school licence' })
      ).toContainText('18767');
    }
  );

  test(
    'TC_016: All relevant error messages shown when multiple Entitlement ID errors are present simultaneously',
    { tag: ['@negative', '@validation', '@entitlement-id', '@combination-errors'] },
    async ({ page }) => {
      test.setTimeout(180000);

      const createPage = new SupportAdminCreateLicencePage(page);

      await createPage.fillFormFields('TC_016 Test Licence', '100');

      // AC4 inline: add duplicate EID, verify inline error, then reuse the open input for 21400
      await createPage.addEntitlementId('21538');
      await createPage.addDuplicateEntitlementId('21538');
      await expect(createPage.duplicateEntitlementError).toHaveText('This Entitlement ID has already been added');
      await page.getByPlaceholder('Enter Entitlement ID').last().fill('21400');
      await page.locator('button.add-btn').click();

      // Remaining EIDs for API errors
      await createPage.addEntitlementId('21924');  // AC14: invalid component
      await createPage.addEntitlementId('00000');  // AC15: invalid EID
      await createPage.addEntitlementId('18767');  // AC12: already in another licence

      await createPage.clickReview();
      await createPage.clickCreate();

      await createPage.waitForErrorHeader();

      // AC13: same Component ID
      await expect(
        createPage.licenceApiErrors.filter({ hasText: 'has the same Component ID projectworkkk' })
      ).toBeVisible();

      // AC14: Component does not exist
      await expect(
        createPage.licenceApiErrors.filter({ hasText: 'r55practiceextraaaaaaaaaa' })
      ).toBeVisible();

      // AC15: Entitlement ID invalid/does not exist
      await expect(
        createPage.licenceApiErrors.filter({ hasText: 'The Entitlement ID 00000' })
      ).toBeVisible();

      // AC12: EID already in another school licence
      await expect(
        createPage.licenceApiErrors.filter({ hasText: 'already exists in another school licence' })
      ).toBeVisible();
    }
  );
});
