// Real browser + actual presentation build; all backend services are SIMULATED.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { setTimeout as pause } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { mockBackend, login } from "./e2e/fixtures.ts";
import {
  presentationEnvironment,
  PRESENTATION_STORAGE_KEY,
  PRESENTATION_CSP,
} from "../lib/presentationEnvironment.mjs";
const env = presentationEnvironment({
  ...process.env,
  BUSCAG_STAGING_PUBLISHABLE_KEY: "sb_publishable_browser_fixture",
});
const build = spawnSync(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "build",
    "--mode",
    "presentation",
    "--outDir",
    "dist-presentation-test",
  ],
  { env, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status || 1);
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--mode",
    "presentation",
    "--outDir",
    "dist-presentation-test",
    "--host",
    "127.0.0.1",
    "--port",
    "3003",
    "--strictPort",
  ],
  { env, stdio: "ignore" },
);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null)
      throw Error("Presentation preview could not start.");
    try {
      if ((await fetch("http://127.0.0.1:3003/")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await pause(100);
  }
  assert.ok(ready, "Presentation preview timed out.");
  browser = await chromium.launch({
    ...(process.platform === "linux"
      ? {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
            (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
        }
      : {}),
  });
  await mkdir("presentation-test-results", { recursive: true });
  for (const [name, viewport] of [
    ["desktop", { width: 1280, height: 800 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    await mockBackend(page, undefined, "http://127.0.0.1:3003");
    // Real Hosting policy applied to the preview document as a response header.
    await page.route("http://127.0.0.1:3003/", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "Content-Security-Policy": PRESENTATION_CSP,
        },
      });
    });
    const oldKey = "sb-hczcqtodcnurdrroczle-auth-token";
    await page.addInitScript(
      ({ key }) =>
        localStorage.setItem(
          key,
          "synthetic-production-session-must-not-be-used",
        ),
      { key: oldKey },
    );
    await page.goto("http://127.0.0.1:3003/");
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("complementary", { name: "Entorno de presentación" })
        .innerText(),
      "BuscAG · Entorno de pruebas",
    );
    await login(page);
    await page.getByRole("heading", { name: /Lo importante/ }).waitFor();
    assert.ok(
      await page.evaluate(
        (key) => Boolean(localStorage.getItem(key)),
        PRESENTATION_STORAGE_KEY,
      ),
    );
    await page.screenshot({
      path: `presentation-test-results/presentation-${name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Perfil", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        PRESENTATION_STORAGE_KEY,
      ),
      null,
    );
    assert.ok(
      !requests.some((url) => url.includes("hczcqtodcnurdrroczle.supabase.co")),
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      true,
    );
    await context.close();
    console.log(
      `PASS: presentation ${name}, staging-only API target, CSP, visible environment, isolated login/logout. Backend simulated.`,
    );
  }
} finally {
  await browser?.close();
  server.kill();
}
