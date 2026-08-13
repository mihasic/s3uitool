import { expect, test } from "@playwright/test";

// Relies on docker-compose declaring the `s3only` profile alongside the default one.

test.describe("AWS profiles", () => {
  test("switches profile and carries it in the URL", async ({ page }) => {
    await page.goto("/default/s3");
    const switcher = page.getByLabel("AWS profile");
    await expect(switcher).toHaveValue("default");

    await switcher.selectOption("s3only");
    await expect(page).toHaveURL(/\/s3only\/s3$/);
    await expect(page.getByRole("heading", { name: "S3 Buckets" })).toBeVisible();
    await expect(page.getByRole("link", { name: /documents/ })).toBeVisible();

    // Navigation stays inside the selected profile.
    await page.getByRole("link", { name: /documents/ }).click();
    await expect(page).toHaveURL(/\/s3only\/s3\/documents/);
    await expect(switcher).toHaveValue("s3only");
  });

  test("hides a service disabled for the profile", async ({ page }) => {
    await page.goto("/default/s3");
    await expect(page.getByRole("link", { name: "SQS", exact: true })).toBeVisible();

    await page.getByLabel("AWS profile").selectOption("s3only");
    await expect(page.getByRole("link", { name: "SQS", exact: true })).toBeHidden();
  });

  test("redirects a disabled service back to the one that works", async ({ page }) => {
    await page.goto("/s3only/sqs");
    await expect(page).toHaveURL(/\/s3only\/s3$/);
  });

  test("falls back to the default profile for an unknown one", async ({ page }) => {
    await page.goto("/nosuchprofile/s3");
    await expect(page).toHaveURL(/\/default\/s3$/);
  });
});
