const { test, expect } = require("./fixtures/extension.fixture");

test.describe("Export/Import via options page", () => {
  test("create template, verify it appears in sidebar", async ({
    optionsPage,
  }) => {
    await optionsPage.locator("#newTemplateBtn").click();
    await optionsPage.locator("#templateNameInput").fill("E2E Test Template");

    await optionsPage.locator("#addFieldBtn").click();
    await optionsPage.locator(".picker-btn.picker-text").click();

    const fieldItem = optionsPage.locator(".field-item").first();
    await fieldItem.locator("[data-field='key']").fill("testField");
    await fieldItem.locator("[data-field='displayName']").fill("Test Field");
    await fieldItem.locator("[data-field='labelMatch']").fill("test field");

    await optionsPage.locator("#saveNewBtn").click();

    await expect(
      optionsPage.locator("#templateList .tpl-item-name", {
        hasText: "E2E Test Template",
      }),
    ).toBeVisible();
  });

  test("share template produces valid JSON download", async ({
    optionsPage,
  }) => {
    await optionsPage.locator("#newTemplateBtn").click();
    await optionsPage.locator("#templateNameInput").fill("Share Test");

    await optionsPage.locator("#addFieldBtn").click();
    await optionsPage.locator(".picker-btn.picker-text").click();

    const fieldItem = optionsPage.locator(".field-item").first();
    await fieldItem.locator("[data-field='key']").fill("shareField");
    await fieldItem.locator("[data-field='displayName']").fill("Share Field");
    await fieldItem.locator("[data-field='labelMatch']").fill("share field");

    await optionsPage.locator("#saveNewBtn").click();

    const downloadPromise = optionsPage.waitForEvent("download");
    await optionsPage.locator("#shareTemplateBtn").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain(".share-template.json");

    const content = await (await download.createReadStream()).toArray();
    const json = JSON.parse(Buffer.concat(content).toString());

    expect(json.configVersion).toBe(1);
    expect(json.exportType).toBe("template");
    expect(json.template.name).toBe("Share Test");
    expect(json.template.fieldConfigs).toHaveLength(1);
    expect(json.template.fieldConfigs[0].key).toBe("shareField");
  });

  test("import template adds it to the sidebar", async ({ optionsPage }) => {
    const importData = {
      configVersion: 1,
      exportType: "template",
      exportedAt: new Date().toISOString(),
      extensionVersion: "1.0.0",
      template: {
        key: "imported-tpl-e2e",
        name: "Imported E2E Template",
        fieldConfigs: [
          {
            key: "importedField",
            displayName: "Imported Field",
            labelMatch: ["imported field"],
            fieldType: "text",
            enabled: true,
          },
        ],
      },
    };

    const fileChooserPromise = optionsPage.waitForEvent("filechooser");
    await optionsPage.locator("#importTemplateLabelBtn").click();
    const fileChooser = await fileChooserPromise;

    const buffer = Buffer.from(JSON.stringify(importData));
    await fileChooser.setFiles({
      name: "import-test.share-template.json",
      mimeType: "application/json",
      buffer,
    });

    await optionsPage.waitForTimeout(1000);

    await expect(
      optionsPage.locator("#templateList .tpl-item-name", {
        hasText: "Imported E2E Template",
      }),
    ).toBeVisible();
  });

  test("importing duplicate template shows conflict modal", async ({
    optionsPage,
  }) => {
    const importData = {
      configVersion: 1,
      exportType: "template",
      exportedAt: new Date().toISOString(),
      extensionVersion: "1.0.0",
      template: {
        key: "dup-tpl-key",
        name: "Duplicate Test",
        fieldConfigs: [
          {
            key: "f1",
            displayName: "Field 1",
            labelMatch: ["field 1"],
            fieldType: "text",
            enabled: true,
          },
        ],
      },
    };

    // First import
    const fc1 = optionsPage.waitForEvent("filechooser");
    await optionsPage.locator("#importTemplateLabelBtn").click();
    const chooser1 = await fc1;
    await chooser1.setFiles({
      name: "dup1.share-template.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importData)),
    });

    await optionsPage.waitForTimeout(1000);

    // Second import (same key) should show conflict modal
    const fc2 = optionsPage.waitForEvent("filechooser");
    await optionsPage.locator("#importTemplateLabelBtn").click();
    const chooser2 = await fc2;
    await chooser2.setFiles({
      name: "dup2.share-template.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importData)),
    });

    await expect(optionsPage.locator("#importConflictModal")).toBeVisible({
      timeout: 5000,
    });
    await expect(optionsPage.locator("#conflictTitle")).toContainText(
      "Duplicate",
    );

    await optionsPage.locator("#conflictCancel").click();
    await expect(optionsPage.locator("#importConflictModal")).toBeHidden();
  });
});
