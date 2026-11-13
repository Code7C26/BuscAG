import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  presentationEnvironment,
  validatePresentationEnvironment,
  PRESENTATION_APP_URL,
  PRESENTATION_STORAGE_KEY,
  PRESENTATION_CSP,
} from "../lib/presentationEnvironment.mjs";
const source = {
  BUSCAG_STAGING_PUBLISHABLE_KEY: "sb_publishable_presentation_fixture",
};
test("presentation selects real staging and confirmed public origin, discarding production and private ambient settings", () => {
  const ambient = {
    ...source,
    VITE_SUPABASE_URL: "https://hczcqtodcnurdrroczle.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_wrong_project",
    VITE_OTHER_SECRET: "PRIVATE",
    BUSCAG_STAGING_TEST_ACCOUNTS_JSON: "PRIVATE",
    BUSCAG_STAGING_DATABASE_URL: "PRIVATE",
  };
  const env: Record<string, any> = presentationEnvironment(ambient);
  assert.equal(validatePresentationEnvironment(env), null);
  assert.equal(env.VITE_APP_URL, PRESENTATION_APP_URL);
  assert.equal(
    env.VITE_SUPABASE_URL,
    "https://yiarlhpbgkofhhipkfha.supabase.co",
  );
  assert.equal(env.BUSCAG_STAGING_TEST_ACCOUNTS_JSON, undefined);
  assert.equal(env.VITE_OTHER_SECRET, undefined);
  assert.equal(ambient.VITE_OTHER_SECRET, "PRIVATE");
  assert.equal(
    PRESENTATION_STORAGE_KEY,
    "buscag-presentation-yiarlhpbgkofhhipkfha-auth",
  );
  for (const change of [
    { VITE_APP_ENV: "production" },
    { VITE_SUPABASE_URL: ambient.VITE_SUPABASE_URL },
    { VITE_APP_URL: "http://localhost:3000" },
    { VITE_SECRET: "PRIVATE" },
    { VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_PRIVATE" },
  ])
    assert.ok(validatePresentationEnvironment({ ...env, ...change }));
});
test("presentation Hosting is separate, preserves routing/headers and forbids production API connections", async () => {
  const normal = JSON.parse(
    await readFile(new URL("../firebase.json", import.meta.url), "utf8"),
  );
  const school = JSON.parse(
    await readFile(
      new URL("../firebase.presentation.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(normal.hosting.public, "dist");
  assert.equal(school.hosting.public, "dist-presentation");
  assert.equal(school.hosting.site, "buscag-prueba");
  assert.equal(PRESENTATION_APP_URL, "https://buscag-prueba.web.app");
  assert.deepEqual(school.hosting.rewrites, normal.hosting.rewrites);
  const headers = school.hosting.headers.find((h) => h.source === "**").headers;
  assert.equal(
    headers.find((h) => h.key === "Content-Security-Policy").value,
    PRESENTATION_CSP,
  );
  assert.ok(
    PRESENTATION_CSP.includes("wss://yiarlhpbgkofhhipkfha.supabase.co"),
  );
  assert.ok(!PRESENTATION_CSP.includes("hczcqtodcnurdrroczle"));
  assert.ok(!PRESENTATION_CSP.includes("localhost"));
  assert.ok(!PRESENTATION_CSP.includes("script-src 'self' 'unsafe-inline'"));
});
test("real Vite presentation config isolates dotenv, target and output without enabling a deployment", async () => {
  const { resolveConfig } = await import("vite");
  const { fileURLToPath } = await import("node:url");
  const old = { ...process.env };
  for (const key of Object.keys(process.env))
    if (key.startsWith("VITE_")) delete process.env[key];
  Object.assign(process.env, presentationEnvironment(source));
  try {
    const config = await resolveConfig(
      {
        configFile: fileURLToPath(
          new URL("../vite.config.ts", import.meta.url),
        ),
        mode: "presentation",
        logLevel: "silent",
      },
      "build",
    );
    assert.equal(config.envDir, false);
    assert.equal(config.env.VITE_APP_ENV, "presentation");
    assert.ok(config.build.outDir.endsWith("dist-presentation"));
  } finally {
    for (const key of Object.keys(process.env))
      if (key.startsWith("VITE_")) delete process.env[key];
    for (const [key, value] of Object.entries(old))
      if (key.startsWith("VITE_")) process.env[key] = value;
  }
});

test('presentation supports a separately reviewed public VAPID key without forwarding private values',()=>{
 const fixture=btoa(String.fromCharCode(4)+'x'.repeat(64)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const env=presentationEnvironment({...source,BUSCAG_STAGING_VAPID_PUBLIC_KEY:fixture,VITE_VAPID_PRIVATE_KEY:'private-fixture'});
 assert.equal(env.VITE_VAPID_PUBLIC_KEY,fixture);assert.equal(validatePresentationEnvironment(env),null);
 assert.equal('VITE_VAPID_PRIVATE_KEY' in env,false);assert.throws(()=>presentationEnvironment({...source,BUSCAG_STAGING_VAPID_PUBLIC_KEY:'private-fixture'}));
});
