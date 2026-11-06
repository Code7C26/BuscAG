// Tab-scoped private content. Never shared between accounts; purge on sign-out
// or account switch. SessionStorage failure keeps the application usable.
const prefix = "buscag-chat-v1:";
const ttl = 24 * 60 * 60 * 1000;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type QueuedMessage = {
  key: string;
  itemId: string;
  recipientId: string;
  text: string;
  requestKey: string;
  status: "pending" | "failed";
  retryable: boolean;
};
function storage(): Store | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}
function read(user: string, part: string, store = storage()): any {
  try {
    const record = JSON.parse(
      store?.getItem(prefix + user + ":" + part) || "null",
    );
    return record?.user === user &&
      (part === "outbox" || Date.now() - record.updated < ttl) &&
      record.updated <= Date.now()
      ? record.value
      : null;
  } catch {
    return null;
  }
}
function write(user: string, part: string, value: unknown, store = storage()) {
  try {
    if (!store) return false;
    store.setItem(
      prefix + user + ":" + part,
      JSON.stringify({ user, updated: Date.now(), value }),
    );
    return true;
  } catch {
    return false;
  }
}
export function loadDraft(user: string, thread: string, store?: Store): string {
  const value = read(user, "drafts", store)?.[thread];
  return typeof value === "string" ? value.slice(0, 4000) : "";
}
export function saveDraft(
  user: string,
  thread: string,
  text: string,
  store?: Store,
): boolean {
  const current = read(user, "drafts", store);
  const next =
    current && typeof current === "object" && !Array.isArray(current)
      ? current
      : {};
  if (text) next[thread] = text.slice(0, 4000);
  else delete next[thread];
  return write(
    user,
    "drafts",
    Object.fromEntries(Object.entries(next).slice(-50)),
    store,
  );
}
export function loadOutbox(user: string, store?: Store): QueuedMessage[] {
  const value = read(user, "outbox", store);
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (v) =>
        v &&
        typeof v.itemId === "string" &&
        typeof v.recipientId === "string" &&
        typeof v.text === "string" &&
        v.text.trim().length > 0 &&
        v.text.length <= 4000 &&
        typeof v.requestKey === "string" &&
        /^[0-9a-f-]{36}$/i.test(v.requestKey),
    )
    .slice(0, 50)
    .map((v) => ({
      ...v,
      key: JSON.stringify([v.itemId, v.recipientId, v.text]),
      status: "failed",
      retryable: v.retryable !== false,
    }));
}
export function saveOutbox(
  user: string,
  value: QueuedMessage[],
  store?: Store,
) {
  return write(user, "outbox", value.slice(0, 50), store);
}
export function clearChatStorage(user: string, store = storage()) {
  try {
    store?.removeItem(prefix + user + ":drafts");
    store?.removeItem(prefix + user + ":outbox");
  } catch {
    /* No session storage available. */
  }
}
