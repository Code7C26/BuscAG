import test from "node:test";
import assert from "node:assert/strict";
import {
  visitorSettingsError,
  stagingMailOrigin,
  PUBLIC_AUTH_REDIRECTS,
  verifyPublicStagingArtifact,
} from "../lib/visitorAuth.mjs";
import {
  liveConfiguration,
  requestVisitorSignups,
} from "../scripts/staging-live.mjs";
test("visitors require open registration and confirmed email; missing or permissive settings never pass", () => {
  const valid = {
    auth_settings_complete: true,
    email_enabled: true,
    signup_disabled: false,
    email_autoconfirm: false,
  };
  assert.equal(visitorSettingsError(valid), null);
  for (const change of [
    { auth_settings_complete: false },
    { email_enabled: false },
    { signup_disabled: true },
    { email_autoconfirm: true },
    { email_autoconfirm: undefined },
  ])
    assert.ok(visitorSettingsError({ ...valid, ...change }));
  assert.ok(visitorSettingsError({}));
});
test("email rehearsal defaults to the public Firebase origin and only accepts an explicit staging local alternative", () => {
  assert.equal(stagingMailOrigin({}), "https://buscag-prueba.web.app");
  assert.equal(
    stagingMailOrigin({
      BUSCAG_STAGING_TEST_APP_ORIGIN: "http://127.0.0.1:3001",
    }),
    "http://127.0.0.1:3001",
  );
  for (const origin of [
    "http://localhost:3000",
    "https://evil.invalid",
    "https://hczcqtodcnurdrroczle.supabase.co",
    "https://buscag-prueba.web.app/",
  ])
    assert.throws(() =>
      stagingMailOrigin({ BUSCAG_STAGING_TEST_APP_ORIGIN: origin }),
    );
  assert.deepEqual(PUBLIC_AUTH_REDIRECTS, [
    "https://buscag-prueba.web.app/",
    "https://buscag-prueba.web.app/?auth=recovery",
    "https://buscag-prueba.web.app/**",
  ]);
});
test("visitor preflight needs only a public staging key and cannot select a production backend", () => {
  const config = liveConfiguration(
    { BUSCAG_STAGING_PUBLISHABLE_KEY: "sb_publishable_fixture_key" },
    ["--visitor-preflight"],
  );
  assert.equal(config.mailOrigin, "https://buscag-prueba.web.app");
  assert.deepEqual(config.accounts, []);
  assert.throws(() =>
    liveConfiguration({ BUSCAG_STAGING_PUBLISHABLE_KEY: "sb_secret_PRIVATE" }, [
      "--visitor-preflight",
    ]),
  );
});

test("staging visitor configuration plan keeps confirmation enabled and contains only public callbacks", async () => {
  const { readFile } = await import("node:fs/promises");
  const plan = JSON.parse(
    await readFile(
      new URL(
        "../supabase/activation/staging_visitor_auth.plan.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(plan.project_ref, "yiarlhpbgkofhhipkfha");
  assert.equal(plan.confirm_email, true);
  assert.equal(plan.production_changes_allowed, false);
  assert.deepEqual(plan.redirect_urls, PUBLIC_AUTH_REDIRECTS);
  assert.equal(plan.smtp_recommended_for_small_school_session.port, 465);
  assert.ok(!JSON.stringify(plan).includes("localhost"));
  assert.ok(!JSON.stringify(plan).includes("hczcqtodcnurdrroczle"));
});

test("signup rehearsal requests signed public redirects without prematurely requesting recovery or asserting delivery", async () => {
  const accounts = [
    { email: "a@example.invalid", password: "synthetic-test" },
    { email: "b@example.invalid", password: "synthetic-test" },
  ];
  const calls = [];
  const result = await requestVisitorSignups(
    accounts,
    () => ({
      auth: {
        signUp: async (args) => {
          calls.push(args);
          return { data: { session: null }, error: null };
        },
      },
    }),
    "https://buscag-prueba.web.app",
  );
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      (c) => c.options.emailRedirectTo === "https://buscag-prueba.web.app/",
    ),
  );
  assert.deepEqual(result, { requests_accepted: 2, delivery_verified: false });
  await assert.rejects(
    requestVisitorSignups(
      accounts,
      () => ({
        auth: {
          signUp: async () => ({
            data: { session: { user: {} } },
            error: null,
          }),
        },
      }),
      "https://buscag-prueba.web.app",
    ),
    /sesión inmediata/,
  );
});

test("public-email rehearsal refuses old SPA HTML and production manifests before sending a signup link", async () => {
  let calls = 0;
  const good = {
    mode: "presentation",
    project_ref: "yiarlhpbgkofhhipkfha",
    app_origin: "https://buscag-prueba.web.app",
    commit: "a".repeat(40),
  };
  const result = await verifyPublicStagingArtifact(async (url, options) => {
    calls++;
    assert.equal(
      url,
      "https://buscag-prueba.web.app/presentation-manifest.json",
    );
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers, undefined);
    return Response.json({ ...good, private: "PRIVATE" });
  });
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  for (const response of [
    new Response("<html>old site</html>"),
    Response.json({ ...good, project_ref: "hczcqtodcnurdrroczle" }),
    Response.json({ ...good, mode: "release" }),
    new Response("PRIVATE", { status: 404 }),
  ])
    await assert.rejects(
      verifyPublicStagingArtifact(async () => response),
      (e) => !e.message.includes("PRIVATE"),
    );
});
