const { test, expect } = require("./fixtures/extension.fixture");

async function getServiceWorker(context) {
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent("serviceworker", { timeout: 10_000 });
  }
  return sw;
}

async function runAutomation(sw, payload, fieldConfigs) {
  return sw.evaluate(
    async ({ payload, fieldConfigs }) => {
      try {
        return await runOnActiveTab(payload, fieldConfigs);
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
    { payload, fieldConfigs },
  );
}

test.describe("Dialog interception", () => {
  test("alert is auto-dismissed via button + dialog config", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const fieldConfigs = [
      {
        key: "submitAction",
        displayName: "Submit",
        fieldType: "button",
        buttonWait: "no_wait",
        enabled: true,
      },
      {
        key: "submitDialog",
        displayName: "Submit Dialog",
        fieldType: "dialog",
        dialogType: "alert",
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, {}, fieldConfigs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#dialogLog")).toHaveText(
      "submit:alert:dismissed",
    );
  });

  test("confirm returns true when configured", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const fieldConfigs = [
      {
        key: "deleteAction",
        displayName: "Delete",
        fieldType: "button",
        buttonWait: "no_wait",
        enabled: true,
      },
      {
        key: "deleteDialog",
        displayName: "Delete Dialog",
        fieldType: "dialog",
        dialogType: "confirm",
        dialogReturnValue: true,
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, {}, fieldConfigs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#dialogLog")).toHaveText("delete:confirm:true");
  });

  test("confirm returns false when configured", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const fieldConfigs = [
      {
        key: "deleteAction",
        displayName: "Delete",
        fieldType: "button",
        buttonWait: "no_wait",
        enabled: true,
      },
      {
        key: "deleteDialog",
        displayName: "Delete Dialog",
        fieldType: "dialog",
        dialogType: "confirm",
        dialogReturnValue: false,
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, {}, fieldConfigs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#dialogLog")).toHaveText("delete:confirm:false");
  });

  test("prompt returns custom value", async ({ context, testServer }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const fieldConfigs = [
      {
        key: "renameAction",
        displayName: "Rename",
        fieldType: "button",
        buttonWait: "no_wait",
        enabled: true,
      },
      {
        key: "renameDialog",
        displayName: "Rename Dialog",
        fieldType: "dialog",
        dialogType: "prompt",
        promptReturnValue: "NewProjectName",
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, {}, fieldConfigs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#dialogLog")).toHaveText(
      "rename:prompt:NewProjectName",
    );
  });
});
