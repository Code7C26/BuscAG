import { test } from "node:test";
import assert from "node:assert/strict";
import {
  objectTagUrl,
  tagFromUrl,
  watchZoneError,
} from "../../lib/schoolFeatures";
const token = "00000000-0000-4000-8000-000000000001";
test("QR only encodes an opaque tag, with no account/contact data or inherited URL", () => {
  const url = objectTagUrl(
    "https://example.invalid/private?email=private#access_token=secret",
    token,
  );
  assert.equal(url, `https://example.invalid/?tag=${token}`);
  assert.equal(tagFromUrl(url), token);
  assert.equal(tagFromUrl("https://example.invalid/?tag=not-a-token"), null);
  assert.throws(() => objectTagUrl("javascript:alert(1)", token));
  assert.throws(() => objectTagUrl("https://example.invalid", "<script>"));
});
test("search zone validates bounds, NaN and infinity without GPS tracking", () => {
  assert.equal(watchZoneError(-34, -58, 3), null);
  for (const input of [
    [NaN, 0, 1],
    [0, Infinity, 1],
    [91, 0, 1],
    [0, 181, 1],
    [0, 0, 0],
    [0, 0, 101],
  ])
    assert.ok(watchZoneError(...(input as [number, number, number])));
});
