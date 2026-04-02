/**
 * Playwright fixture for Chrome extension E2E testing.
 *
 * Launches a persistent Chromium/Chrome context with the extension loaded.
 * Requires an UNMANAGED browser -- corporate-managed Chrome may block
 * --load-extension via enterprise policy.
 *
 * Override the browser path with CHROME_PATH env variable:
 *   CHROME_PATH=/path/to/chromium npm run test:e2e
 */
const { test: base, chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

const extensionPath = path.resolve(__dirname, "..", "..", "..");
const fixturesDir = __dirname;

function findPlaywrightChromium() {
  const cacheDir = path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (!fs.existsSync(cacheDir)) return null;

  const dirs = fs
    .readdirSync(cacheDir)
    .filter((d) => d.startsWith("chromium-"))
    .sort()
    .reverse();

  for (const dir of dirs) {
    const exe = path.join(
      cacheDir,
      dir,
      "chrome-mac-arm64",
      "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    );
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  if (process.platform === "darwin") {
    const pwChromium = findPlaywrightChromium();
    if (pwChromium) return pwChromium;

    const candidates = [
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  return undefined;
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(fixturesDir, req.url === "/" ? "test-form.html" : req.url);
      const ext = path.extname(filePath);
      const contentType =
        ext === ".html" ? "text/html" :
        ext === ".js" ? "application/javascript" :
        ext === ".css" ? "text/css" :
        "application/octet-stream";

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not Found");
          return;
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

const test = base.extend({
  testServer: [
    async ({}, use) => {
      const { server, baseUrl } = await startStaticServer();
      await use(baseUrl);
      server.close();
    },
    { scope: "worker" },
  ],

  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "pw-ext-test-"),
    );
    const executablePath = findChrome();
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      ...(executablePath ? { executablePath } : {}),
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-first-run",
        "--disable-default-apps",
      ],
    });

    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent("serviceworker", { timeout: 30_000 });
    }

    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent("serviceworker", { timeout: 30_000 });
    }
    const url = sw.url();
    const id = url.split("/")[2];
    await use(id);
  },

  optionsPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options.html`);
    await page.waitForLoadState("domcontentloaded");
    await use(page);
  },

  testFormPage: async ({ context, testServer }, use) => {
    const page = await context.newPage();
    await page.goto(`${testServer}/test-form.html`);
    await page.waitForLoadState("domcontentloaded");
    await use(page);
  },
});

const { expect } = require("@playwright/test");

module.exports = { test, expect, extensionPath };
