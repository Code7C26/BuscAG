import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadDraft,
  saveDraft,
  loadOutbox,
  saveOutbox,
  clearChatStorage,
} from "../../lib/chatStorage";
const fake = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};
test("drafts survive reopening and reload within a tab, remain isolated by account, and purge on logout", () => {
  const storage = fake();
  saveDraft("a", "item:b", "Mensaje privado", storage);
  assert.equal(loadDraft("a", "item:b", storage), "Mensaje privado");
  assert.equal(loadDraft("b", "item:b", storage), "");
  clearChatStorage("a", storage);
  assert.equal(loadDraft("a", "item:b", storage), "");
});
test("an unknown-outcome outbox keeps its idempotency key after reload and never resumes as already sent", () => {
  const storage = fake();
  const requestKey = "10000000-0000-4000-8000-000000000001";
  saveOutbox(
    "a",
    [
      {
        key: "untrusted",
        itemId: "item",
        recipientId: "b",
        text: "Mensaje",
        requestKey,
        status: "pending",
        retryable: true,
      },
    ],
    storage,
  );
  const [queued] = loadOutbox("a", storage);
  assert.equal(queued.requestKey, requestKey);
  assert.equal(queued.status, "failed");
  assert.equal(queued.key, JSON.stringify(["item", "b", "Mensaje"]));
  assert.deepEqual(loadOutbox("b", storage), []);
});
test("unavailable browser storage reports failure without exposing private content or throwing", () => {
  const storage = {
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {
      throw Error("denied");
    },
  };
  assert.equal(saveDraft("a", "thread", "Private", storage), false);
  assert.equal(loadDraft("a", "thread", storage), "");
  clearChatStorage("a", storage);
});
test("a long offline period expires stale drafts but preserves the pending send and its idempotency key", () => {
  const storage = fake(),
    updated = Date.now() - 3 * 24 * 60 * 60 * 1000;
  storage.setItem(
    "buscag-chat-v1:a:drafts",
    JSON.stringify({ user: "a", updated, value: { thread: "Stale draft" } }),
  );
  const requestKey = "10000000-0000-4000-8000-000000000001";
  storage.setItem(
    "buscag-chat-v1:a:outbox",
    JSON.stringify({
      user: "a",
      updated,
      value: [
        { itemId: "item", recipientId: "b", text: "Pending", requestKey },
      ],
    }),
  );
  assert.equal(loadDraft("a", "thread", storage), "");
  assert.equal(loadOutbox("a", storage)[0].requestKey, requestKey);
});
