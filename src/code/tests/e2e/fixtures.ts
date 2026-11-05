import type { Page } from "@playwright/test";
const origin = "https://yiarlhpbgkofhhipkfha.supabase.co";
export const userId = "e0000000-0000-4000-8000-000000000001";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "browser-test@example.invalid",
  email_confirmed_at: new Date().toISOString(),
  user_metadata: { full_name: "Lucía de prueba" },
  app_metadata: { provider: "email" },
  created_at: new Date().toISOString(),
};
export function createStore() {
  return {
    items: [] as any[],
    messages: [] as any[],
    notifications: [] as any[],
    receipts: new Map<string, any>(),
  };
}
export async function mockBackend(page: Page, store = createStore()) {
  await page.routeWebSocket("wss://*.supabase.co/**", (socket) => {
    socket.onMessage((message) => {
      try {
        const packet = JSON.parse(String(message));
        if (packet.event === "phx_join" || packet.event === "heartbeat")
          socket.send(
            JSON.stringify({
              topic: packet.topic,
              event: "phx_reply",
              ref: packet.ref,
              payload: { status: "ok", response: { postgres_changes: [] } },
            }),
          );
      } catch {}
    });
  });
  const calls: {
    path: string;
    body: any;
    redirect: string | null;
    method: string;
  }[] = [];
  let actor = user;
  const secondId = "e0000000-0000-4000-8000-000000000002";
  const profiles = [
    {
      id: userId,
      full_name: "Lucía de prueba",
      avatar_url: "",
      phone: "",
      location: "",
      rating: 5,
      created_at: new Date().toISOString(),
    },
  ];
  profiles.push({ ...profiles[0], id: secondId, full_name: "Mateo de prueba" });
  const { messages, receipts, notifications } = store;
  if (!store.items.length)
    store.items.push({
      id: "f0000000-0000-4000-8000-000000000001",
      owner_id: secondId,
      title: "Mochila verde de prueba",
      description:
        "Mochila verde encontrada cerca de la plaza. Datos ficticios.",
      category: "Mochilas y Bolsos",
      status: "encontrado",
      location_name: "Plaza de prueba",
      lat: -34.6,
      lng: -58.4,
      date: "2026-11-04",
      image_url: "",
      reward: null,
      contact_count: 0,
      created_at: new Date().toISOString(),
    });
  const items = store.items;
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:3001") return route.continue();
    if (url.origin !== origin) {
      return route.abort();
    }
    const path = url.pathname;
    let body: any = null;
    try {
      body = request.postDataJSON();
    } catch {}
    calls.push({
      path,
      body,
      redirect: url.searchParams.get("redirect_to"),
      method: request.method(),
    });
    let data: any = {};
    let status = 200;
    if (path === "/auth/v1/token") {
      actor = body.email?.startsWith("second")
        ? {
            ...user,
            id: secondId,
            email: body.email,
            user_metadata: { full_name: "Mateo de prueba" },
          }
        : user;
      const accessToken =
        "eyJhbGciOiJIUzI1NiJ9." +
        Buffer.from(
          JSON.stringify({
            sub: actor.id,
            role: "authenticated",
            aud: "authenticated",
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ).toString("base64url") +
        ".synthetic";
      data = {
        access_token: accessToken,
        refresh_token: "synthetic-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user: actor,
      };
    } else if (path === "/auth/v1/user") data = actor;
    else if (path === "/auth/v1/signup")
      data = { user: { ...user, email_confirmed_at: null }, session: null };
    else if (path.startsWith("/rest/v1/")) {
      const table = path.split("/").pop();
      data =
        table === "profiles"
          ? profiles.filter((p) => p.id === actor.id)
          : table === "public_profiles"
            ? profiles
            : table === "items"
              ? items
              : table === "notifications"
                ? notifications.filter((n) => n.user_id === actor.id)
                : [];
      if (path.endsWith("/rpc/buscag_capabilities"))
        data = { queued_match_notifications: false };
      else if (path.endsWith("/rpc/publish_item_once")) {
        if (!receipts.has(body.p_request_key)) {
          const row = {
            ...body.p_payload,
            id: crypto.randomUUID(),
            owner_id: actor.id,
            contact_count: 0,
            created_at: new Date().toISOString(),
          };
          receipts.set(body.p_request_key, row);
          items.unshift(row);
        }
        data = receipts.get(body.p_request_key);
      } else if (table === "items" && request.method() === "PATCH") {
        const id = url.searchParams.get("id")?.replace("eq.", "");
        const row = items.find((x) => x.id === id);
        if (row) Object.assign(row, body);
        data = row ?? null;
      } else if (path.endsWith("/rpc/send_message_once")) {
        if (!receipts.has(body.p_request_key)) {
          const item = items.find((i) => i.id === body.p_item_id);
          const row = {
            id: crypto.randomUUID(),
            sender_id: actor.id,
            recipient_id: body.p_recipient_id,
            item_id: item.id,
            text: body.p_text,
            sender_name: actor.user_metadata.full_name,
            sender_avatar: "",
            item_title: item.title,
            item_image: "",
            is_read: false,
            created_at: new Date().toISOString(),
          };
          receipts.set(body.p_request_key, row);
          messages.push(row);
          item.contact_count++;
          notifications.push({
            id: crypto.randomUUID(),
            user_id: row.recipient_id,
            title: "Nuevo mensaje de prueba",
            message: "Conversación ficticia",
            type: "message",
            related_item_id: item.id,
            related_user_id: actor.id,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
        data = receipts.get(body.p_request_key);
      } else if (table === "messages")
        data = messages.filter(
          (m) => m.sender_id === actor.id || m.recipient_id === actor.id,
        );
      if (
        request.method() === "PATCH" &&
        (table === "messages" || table === "notifications")
      ) {
        const rows = table === "messages" ? messages : notifications;
        data = rows
          .filter((r) =>
            table === "messages"
              ? r.recipient_id === actor.id
              : r.user_id === actor.id,
          )
          .map((r) => {
            r.is_read = true;
            return { id: r.id };
          });
      }
    }
    if (path.startsWith("/storage/v1/object/") && request.method() === "POST")
      data = {
        Key: path.replace("/storage/v1/object/", ""),
        Id: crypto.randomUUID(),
      };
    const total = Array.isArray(data) ? data.length : 1;
    if (Array.isArray(data)) {
      const offset = Number(url.searchParams.get("offset") || 0);
      data = data.slice(
        offset,
        offset + Number(url.searchParams.get("limit") || 1000),
      );
    }
    return route.fulfill({
      status,
      json: data,
      headers: {
        "Content-Range": `0-${Math.max(0, (Array.isArray(data) ? data.length : 1) - 1)}/${total}`,
        "Access-Control-Expose-Headers": "Content-Range",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      },
    });
  });
  return { calls, store };
}
export async function login(
  page: Page,
  email = "browser-test@example.invalid",
) {
  await page.getByLabel("Correo electrónico").fill(email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("synthetic-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
}
