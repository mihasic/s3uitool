import { expect, test } from "@playwright/test";

// Relies on seeded data: buckets documents / images / logs.

test.describe("S3 browse & navigate", () => {
  test("redirects from index and lists buckets", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/s3$/);
    await expect(page.getByRole("heading", { name: "S3 Buckets" })).toBeVisible();
    for (const bucket of ["documents", "images", "logs"]) {
      await expect(page.getByRole("link", { name: new RegExp(bucket) })).toBeVisible();
    }
  });

  test("opens a bucket, navigates a folder, and deep-links a prefix", async ({ page }) => {
    await page.goto("/s3/documents");
    await expect(page.getByRole("heading", { name: /documents/ })).toBeVisible();
    // Root-level file and folder from the seed.
    await expect(page.getByRole("button", { name: "welcome.txt" })).toBeVisible();
    await expect(page.getByRole("link", { name: "project/" })).toBeVisible();

    // Navigate into the folder via its link.
    await page.getByRole("link", { name: "project/" }).click();
    await expect(page).toHaveURL(/prefix=project/);
    await expect(page.getByRole("button", { name: "specs.md" })).toBeVisible();

    // Deep-link straight to the prefix.
    await page.goto("/s3/documents?prefix=project%2F");
    await expect(page.getByRole("button", { name: "specs.md" })).toBeVisible();
  });

  test("filters the object list", async ({ page }) => {
    await page.goto("/s3/documents");
    await expect(page.getByRole("button", { name: "config.json" })).toBeVisible();
    await page.getByPlaceholder("Filter files...").fill("config");
    await expect(page.getByRole("button", { name: "config.json" })).toBeVisible();
    await expect(page.getByRole("button", { name: "welcome.txt" })).toHaveCount(0);
  });

  test("switches to flat view", async ({ page }) => {
    await page.goto("/s3/documents");
    await page.getByRole("button", { name: "Flat View" }).click();
    // Flat view lists nested objects recursively; the leaf file is shown.
    await expect(page.getByRole("button", { name: "specs.md" })).toBeVisible();
  });

  test("paginates with a small page size", async ({ page }) => {
    await page.goto("/s3/documents");
    await page.getByRole("button", { name: "Flat View" }).click();
    await page.locator("#page-size").selectOption("5");
    const next = page.getByRole("button", { name: "Next page" });
    await expect(next).toBeEnabled();
    await next.click();
    // Page 2 button is active/visible after navigating.
    await expect(page.getByRole("button", { name: "2" })).toBeVisible();
  });
});
