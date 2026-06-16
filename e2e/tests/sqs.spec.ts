import { expect, test } from "@playwright/test";

// Relies on seeded data: queues orders-queue (5 msgs), notifications-dlq (3 msgs), email-jobs (empty).

async function sendMessage(page: import("@playwright/test").Page, body: string) {
  await page.getByRole("button", { name: "Send Message", exact: true }).click();
  await page.getByLabel("Message Body").fill(body);
  await page.getByRole("dialog").getByRole("button", { name: "Send Message", exact: true }).click();
}

test.describe("SQS", () => {
  test("lists queues", async ({ page }) => {
    await page.goto("/sqs");
    await expect(page.getByRole("heading", { name: "SQS Queues" })).toBeVisible();
    for (const q of ["orders-queue", "notifications-dlq", "email-jobs"]) {
      await expect(page.getByRole("link", { name: q, exact: true })).toBeVisible();
    }
  });

  test("views seeded messages and opens details", async ({ page }) => {
    await page.goto("/sqs/orders-queue");
    await expect(page.getByRole("heading", { name: /orders-queue/ })).toBeVisible();
    // Seeded order messages contain order_id.
    await expect(page.getByText("order_id").first()).toBeVisible();
    await page.getByRole("button", { name: "View message", exact: true }).first().click();
    await expect(page.getByRole("dialog").getByText("Message Details")).toBeVisible();
  });

  test("sends a message", async ({ page }) => {
    const body = `e2e-send-${Date.now()}`;
    await page.goto("/sqs/email-jobs");
    await sendMessage(page, body);
    await expect(page.getByText(body)).toBeVisible();
  });

  test("deletes a message via the confirm dialog", async ({ page }) => {
    const body = `e2e-rm-${Date.now()}`;
    await page.goto("/sqs/email-jobs");
    await sendMessage(page, body);
    const row = page.getByRole("row").filter({ hasText: body });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Delete message", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(body)).toHaveCount(0);
  });

  test("purges a queue via the confirm dialog", async ({ page }) => {
    // notifications-dlq has seeded messages; purge it and confirm it empties.
    await page.goto("/sqs");
    const row = page.getByRole("row").filter({ hasText: "notifications-dlq" });
    await row.getByRole("button", { name: "Purge Queue", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Purge", exact: true }).click();

    await page.goto("/sqs/notifications-dlq");
    await expect(page.getByText("No messages found.")).toBeVisible();
  });
});
