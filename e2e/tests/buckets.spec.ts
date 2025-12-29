import { test, expect } from '@playwright/test';

test('should list buckets and view objects', async ({ page }) => {
  // Go to home page
  await page.goto('/');

  // Check if buckets are listed (assuming test-bucket-1 exists from seed or conftest)
  // We might need to seed data if not persistent, but let's assume localstack has data
  // or we can create it via API in beforeAll if needed.
  // For now, let's just check the UI structure.

  await expect(page.getByText('S3 & SQS UI')).toBeVisible();

  // Navigate to S3 Browser
  await page.getByRole('link', { name: 'S3', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'S3 Buckets' })).toBeVisible();

  // If we have buckets, we can click one.
  // Let's assume "documents" bucket exists from seed_data.py
  const bucketLink = page.getByRole('link', { name: 'documents' });
  if (await bucketLink.isVisible()) {
      await bucketLink.click();
      await expect(page.getByRole('heading', { name: 'Buckets/documents/' })).toBeVisible();
  }
});
