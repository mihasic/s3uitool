import { expect, test } from "@playwright/test";

// Each test creates its own object so it is independent of the shared seed state.

async function uploadFile(page: import("@playwright/test").Page, name: string, body = "e2e") {
  await page.getByRole("button", { name: "Upload" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("File").setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(body) });
  await dialog.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("button", { name })).toBeVisible();
}

test.describe("S3 file operations", () => {
  test("creates a new file and saves it", async ({ page }) => {
    const name = `e2e-new-${Date.now()}.json`;
    await page.goto("/s3/documents");
    await page.getByRole("button", { name: "New File" }).click();
    await page.getByLabel("File Path").fill(name);
    await page.getByRole("button", { name: "Create" }).click();
    // The editor preview opens with default "{}" content; just save it.
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name })).toBeVisible();
  });

  test("uploads a file", async ({ page }) => {
    const name = `e2e-upload-${Date.now()}.txt`;
    await page.goto("/s3/documents");
    await uploadFile(page, name);
  });

  test("previews a text file", async ({ page }) => {
    await page.goto("/s3/documents");
    await page.getByRole("button", { name: "config.json" }).click();
    await expect(page.getByRole("dialog").getByText("config.json")).toBeVisible();
  });

  test("previews an image", async ({ page }) => {
    await page.goto("/s3/images");
    await page.getByRole("button", { name: "design.png" }).click();
    await expect(page.getByRole("dialog").getByRole("img", { name: "design.png" })).toBeVisible();
  });

  test("copies a file to a new key", async ({ page }) => {
    const src = `e2e-copysrc-${Date.now()}.txt`;
    const dst = `e2e-copydst-${Date.now()}.txt`;
    await page.goto("/s3/documents");
    await uploadFile(page, src);

    const row = page.getByRole("row").filter({ hasText: src });
    await row.getByRole("button", { name: "Copy" }).click();
    await page.locator("#destination").fill(dst);
    await page.getByRole("dialog").getByRole("button", { name: "Copy" }).click();
    await expect(page.getByRole("button", { name: dst })).toBeVisible();
  });

  test("deletes a file via the confirm dialog", async ({ page }) => {
    const name = `e2e-del-${Date.now()}.txt`;
    await page.goto("/s3/documents");
    await uploadFile(page, name);

    const row = page.getByRole("row").filter({ hasText: name });
    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  });
});
