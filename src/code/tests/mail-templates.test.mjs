import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("auth templates preserve Supabase signed ConfirmationURL, omit user data/tracking and share accessible brand colors", async () => {
  for (const template of ["confirmation", "recovery"]) {
    const html = await readFile(
      new URL(`../supabase/templates/${template}.html`, import.meta.url),
      "utf8",
    );
    assert.equal(
      (html.match(/href="\{\{ \.ConfirmationURL \}\}"/g) || []).length,
      1,
    );
    assert.ok(
      !/\.SiteURL|\.TokenHash|\.UserMetaData|\.Email|<script|<img|localhost|https?:\/\//i.test(
        html,
      ),
    );
    for (const color of ["#031926", "#F4E9CD", "#9DBEBB"])
      assert.ok(html.includes(color));
    assert.ok(html.includes('lang="es"'));
    assert.ok(html.includes('role="presentation"'));
  }
});
