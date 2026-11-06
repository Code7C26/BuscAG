import { test, expect } from "@playwright/test";
import { mockBackend, login, userId } from "./fixtures";
async function openChat(page: any) {
  await page
    .getByRole("button", { name: /Mochila verde de prueba/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Contactar al Publicador", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Conversación", exact: true });
}
test("draft survives closing and reloading; an offline send retries automatically and appears once in inbox", async ({
  page,
  context,
}) => {
  const backend = await mockBackend(page);
  await page.goto("/");
  await login(page);
  let chat = await openChat(page);
  await chat
    .getByPlaceholder("Escribe un mensaje...")
    .fill("  Borrador privado  ");
  await page.keyboard.press("Escape");
  chat = await openChat(page);
  await expect(chat.getByPlaceholder("Escribe un mensaje...")).toHaveValue(
    "  Borrador privado  ",
  );
  await page.reload();
  chat = await openChat(page);
  await expect(chat.getByPlaceholder("Escribe un mensaje...")).toHaveValue(
    "  Borrador privado  ",
  );
  await context.setOffline(true);
  await chat.locator("button[type=submit]").click();
  await expect(
    chat.getByRole("button", { name: "Reintentar mensaje", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Sin conexión. Lo que ves/)).toBeVisible();
  await context.setOffline(false);
  await expect(
    chat.getByText("Borrador privado", { exact: true }),
  ).toBeVisible();
  await expect(
    chat.getByRole("button", { name: "Reintentar mensaje", exact: true }),
  ).toHaveCount(0);
  await expect(chat.getByPlaceholder("Escribe un mensaje...")).toHaveValue("");
  await expect(chat.getByText("Enviado", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mensajes", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Bandeja de mensajes" })
      .getByText("Borrador privado", { exact: true }),
  ).toBeVisible();
  expect(
    backend.store.messages.filter((m) => m.text === "Borrador privado"),
  ).toHaveLength(1);
});
test("lost RPC response reuses its persisted request key after reload without a duplicate message", async ({
  page,
}) => {
  const backend = await mockBackend(page);
  const keys: string[] = [];
  let saved: any;
  await page.route("**/rest/v1/rpc/send_message_once", async (route) => {
    const body = route.request().postDataJSON();
    keys.push(body.p_request_key);
    if (!saved) {
      saved = {
        id: crypto.randomUUID(),
        item_id: body.p_item_id,
        sender_id: userId,
        recipient_id: body.p_recipient_id,
        sender_name: "Lucía",
        sender_avatar: "",
        item_title: "Mochila verde de prueba",
        item_image: "",
        text: body.p_text,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      backend.store.messages.push(saved);
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Synthetic response loss",
          code: "503",
        }),
      });
    } else
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(saved),
      });
  });
  await page.goto("/");
  await login(page);
  const chat = await openChat(page);
  await chat
    .getByPlaceholder("Escribe un mensaje...")
    .fill("Intento idempotente");
  await chat.locator("button[type=submit]").click();
  await expect(
    chat.getByRole("button", { name: "Reintentar mensaje" }),
  ).toBeVisible();
  await page.reload();
  await expect.poll(() => keys.length).toBeGreaterThanOrEqual(2);
  expect(new Set(keys).size).toBe(1);
  expect(backend.store.messages).toHaveLength(1);
});
test("advanced filters combine owner, zone and dates and offer a useful empty state", async ({
  page,
}) => {
  const backend = await mockBackend(page);
  backend.store.items.push({
    ...backend.store.items[0],
    id: "f0000000-0000-4000-8000-000000000088",
    owner_id: userId,
    title: "Mi mochila de ensayo",
    location_name: "Córdoba Centro",
    date: "2026-11-06",
  });
  await page.goto("/");
  await login(page);
  await page.getByText("Búsqueda avanzada", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Autoría", exact: true })
    .selectOption("mine");
  await page.getByLabel("Localidad o zona", { exact: true }).fill("cordoba");
  await page.getByLabel("Desde la fecha", { exact: true }).fill("2026-11-06");
  await expect(
    page.getByText("Mi mochila de ensayo", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Mochila verde de prueba", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByPlaceholder("Buscar mochila, celular, llaves, documentos...")
    .fill("no existe este objeto");
  await expect(
    page.getByRole("button", {
      name: "Limpiar búsqueda y filtros",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Limpiar búsqueda y filtros", exact: true })
    .click();
  await expect(
    page.getByText("Mochila verde de prueba", { exact: true }),
  ).toBeVisible();
});
test("recovery notification opens its destination, individual read persists, and missing targets show feedback", async ({
  page,
}) => {
  const backend = await mockBackend(page);
  backend.store.notifications.push(
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: "Devolución confirmada de ensayo",
      message: "Revisá la devolución.",
      type: "recovered",
      is_read: false,
      related_item_id: backend.store.items[0].id,
      created_at: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: "Destino eliminado de ensayo",
      message: "El objeto ya no existe.",
      type: "system",
      is_read: false,
      related_item_id: "f0000000-0000-4000-8000-000000000099",
      created_at: new Date().toISOString(),
    },
  );
  await page.goto("/");
  await login(page);
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Marcar como leída: Devolución confirmada de ensayo",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Marcar como leída: Devolución confirmada de ensayo",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: /^Devolución confirmada de ensayo Revisá/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Detalle de publicación" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /^Destino eliminado de ensayo El objeto/ })
    .click();
  await expect(
    page.getByText(
      "La publicación de este aviso fue eliminada o no está disponible.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(backend.store.notifications.every((n) => n.is_read)).toBe(true);
});
test("map contains vertical gestures and keeps geolocation and help controls apart", async ({
  page,
  context,
}, info) => {
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mapa", exact: true })
    .click();
  const map = page.locator(".map-view"),
    locate = map.locator('button[title="Centrar en mi ubicación actual"]'),
    help = page.getByRole("button", {
      name: "Abrir ayuda de preguntas frecuentes",
      exact: true,
    });
  await expect(locate).toBeVisible();
  const [a, b] = await Promise.all([locate.boundingBox(), help.boundingBox()]);
  expect(
    a!.x + a!.width <= b!.x ||
      b!.x + b!.width <= a!.x ||
      a!.y + a!.height <= b!.y ||
      b!.y + b!.height <= a!.y,
  ).toBe(true);
  const nav = await page.getByRole("navigation").boundingBox();
  expect(a!.y + a!.height).toBeLessThanOrEqual(nav!.y);
  if (info.project.name === "mobile") {
    const box = await map.boundingBox(),
      x = box!.x + box!.width / 2,
      y = box!.y + box!.height * 0.65,
      scroll = await page.evaluate(() => window.scrollY);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 8; step++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - step * 8 }],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  }
  expect(
    await map
      .locator(".leaflet-container")
      .evaluate((el) => getComputedStyle(el).touchAction),
  ).toBe("none");
});
test("image preparation rejects a disguised file and re-encodes a genuine image before publication", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  await page
    .getByRole("button", { name: "Publicar objeto", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator("input[type=file]")
    .setInputFiles({
      name: "disguised.png",
      mimeType: "image/png",
      buffer: Buffer.from("not a PNG image"),
    });
  await expect(
    dialog.getByText(
      "No se pudo abrir la foto. Elegí una imagen válida en JPG, PNG o WebP.",
      { exact: true },
    ),
  ).toBeVisible();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1200;
    canvas.getContext("2d")!.fillRect(0, 0, 2400, 1200);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await dialog
    .locator("input[type=file]")
    .setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  const preview = dialog.getByAltText("Vista previa");
  await expect(preview).toHaveAttribute("src", /^data:image\/jpeg/);
  await expect
    .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1600);
});
test("a legacy phone in memory never produces a call button without explicit server consent", async ({
  page,
}) => {
  const backend = await mockBackend(page);
  let allowed = false;
  await page.route("**/rest/v1/public_profiles*", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: {
        "Content-Range": "0-0/1",
        "Access-Control-Expose-Headers": "Content-Range",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify([
        {
          id: backend.store.items[0].owner_id,
          full_name: "Mateo",
          avatar_url: "",
          phone: "+5491123456789",
          location: "",
          rating: 0,
          rating_count: 0,
          created_at: "2026-11-06",
        },
      ]),
    }),
  );
  await page.route("**/rest/v1/rpc/can_share_contact", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(allowed),
    }),
  );
  await page.goto("/");
  await login(page);
  let chat = await openChat(page);
  await expect(chat.locator('a[href^="tel:"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  allowed = true;
  chat = await openChat(page);
  await expect(chat.locator('a[href="tel:+5491123456789"]')).toBeVisible();
});
