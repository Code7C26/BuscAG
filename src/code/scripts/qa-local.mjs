// One command, no credentials, migrations on remote services or deployments.
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const npmCli = process.env.npm_execpath;
if (!npmCli)
  throw Error(
    "Ejecutar mediante npm.cmd run qa:local (Windows) o npm run qa:local.",
  );
const fixtureEnv = {
  ...process.env,
  VITE_SUPABASE_URL: "https://yiarlhpbgkofhhipkfha.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_qa_fixture",
  VITE_APP_URL: "https://qa.invalid",
};
for (const name of Object.keys(fixtureEnv))
  if (
    name.startsWith("VITE_") &&
    ![
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_APP_URL",
    ].includes(name)
  )
    delete fixtureEnv[name];
const steps = [
  "test",
  "lint",
  "test:staging-frontend",
  "test:release",
  "test:backend",
  "build",
  "test:e2e",
  "test:pwa-browser",
];
const results = [];
for (const step of steps) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [npmCli, "run", step], {
    stdio: "inherit",
    env: fixtureEnv,
  });
  results.push({
    step,
    passed: result.status === 0,
    elapsed_ms: Date.now() - started,
  });
  if (result.status !== 0) {
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) {
  const result = spawnSync(process.execPath, ["tests/client-security.mjs"], {
    stdio: "inherit",
    env: fixtureEnv,
  });
  results.push({ step: "client-security", passed: result.status === 0 });
  if (result.status !== 0) process.exitCode = 1;
}
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/local-qa-summary.json",
  JSON.stringify(
    {
      services: "simulated_or_disposable",
      remote_staging: "not_tested",
      production: "not_contacted",
      results,
    },
    null,
    2,
  ),
);
