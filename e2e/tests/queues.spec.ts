import { test, expect } from '@playwright/test';

test('should list queues and send message', async ({ page }) => {
  await page.goto('/');

  // Navigate to SQS Viewer
  await page.getByRole('link', { name: 'SQS', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SQS Queues' })).toBeVisible();

  // Click on a queue (e.g., orders-queue from seed)
  const queueLink = page.getByRole('link', { name: 'orders-queue', exact: true });
  if (await queueLink.isVisible()) {
      await queueLink.click();
      await expect(page.getByRole('heading', { name: 'Queues/orders-queue' })).toBeVisible();

      // Send a message
      const messageBody = `{"test": "e2e-${Date.now()}"}`;
      await page.getByRole('button', { name: 'Send Message' }).click();
      await page.getByLabel('Message Body').fill(messageBody);
      await page.getByRole('dialog').getByRole('button', { name: 'Send Message' }).click();

      // Verify message appears (might need refresh or auto-update)
      // Assuming the UI updates or we can refresh
      await page.reload();
      await expect(page.getByText(messageBody)).toBeVisible();
  }
});
