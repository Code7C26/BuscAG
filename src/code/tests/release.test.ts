import test from "node:test";
import assert from "node:assert/strict";
import {
  validateReleaseEnvironment,
  PRODUCTION_URL,
  PRODUCTION_REF,
  PRODUCTION_APP_URL,
  releaseProcessEnvironment,
} from "../lib/releaseEnvironment.mjs";
const jwt = (role: string, ref: string) =>
  `fixture.${btoa(JSON.stringify({ role, ref }))}.signature`;
const valid = {
  VITE_APP_ENV: "production",
  VITE_SUPABASE_URL: PRODUCTION_URL,
  VITE_APP_URL: PRODUCTION_APP_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_release",
};
test("release requires explicit production target and public HTTPS app origin", () => {
  assert.equal(validateReleaseEnvironment(valid), null);
  for (const change of [
    { VITE_APP_ENV: "staging" },
    { VITE_SUPABASE_URL: "https://yiarlhpbgkofhhipkfha.supabase.co" },
    { VITE_SUPABASE_URL: PRODUCTION_URL + "/" },
    { VITE_APP_URL: undefined },
    { VITE_APP_URL: "http://localhost:3000" },
    { VITE_APP_URL: "https://localhost" },
    { VITE_APP_URL: "https://buscag.example.org/path" },
    { VITE_APP_URL: "https://buscag.example.org/?token=private" },
    { VITE_APP_URL: PRODUCTION_URL },
  ])
    assert.ok(validateReleaseEnvironment({ ...valid, ...change }));
});
test("release rejects private or foreign JWT keys and unexpected exposed variables without echoing values", () => {
  assert.equal(
    validateReleaseEnvironment({
      ...valid,
      VITE_SUPABASE_PUBLISHABLE_KEY: jwt("anon", PRODUCTION_REF),
    }),
    null,
  );
  for (const key of [
    "",
    "sb_secret_PRIVATE",
    jwt("service_role", PRODUCTION_REF),
    jwt("anon", "yiarlhpbgkofhhipkfha"),
    "sb_publishable_ short",
  ]) {
    const error = validateReleaseEnvironment({
      ...valid,
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
    });
    assert.ok(error);
    assert.ok(!error.includes("PRIVATE"));
  }
  assert.ok(
    validateReleaseEnvironment({ ...valid, VITE_DATABASE_URL: "DO_NOT_PRINT" }),
  );
  assert.ok(
    validateReleaseEnvironment({
      ...valid,
      VITE_SOMETHING_ELSE: "DO_NOT_PRINT",
    }),
  );
});
test("real Vite release resolution disables dotenv and pins reviewed public inputs; wrong project fails before build", async () => {
  const { resolveConfig } = await import("vite");
  const { fileURLToPath } = await import("node:url");
  const old = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")),
  );
  const clear = () => {
    for (const key of Object.keys(process.env))
      if (key.startsWith("VITE_")) delete process.env[key];
  };
  clear();
  Object.assign(process.env, valid);
  try {
    const configFile = fileURLToPath(
      new URL("../vite.config.ts", import.meta.url),
    );
    const resolved = await resolveConfig(
      { configFile, mode: "release", logLevel: "silent" },
      "build",
    );
    assert.equal(resolved.envDir, false);
    assert.equal(resolved.env.VITE_SUPABASE_URL, PRODUCTION_URL);
    assert.equal(resolved.env.VITE_APP_ENV, "production");
    assert.equal(resolved.env.VITE_APP_URL, valid.VITE_APP_URL);
    process.env.VITE_SUPABASE_URL = "https://yiarlhpbgkofhhipkfha.supabase.co";
    await assert.rejects(
      resolveConfig(
        { configFile, mode: "release", logLevel: "silent" },
        "build",
      ),
      /producción/,
    );
  } finally {
    clear();
    Object.assign(process.env, old);
  }
});

test("release launcher defaults to confirmed production origin but refuses inherited staging configuration", () => {
  const source = {
    VITE_SUPABASE_PUBLISHABLE_KEY: valid.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  const selected = releaseProcessEnvironment(source);
  assert.equal(selected.VITE_APP_URL, PRODUCTION_APP_URL);
  assert.equal(validateReleaseEnvironment(selected), null);
  assert.equal(source["VITE_APP_URL"], undefined);
  assert.ok(
    validateReleaseEnvironment(
      releaseProcessEnvironment({ ...source, VITE_APP_ENV: "staging" }),
    ),
  );
  assert.ok(
    validateReleaseEnvironment({
      ...selected,
      VITE_APP_URL: "https://another.example.org",
    }),
  );
});
