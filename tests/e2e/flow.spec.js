const { test, expect } = require("./fixtures/extension.fixture");

const TEMPLATE = {
  id: "tpl_e2e_flow",
  key: "e2e-flow-tpl",
  name: "E2E Flow Template",
  payload: {},
  fieldConfigs: [
    {
      key: "fullName",
      displayName: "Full Name",
      labelMatch: ["full name"],
      fieldType: "text",
      enabled: true,
    },
    {
      key: "email",
      displayName: "Email Address",
      labelMatch: ["email address"],
      fieldType: "text",
      enabled: true,
    },
    {
      key: "priority",
      displayName: "Priority",
      labelMatch: ["priority"],
      fieldType: "choice",
      enabled: true,
    },
  ],
};

const DATA_ITEMS = [
  { fullName: "Alice Smith", email: "alice@example.com", priority: "High" },
  { fullName: "Bob Jones", email: "bob@example.com", priority: "Low" },
];

async function getServiceWorker(context) {
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent("serviceworker", { timeout: 10_000 });
  }
  return sw;
}

test.describe("Flow execution", () => {
  test("runs a 2-item flow filling fields on each iteration", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const testFormUrl = `${testServer}/test-form.html`;

    await sw.evaluate(
      ({ template }) => {
        return chrome.storage.sync.set({
          domain: "",
          templates: [template],
        });
      },
      { template: TEMPLATE },
    );

    const page = await context.newPage();
    await page.goto(testFormUrl);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const mergedConfigs = TEMPLATE.fieldConfigs.filter(
      (f) => f.enabled !== false,
    );

    const result = await sw.evaluate(
      async ({ configuration, dataItems, startUrl }) => {
        try {
          return await runFlow(configuration, dataItems, startUrl, {
            alwaysNavigate: true,
            onError: "stop",
            retryFallback: "skip",
          });
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },
      {
        configuration: mergedConfigs,
        dataItems: DATA_ITEMS,
        startUrl: testFormUrl,
      },
    );

    expect(result).toBeTruthy();
    expect(result.ok).toBe(true);
    expect(result.completed).toBe(2);
    expect(result.total).toBe(2);
  });

  test("flow with expand + field fill works end to end", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);

    const expandTemplate = {
      id: "tpl_e2e_expand",
      key: "e2e-expand-tpl",
      name: "E2E Expand Template",
      payload: {},
      fieldConfigs: [
        {
          key: "fullName",
          displayName: "Full Name",
          labelMatch: ["full name"],
          fieldType: "text",
          enabled: true,
        },
        {
          key: "expand",
          displayName: "Show Advanced Options",
          labelMatch: ["show advanced options"],
          fieldType: "expand",
          buttonWait: "fixed_wait",
          buttonWaitMs: 1000,
          enabled: true,
        },
        {
          key: "advancedField",
          displayName: "Advanced Setting",
          labelMatch: ["advanced setting"],
          fieldType: "text",
          enabled: true,
        },
      ],
    };

    await sw.evaluate(
      ({ template }) => {
        return chrome.storage.sync.set({
          domain: "",
          templates: [template],
        });
      },
      { template: expandTemplate },
    );

    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const result = await sw.evaluate(
      async ({ payload, fieldConfigs }) => {
        try {
          return await runOnActiveTab(payload, fieldConfigs);
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },
      {
        payload: { fullName: "Expand Test", advancedField: "Advanced Value" },
        fieldConfigs: expandTemplate.fieldConfigs,
      },
    );

    expect(result.ok).toBe(true);

    await expect(page.locator("#fullName")).toHaveValue("Expand Test");
    await expect(page.locator("#advancedField")).toHaveValue("Advanced Value");
  });
});
