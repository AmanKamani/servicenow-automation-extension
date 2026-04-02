const { test, expect } = require("./fixtures/extension.fixture");

const FIELD_CONFIGS = [
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
    key: "department",
    displayName: "Department",
    labelMatch: ["department"],
    fieldType: "text",
    enabled: true,
  },
  {
    key: "notes",
    displayName: "Additional Notes",
    labelMatch: ["additional notes"],
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
  {
    key: "description",
    displayName: "Description",
    labelMatch: ["description"],
    fieldType: "text",
    enabled: true,
  },
];

const PAYLOAD = {
  fullName: "Jane Doe",
  email: "jane@example.com",
  department: "Engineering",
  notes: "Some extra notes",
  priority: "High",
  description: "Test description text",
};

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

test.describe("Form filling", () => {
  test("fills text fields via all selector strategies and native select", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const result = await runAutomation(sw, PAYLOAD, FIELD_CONFIGS);
    expect(result.ok).toBe(true);

    await expect(page.locator("#fullName")).toHaveValue("Jane Doe");
    await expect(page.locator("#email")).toHaveValue("jane@example.com");
    await expect(page.locator("#department")).toHaveValue("Engineering");
    await expect(page.locator("#notes")).toHaveValue("Some extra notes");
    await expect(page.locator("#priority")).toHaveValue("high");
    await expect(page.locator("#description")).toHaveValue(
      "Test description text",
    );
  });

  test("label-for strategy finds fields by label text", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const configs = [
      {
        key: "fullName",
        displayName: "Full Name",
        labelMatch: ["full name"],
        fieldType: "text",
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, { fullName: "Label Test" }, configs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#fullName")).toHaveValue("Label Test");
  });

  test("aria-label strategy finds fields", async ({ context, testServer }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const configs = [
      {
        key: "department",
        displayName: "Department",
        labelMatch: ["department"],
        fieldType: "text",
        enabled: true,
      },
    ];

    const result = await runAutomation(
      sw,
      { department: "Aria Match" },
      configs,
    );
    expect(result.ok).toBe(true);
    await expect(page.locator("#department")).toHaveValue("Aria Match");
  });

  test("placeholder strategy finds fields", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const configs = [
      {
        key: "notes",
        displayName: "Additional Notes",
        labelMatch: ["additional notes"],
        fieldType: "text",
        enabled: true,
      },
    ];

    const result = await runAutomation(
      sw,
      { notes: "Placeholder Match" },
      configs,
    );
    expect(result.ok).toBe(true);
    await expect(page.locator("#notes")).toHaveValue("Placeholder Match");
  });
});

test.describe("Checkbox filling", () => {
  test("checks a native checkbox via label[for] strategy", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const configs = [
      {
        key: "terms",
        displayName: "Accept Terms",
        labelMatch: ["accept terms"],
        fieldType: "checkbox",
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, { terms: true }, configs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#termsCheckbox")).toBeChecked();
  });

  test("unchecks a native checkbox when value is false", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    // Pre-check the box, then run with false
    await page.locator("#termsCheckbox").check();
    await expect(page.locator("#termsCheckbox")).toBeChecked();

    const configs = [
      {
        key: "terms",
        displayName: "Accept Terms",
        labelMatch: ["accept terms"],
        fieldType: "checkbox",
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, { terms: false }, configs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#termsCheckbox")).not.toBeChecked();
  });

  test("checks a checkbox found by labelWrap strategy", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const configs = [
      {
        key: "newsletter",
        displayName: "Newsletter",
        labelMatch: ["subscribe to newsletter"],
        fieldType: "checkbox",
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, { newsletter: true }, configs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#newsletterCheckbox")).toBeChecked();
  });

  test("toggles a role=switch element via aria-label strategy", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const configs = [
      {
        key: "darkMode",
        displayName: "Dark Mode",
        labelMatch: ["dark mode"],
        fieldType: "checkbox",
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, { darkMode: true }, configs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#darkModeToggle")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("accepts string 'true' and coerces to boolean", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const configs = [
      {
        key: "terms",
        displayName: "Accept Terms",
        labelMatch: ["accept terms"],
        fieldType: "checkbox",
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, { terms: "true" }, configs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#termsCheckbox")).toBeChecked();
  });

  test("uses defaultValue when no payload value provided", async ({
    context,
    testServer,
  }) => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.bringToFront();

    const configs = [
      {
        key: "terms",
        displayName: "Accept Terms",
        labelMatch: ["accept terms"],
        fieldType: "checkbox",
        defaultValue: "true",
        enabled: true,
      },
    ];

    const result = await runAutomation(sw, {}, configs);
    expect(result.ok).toBe(true);
    await expect(page.locator("#termsCheckbox")).toBeChecked();
  });
});
