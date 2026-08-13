import { expect, test } from "@playwright/test";

// Each test creates its own object so it is independent of the shared seed state.
// Fixture names avoid action words (upload/copy/delete) and selectors use exact
// names, so a filename never matches an action button via substring.

async function uploadFile(page: import("@playwright/test").Page, name: string, body = "e2e") {
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("File").setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(body) });
  await dialog.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
}

test.describe("S3 file operations", () => {
  test("creates a new file and saves it", async ({ page }) => {
    const name = `e2e-nf-${Date.now()}.json`;
    await page.goto("/default/s3/documents");
    await page.getByRole("button", { name: "New File", exact: true }).click();
    await page.getByLabel("File Path").fill(name);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    // The editor preview opens with default "{}" content; just save it.
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  });

  test("uploads a file", async ({ page }) => {
    const name = `e2e-up-${Date.now()}.txt`;
    await page.goto("/default/s3/documents");
    await uploadFile(page, name);
  });

  test("previews a text file", async ({ page }) => {
    await page.goto("/default/s3/documents");
    await page.getByRole("button", { name: "config.json", exact: true }).click();
    await expect(page.getByRole("dialog").getByText("config.json")).toBeVisible();
  });

  test("previews markdown rendered, then as code", async ({ page }) => {
    await page.goto("/default/s3/documents?prefix=project/");
    await page.getByRole("button", { name: "specs.md", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Rendered", exact: true })).toHaveAttribute("aria-pressed", "true");
    const rendered = page.frameLocator('iframe[title="project/specs.md (rendered)"]');
    await expect(rendered.getByRole("heading", { name: "Project Specifications" })).toBeVisible();

    await dialog.getByRole("button", { name: "Code", exact: true }).click();
    await expect(dialog.locator(".monaco-editor")).toBeVisible();
    await expect(page.locator('iframe[title="project/specs.md (rendered)"]')).toHaveCount(0);
  });

  test("previews an svg as an image and as source", async ({ page }) => {
    await page.goto("/default/s3/images");
    await page.getByRole("button", { name: "icon.svg", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(page.frameLocator('iframe[title="icon.svg (rendered)"]').locator("svg circle")).toBeVisible();

    await dialog.getByRole("button", { name: "Code", exact: true }).click();
    await expect(dialog.locator(".monaco-editor")).toBeVisible();
  });

  test("previews html rendered", async ({ page }) => {
    await page.goto("/default/s3/documents?prefix=web/");
    await page.getByRole("button", { name: "index.htm", exact: true }).click();

    const rendered = page.frameLocator('iframe[title="web/index.htm (rendered)"]');
    await expect(rendered.getByRole("heading", { name: "Hello World" })).toBeVisible();
  });

  test("previews an image", async ({ page }) => {
    await page.goto("/default/s3/images");
    await page.getByRole("button", { name: "design.png", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("img", { name: "design.png" })).toBeVisible();
  });

  test("copies a file to a new key", async ({ page }) => {
    const src = `e2e-src-${Date.now()}.txt`;
    const dst = `e2e-dst-${Date.now()}.txt`;
    await page.goto("/default/s3/documents");
    await uploadFile(page, src);

    const row = page.getByRole("row").filter({ hasText: src });
    await row.getByRole("button", { name: "Copy", exact: true }).click();
    await page.locator("#destination").fill(dst);
    await page.getByRole("dialog").getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByRole("button", { name: dst, exact: true })).toBeVisible();
  });

  test("deletes a file via the confirm dialog", async ({ page }) => {
    const name = `e2e-rm-${Date.now()}.txt`;
    await page.goto("/default/s3/documents");
    await uploadFile(page, name);

    const row = page.getByRole("row").filter({ hasText: name });
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  });
});
