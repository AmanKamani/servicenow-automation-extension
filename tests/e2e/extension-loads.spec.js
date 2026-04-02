const { test, expect } = require("./fixtures/extension.fixture");

test.describe("Extension loads", () => {
  test("service worker is registered", async ({ context }) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent("serviceworker", { timeout: 10_000 });
    }
    expect(sw.url()).toContain("background.js");
  });

  test("options page renders", async ({ optionsPage, extensionId }) => {
    await expect(optionsPage).toHaveTitle("Web Form Automator — Settings");
    await expect(optionsPage.locator("#domain")).toBeVisible();
    await expect(optionsPage.locator("#templateList")).toBeVisible();
    await expect(optionsPage.locator("#flowList")).toBeVisible();
    await expect(optionsPage.locator("#newTemplateBtn")).toBeVisible();
    await expect(optionsPage.locator("#newFlowBtn")).toBeVisible();
  });

  test("side panel page loads", async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page).toHaveTitle("Web Form Automator");
    await expect(page.locator("#runBtn")).toBeVisible();
    await expect(page.locator(".mode-tab[data-mode='upload']")).toBeVisible();
    await expect(page.locator(".mode-tab[data-mode='template']")).toBeVisible();
    await expect(page.locator(".mode-tab[data-mode='flow']")).toBeVisible();
  });
});
