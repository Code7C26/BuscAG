import { test } from "node:test";
import assert from "node:assert/strict";
import { conversationThreads } from "./inbox";
import type { Message } from "../types";
test("inbox separates participants on the same publication, sorts by activity and counts actual unread receipts", () => {
  const row = {
    id: "m",
    itemId: "item",
    itemTitle: "Objeto",
    itemImage: "",
    senderId: "b",
    senderName: "Bea",
    senderAvatar: "",
    receiverId: "a",
    text: "Hola",
    timestamp: "2026-11-06T12:00:00Z",
    isRead: false,
  };
  const messages = [
    row,
    {
      ...row,
      id: "m2",
      senderId: "c",
      senderName: "Cami",
      timestamp: "2026-11-06T13:00:00Z",
      isRead: true,
    },
    {
      ...row,
      id: "m3",
      senderId: "a",
      receiverId: "b",
      timestamp: "2026-11-06T14:00:00Z",
    },
    { ...row, id: "foreign", senderId: "x", receiverId: "y" },
  ] as Message[];
  const threads = conversationThreads(messages, "a");
  assert.equal(threads.length, 2);
  assert.equal(threads[0].participantId, "b");
  assert.equal(threads[0].name, "Bea");
  assert.equal(threads[0].unread, 1);
  assert.equal(threads[1].unread, 0);
});
