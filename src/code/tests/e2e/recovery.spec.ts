import { test, expect, type Page } from "@playwright/test";
import { createStore, mockBackend, login, userId } from "./fixtures";
const partnerId = "e0000000-0000-4000-8000-000000000002";
const itemId = "f0000000-0000-4000-8000-000000000055";

function fixture(linked = true) {
  const store = createStore();
  store.items.push({
    id: itemId,
    owner_id: userId,
    title: "Mochila de recuperación",
    description: "Prueba local",
    status: "perdido",
    category: "Otros",
    location_name: "Ensayo",
    lat: -34.6,
    lng: -58.4,
    date: "2026-11-06",
    created_at: new Date().toISOString(),
    image_url: "",
    contact_count: 0,
  });
  const requests: any[] = [];
  const writes: string[] = [];
  async function attach(page: Page, actor: string) {
    await mockBackend(page, store);
    await page.route("**/rest/v1/rpc/*", async (route) => {
      const name = new URL(route.request().url()).pathname.split("/").pop();
      const body = route.request().postDataJSON();
      let data: any;
      if (name === "recovery_context")
        data = {
          version: 2,
          status: store.items[0].status,
          partners:
            linked && actor === userId
              ? [{ id: partnerId, name: "Mateo de prueba" }]
              : [],
          requests,
        };
      else if (name === "request_item_recovery") {
        writes.push(name);
        if (!requests.length)
          requests.push({
            id: itemId,
            item_id: itemId,
            owner_id: userId,
            partner_id: body.p_partner,
            mode: body.p_partner ? "bilateral" : "individual",
            state: body.p_partner ? "pending" : "confirmed",
          });
        if (!body.p_partner) store.items[0].status = "recuperado";
        data = requests[0].id;
      } else if (name === "resolve_item_recovery") {
        writes.push(name);
        if (requests[0].state === "pending")
          requests[0].state = body.p_accept ? "confirmed" : "cancelled";
        if (requests[0].state === "confirmed")
          store.items[0].status = "recuperado";
        data = requests[0].state;
      } else return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    await page.goto("/");
    await login(
      page,
      actor === userId
        ? "browser-test@example.invalid"
        : "second-test@example.invalid",
    );
  }
  return { store, requests, writes, attach };
}
async function open(page: Page) {
  await page
    .getByRole("button", { name: /Mochila de recuperación/ })
    .first()
    .click();
  return page.getByRole("region", { name: "Recuperación segura", exact: true });
}

for (const accept of [true, false])
  test(`two isolated accounts ${accept ? "accept" : "reject"} recovery, retain ownership and reload durable status`, async ({
    page,
    browser,
  }) => {
    const data = fixture();
    await data.attach(page, userId);
    await expect(
      page.getByText("Tu publicación", { exact: true }),
    ).toBeVisible();
    let panel = await open(page);
    await panel.getByLabel("Contraparte vinculada").selectOption(partnerId);
    page.once("dialog", (dialog) => dialog.accept());
    await panel
      .getByRole("button", {
        name: "Solicitar confirmación de devolución",
        exact: true,
      })
      .click();
    await expect(panel.getByRole("status")).toHaveText(
      "Pendiente de confirmación",
    );
    expect(data.store.items[0].status).toBe("perdido");
    const secondContext = await browser.newContext({ serviceWorkers: "block" });
    try {
      const second = await secondContext.newPage();
      await data.attach(second, partnerId);
      await expect(
        second.getByText("Publicación de otra persona", { exact: true }),
      ).toBeVisible();
      await second
        .getByRole("navigation")
        .getByRole("button", { name: "Perfil", exact: true })
        .click();
      await expect(
        second.getByText("Mochila de recuperación", { exact: true }),
      ).toHaveCount(0);
      await second
        .getByRole("navigation")
        .getByRole("button", { name: "Inicio", exact: true })
        .click();
      const otherPanel = await open(second);
      second.once("dialog", (dialog) => dialog.accept());
      await otherPanel
        .getByRole("button", {
          name: accept
            ? "Confirmar entrega realizada"
            : "Rechazar confirmación",
          exact: true,
        })
        .click();
      const state = accept ? "Recuperado" : "Confirmación rechazada";
      await expect(otherPanel.getByRole("status")).toHaveText(state);
      // Pending/rejected requests do not update items: the panel must synchronize
      // through its own read RPC even without an items Realtime event.
      await expect(panel.getByRole("status")).toHaveText(state, {
        timeout: 12000,
      });
      await page.reload();
      panel = await open(page);
      await expect(panel.getByRole("status")).toHaveText(state);
      expect(data.requests).toHaveLength(1);
      expect(data.writes).toEqual([
        "request_item_recovery",
        "resolve_item_recovery",
      ]);
    } finally {
      await secondContext.close();
    }
  });

test("individual recovery requires explicit consent and missing backend never falls back to PATCH", async ({
  page,
}) => {
  const data = fixture(false);
  await data.attach(page, userId);
  const panel = await open(page);
  page.once("dialog", (dialog) => dialog.dismiss());
  await panel
    .getByRole("button", {
      name: "Confirmar recuperación sin contraparte",
      exact: true,
    })
    .click();
  expect(data.writes).toHaveLength(0);
  expect(data.store.items[0].status).toBe("perdido");
  page.once("dialog", (dialog) => dialog.accept());
  await panel
    .getByRole("button", {
      name: "Confirmar recuperación sin contraparte",
      exact: true,
    })
    .click();
  await expect(panel.getByRole("status")).toHaveText("Recuperado");
  await page.reload();
  await open(page);
  await expect(
    page
      .getByRole("region", { name: "Recuperación segura", exact: true })
      .getByRole("status"),
  ).toHaveText("Recuperado");
  // An anonymized/rejected bilateral history must not offer a solo bypass.
  data.store.items[0].status = 'perdido';
  data.requests[0].mode = 'bilateral';
  data.requests[0].state = 'cancelled';
  await page.reload();
  const historical = await open(page);
  await expect(historical).toContainText('Hay historial bilateral sin contraparte disponible');
  await expect(historical.getByRole('button', { name: 'Confirmar recuperación sin contraparte', exact: true })).toHaveCount(0);
  await page.route("**/rest/v1/rpc/recovery_context", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ code: "PGRST202" }),
    }),
  );
  await page.reload();
  const unavailable = await open(page);
  await expect(unavailable.getByRole("alert")).toContainText(
    "Recuperación segura no disponible",
  );
  await expect(
    unavailable.getByRole("button", {
      name: "Confirmar recuperación sin contraparte",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(data.writes).toHaveLength(1);
});
