import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockBackend, createStore, login, userId } from "./fixtures";
const itemId = "f0000000-0000-4000-8000-000000000021",
  token = "a0000000-0000-4000-8000-000000000001",
  partnerId = "e0000000-0000-4000-8000-000000000002";
async function setup(page: Page, owner = userId) {
  const store = createStore();
  store.items.push({
    id: itemId,
    owner_id: owner,
    title: "Mochila escolar violeta",
    description: "Mochila violeta con cierre plateado",
    category: "Mochilas y Bolsos",
    status: "perdido",
    location_name: "Plaza de ensayo",
    lat: -34.6,
    lng: -58.4,
    date: "2026-11-05",
    created_at: new Date().toISOString(),
    image_url: "",
    contact_count: 0,
  });
  await mockBackend(page, store);
  const calls: { name: string; body: any }[] = [];
  let watch: any = null;
  let requests: any[] = [];
  await page.route("**/rest/v1/rpc/*", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop()!;
    const body = route.request().postDataJSON() || {};
    const known = [
      "school_features",
      "get_item_watch",
      "set_item_watch",
      "get_match_preference",
      "set_match_preference",
      "manage_object_tag",
      "resolve_object_tag",
      "list_recovery_confirmations",
      "request_item_recovery",
      "resolve_item_recovery",
      "community_statistics",
    ];
    if (!known.includes(name)) return route.fallback();
    calls.push({ name, body });
    let data: any = null;
    switch (name) {
      case "school_features":
        data = { version: 1, matching_enabled: true };
        break;
      case "get_match_preference":
        data = true;
        break;
      case "set_match_preference":
        data = body.p_enabled;
        break;
      case "get_item_watch":
        data = watch;
        break;
      case "set_item_watch":
        watch = data = {
          item_id: itemId,
          enabled: body.p_enabled,
          lat: body.p_lat,
          lng: body.p_lng,
          radius_km: body.p_radius,
        };
        break;
      case "manage_object_tag":
        data = { token, enabled: body.p_enabled };
        break;
      case "resolve_object_tag":
        data = {
          item_id: itemId,
          category: "Mochilas y Bolsos",
          status: "perdido",
        };
        break;
      case "list_recovery_confirmations":
        data = requests;
        break;
      case "request_item_recovery":
        requests = [
          {
            id: token,
            item_id: itemId,
            owner_id: userId,
            partner_id: partnerId,
            state: "pending",
          },
        ];
        data = token;
        break;
      case "resolve_item_recovery":
        requests = requests.map((r) => ({
          ...r,
          state: body.p_accept ? "confirmed" : "cancelled",
        }));
        data = body.p_accept ? "confirmed" : "cancelled";
        break;
      case "community_statistics":
        data = {
          publications: 7,
          lost: 3,
          found: 2,
          recovered: 2,
          mine: 1,
          scope: "visible_by_rls",
        };
        break;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  return { calls, store };
}
async function openTools(page: Page) {
  await page
    .getByRole("button", { name: /Mochila escolar violeta/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Detalle de publicación" });
  await dialog
    .getByRole("button", { name: "Alertas, QR y devolución segura" })
    .click();
  return dialog;
}
test("watch radius, account preferences and locally generated QR integrate with the existing item", async ({
  page,
}, info) => {
  const { calls } = await setup(page);
  await page.goto("/");
  await login(page);
  const dialog = await openTools(page);
  await expect(
    dialog.getByText("Modo alerta y zona de búsqueda", { exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Radio de búsqueda (km)").fill("5");
  await dialog
    .getByRole("button", { name: "Activar o actualizar vigilancia" })
    .click();
  await expect(
    dialog.getByText("Vigilancia activada", { exact: true }),
  ).toBeVisible();
  expect(calls.find((c) => c.name === "set_item_watch")?.body.p_radius).toBe(5);
  await dialog
    .getByRole("button", { name: "Desactivar vigilancia", exact: true })
    .click();
  await expect(
    dialog.getByText("Vigilancia desactivada.", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Recibir avisos internos de coincidencias en mi cuenta")
    .uncheck();
  await expect
    .poll(() =>
      calls.some(
        (c) => c.name === "set_match_preference" && c.body.p_enabled === false,
      ),
    )
    .toBeTruthy();
  await dialog.getByRole("button", { name: "Generar QR", exact: true }).click();
  await expect(
    dialog.getByAltText("Código QR para contactar por este objeto"),
  ).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(
    dialog.getByRole("link", { name: "Abrir página de la etiqueta" }),
  ).toHaveAttribute("href", `http://127.0.0.1:3001/?tag=${token}`);
  await page.addScriptTag({ path: "node_modules/jsqr/dist/jsQR.js" });
  const decoded = await dialog
    .getByAltText("Código QR para contactar por este objeto")
    .evaluate(async (node) => {
      const image = node as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      return (window as any).jsQR(pixels.data, pixels.width, pixels.height)
        ?.data;
    });
  expect(decoded).toBe(`http://127.0.0.1:3001/?tag=${token}`);
  await dialog.getByAltText('Código QR para contactar por este objeto').scrollIntoViewIfNeeded();
  const placeholder=await dialog.getByText('Foto no disponible',{exact:true}).boundingBox();
  const badge=await dialog.getByText('Objeto Perdido',{exact:true}).boundingBox();
  expect(placeholder&&badge).toBeTruthy();expect(placeholder!.y+placeholder!.height).toBeLessThan(badge!.y);
  await page.screenshot({
    path: `test-results/school-tools-${info.project.name}.png`,
    fullPage: false,
  });
  const violations = (
    await new AxeBuilder({ page })
      .include('[aria-label="Herramientas del objeto"]')
      .analyze()
  ).violations.filter((v) => ["serious", "critical"].includes(v.impact || ""));
  expect(violations).toEqual([]);
  await dialog.getByRole("button", { name: "Revocar QR", exact: true }).click();
  await expect(
    dialog.getByAltText("Código QR para contactar por este objeto"),
  ).toHaveCount(0);
});
test("statistics show RPC values and public QR requires login before contact without personal data", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/?tag=${token}`);
  await expect(
    page.getByRole("heading", { name: "¿Encontraste este objeto?" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "browser-test@example.invalid",
  );
  await page.getByRole("button", { name: "Ingresar para contactar" }).click();
  await login(page);
  await expect(
    page.getByRole("dialog", { name: "Detalle de publicación" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Ver estadísticas reales" }).click();
  const panel = page.getByRole("region", { name: "Impacto de la comunidad" });
  await expect(panel.locator("dd").first()).toHaveText("7");
  await expect(
    panel.getByText("Datos visibles para tu cuenta según RLS.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("foreign item exposes no watch or QR management and unavailable backend has no fake success", async ({
  page,
}) => {
  await setup(page, partnerId);
  await page.goto("/");
  await login(page);
  const dialog = await openTools(page);
  await expect(
    dialog.getByText("Devolución entre dos personas", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Generar QR", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Activar o actualizar vigilancia" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.route("**/rest/v1/rpc/school_features", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        code: "PGRST202",
        message: "PRIVATE_BACKEND_DETAIL",
      }),
    }),
  );
  const retry = await openTools(page);
  await expect(retry.getByRole("status")).toContainText("No se pudo completar");
  await expect(
    retry.getByRole("button", { name: "Generar QR", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    "PRIVATE_BACKEND_DETAIL",
  );
});
test("two browser account sessions request and confirm a real UI recovery flow using simulated RPC", async ({
  page,
}) => {
  const { calls, store } = await setup(page);
  store.messages.push({
    id: token,
    item_id: itemId,
    sender_id: partnerId,
    recipient_id: userId,
    sender_name: "Mateo de prueba",
    sender_avatar: "",
    item_title: "Mochila escolar violeta",
    item_image: "",
    text: "Podemos coordinar la devolución",
    is_read: false,
    created_at: new Date().toISOString(),
  });
  await page.goto("/");
  await login(page);
  let dialog = await openTools(page);
  await dialog
    .getByLabel("Persona con quien conversaste")
    .selectOption(partnerId);
  await dialog
    .getByRole("button", {
      name: "Solicitar confirmación de devolución",
      exact: true,
    })
    .click();
  await expect(
    dialog.getByText("Confirmación pendiente", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Confirmar entrega realizada" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Perfil", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await login(page, "second-test@example.invalid");
  dialog = await openTools(page);
  await expect(
    dialog.getByRole("button", { name: "Confirmar entrega realizada" }),
  ).toBeVisible();
  page.once("dialog", (prompt) => prompt.accept());
  await dialog
    .getByRole("button", { name: "Confirmar entrega realizada" })
    .click();
  await expect(
    dialog.getByText("Devolución confirmada", { exact: true }),
  ).toBeVisible();
  expect(
    calls.filter(
      (c) => c.name === "resolve_item_recovery" && c.body.p_accept === true,
    ),
  ).toHaveLength(1);
});
