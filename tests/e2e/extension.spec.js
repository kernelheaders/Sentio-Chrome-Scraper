import { test, expect } from '@playwright/test';
import { launchWithExtension, seedJob, waitForDetailPage } from './helpers.js';

const LISTING_URL = process.env.LISTING_URL || 'https://www.sahibinden.com/satilik/izmir-karsiyaka/sahibinden';

test.describe('Sentio Extension E2E', () => {
  test('detail flow reaches first detail page', async ({}, testInfo) => {
    const { context, page } = await launchWithExtension(testInfo);
    await page.goto('https://www.sahibinden.com/');

    // Seed a job on the mock server (assumes npm run mock-server)
    await seedJob(LISTING_URL, 2);

    // Wait for detail tab to open
    const detail = await waitForDetailPage(context, 120_000);
    await expect(detail).toBeDefined();
    await expect(detail).toHaveURL(/\/ilan\//);

    // Basic smoke: title and price selectors exist (may be empty)
    await expect(detail.locator('.classifiedTitle')).toHaveCount(1);
  });
});

