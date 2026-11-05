// Production-mode build with a fictitious public key; no remote service requests.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as pause } from "node:timers/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const env = { ...process.env };
for (const key of Object.keys(env))
  if (key.startsWith("VITE_")) delete env[key];
Object.assign(env, {
  VITE_SUPABASE_URL: "https://yiarlhpbgkofhhipkfha.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_pwa_fixture",
  VITE_APP_URL: "https://qa.invalid",
});
const build = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-pwa-test"],
  { env, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status || 1);
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--outDir",
    "dist-pwa-test",
    "--host",
    "127.0.0.1",
    "--port",
    "3002",
    "--strictPort",
  ],
  { env, stdio: "ignore" },
);
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw Error("PWA preview failed; do not reuse another server.");
    try {
      const response = await fetch("http://127.0.0.1:3002/");
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await pause(100);
  }
  assert.ok(ready, "PWA preview did not start");
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:3002"
      ? route.continue()
      : route.abort(),
  );
  // Seed the previous public fallback cache before the new worker is installed.
  await page.goto("http://127.0.0.1:3002/offline.html");
  await page.evaluate(async()=>{const old=await caches.open('buscag-offline-v1');await old.put('/legacy-public-only',new Response('synthetic old fallback'));});
  await page.goto("http://127.0.0.1:3002/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  assert.deepEqual(await page.evaluate(()=>caches.keys()),['buscag-offline-v2']);
  const paths = await page.evaluate(async () => {
    const cache = await caches.open("buscag-offline-v2");
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  assert.deepEqual(paths, ["/offline.html"]);
  await context.setOffline(true);
  await page.goto("http://127.0.0.1:3002/?code=synthetic-sensitive-callback");
  assert.match(await page.locator("h1").innerText(), /conexión/);
  const persisted = await page.evaluate(async () => {
    const cache = await caches.open("buscag-offline-v2");
    return (await cache.keys()).map((r) => r.url);
  });
  assert.ok(persisted.every((url) => url.endsWith("/offline.html")));
  console.log(
    "PASS: 1 production-mode PWA browser test; offline fallback only, no callback/private caching, no remote requests.",
  );
} finally {
  await browser?.close();
  server.kill();
}
