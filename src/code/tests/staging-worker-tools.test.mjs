import test from "node:test";
import assert from "node:assert/strict";
import {
  workerConfiguration,
  processStagingOnce,
} from "../scripts/staging-match-worker.mjs";
const secret = "synthetic-worker-secret-not-a-real-key";
test("school worker only allows bounded once/watch modes and never exposes secrets to Vite", () => {
  assert.equal(
    workerConfiguration({ BUSCAG_STAGING_MATCH_WORKER_SECRET: secret }, [
      "--once",
    ]).watch,
    false,
  );
  assert.equal(
    workerConfiguration({ BUSCAG_STAGING_MATCH_WORKER_SECRET: secret }, [
      "--watch",
    ]).watch,
    true,
  );
  for (const args of [[], ["--production"], ["--watch", "--forever"]])
    assert.throws(() =>
      workerConfiguration({ BUSCAG_STAGING_MATCH_WORKER_SECRET: secret }, args),
    );
  assert.throws(() => workerConfiguration({}, ["--once"]));
  assert.throws(() =>
    workerConfiguration(
      {
        BUSCAG_STAGING_MATCH_WORKER_SECRET: secret,
        VITE_MATCH_WORKER_SECRET: secret,
      },
      ["--once"],
    ),
  );
});
test("worker request is fixed staging, authenticated, no redirects, and returns only the public contract", async () => {
  let call;
  const data = await processStagingOnce(secret, async (url, options) => {
    call = { url, options };
    return Response.json({
      enabled: false,
      busy: false,
      batches: 0,
      notifications: 0,
      failures: 0,
      private: "DO_NOT_PRINT",
    });
  });
  assert.equal(
    call.url,
    "https://yiarlhpbgkofhhipkfha.supabase.co/functions/v1/process-matches",
  );
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.redirect, "error");
  assert.equal(call.options.body, "{}");
  assert.equal(call.options.headers.Authorization, `Bearer ${secret}`);
  assert.equal(data.enabled, false);
  assert.ok(!JSON.stringify(data).includes("DO_NOT_PRINT"));
});
test("worker never reflects server response bodies or unknown contract values", async () => {
  for (const response of [
    new Response("PRIVATE", { status: 401 }),
    Response.json({
      enabled: true,
      busy: false,
      batches: -1,
      notifications: 0,
      failures: 0,
    }),
    Response.json({
      enabled: true,
      busy: false,
      batches: 0,
      notifications: 99999,
      failures: 0,
    }),
  ])
    await assert.rejects(
      processStagingOnce(secret, async () => response),
      (e) => !e.message.includes("PRIVATE") && !e.message.includes(secret),
    );
});
