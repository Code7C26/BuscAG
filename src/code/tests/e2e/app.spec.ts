import { test, expect } from "@playwright/test";
import { mockBackend, login } from "./fixtures";
test("mail resend keeps delivery uncertain, uses correct redirect and prevents immediate retries", async ({
  page,
}, info) => {
  const { calls } = await mockBackend(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Reenviar confirmación", exact: true })
    .click();
  await page
    .getByLabel("Correo electrónico")
    .fill("browser-test@example.invalid");
  await page.locator("button[type=submit]").click();
  await expect(page.getByRole("status")).toContainText(
    "no confirma la entrega",
  );
  await expect(page.locator("button[type=submit]")).toBeDisabled();
  expect(calls.find((x) => x.path.endsWith("/resend"))?.redirect).toBe(
    "http://127.0.0.1:3001/",
  );
  await page.screenshot({
    path: `test-results/auth-${info.project.name}.png`,
    fullPage: true,
  });
});
test("registration and recovery send explicit redirects without claiming email delivery", async ({
  page,
}) => {
  const { calls } = await mockBackend(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Regístrate", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("Cuenta ficticia");
  await page.getByLabel("Correo electrónico").fill("new@example.invalid");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("synthetic-password");
  await page.locator("button[type=submit]").click();
  await expect(page.getByRole("status")).toContainText(
    "no garantiza la entrega",
  );
  const signup = calls.find((x) => x.path.endsWith("/signup"));
  expect(signup?.redirect).toBe("http://127.0.0.1:3001/");
  await page
    .getByRole("button", { name: "Inicia sesión", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recuperar contraseña", exact: true })
    .click();
  await page.locator("button[type=submit]").click();
  await expect(page.getByRole("status")).toContainText(
    "no confirma la entrega",
  );
  expect(calls.find((x) => x.path === "/auth/v1/recover")?.redirect).toBe(
    "http://127.0.0.1:3001/?auth=recovery",
  );
});
test("real browser login, feed, filters, publish dialog and keyboard navigation fit the viewport", async ({
  page,
}, info) => {
  let documentNavigations=0;
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())documentNavigations++;});
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  await expect(
    page.getByRole("heading", { name: /Lo importante/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Mochila verde de prueba", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/home-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Publicar objeto", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(documentNavigations,'Opening the form must not reload the SPA and discard its state').toBe(1);
  await page.screenshot({
    path: `test-results/publish-${info.project.name}.png`,
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.screenshot({
    path: `test-results/map-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Perfil", exact: true })
    .click();
  await expect(page.locator(".profile-view")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({
    path: `test-results/profile-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Coincidencias", exact: true })
    .click();
  await expect(page.locator(".matches-view")).toBeVisible();
  await page.screenshot({
    path: `test-results/matches-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Notificaciones", exact: true }).first()
    .click();
  await expect(page.locator(".notifications-view")).toBeVisible();
  await page.screenshot({
    path: `test-results/notices-${info.project.name}.png`,
    fullPage: true,
  });
});

test("publish uploads a fixture through Storage and calls publication RPC once", async ({
  page,
  context,
}) => {
  const backend = await mockBackend(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -34.6, longitude: -58.4 });
  await page.goto("/");
  await login(page);
  await page
    .getByRole("button", { name: "Publicar objeto", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByPlaceholder("Ej: Mochila negra Jansport, iPhone 13, Llaves...")
    .fill("Objeto ficticio del navegador");
  await page
    .locator("textarea")
    .fill("Prueba sintética sin datos de usuarios reales");
  await page.getByRole("button", { name: "Usar mi GPS" }).click();
  await expect(
    page.getByPlaceholder("Ej: Plaza Italia, Av. Cabildo 2000..."),
  ).not.toHaveValue("");
  await page.locator("button[type=submit]").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Objeto ficticio del navegador", { exact: true }),
  ).toBeVisible();
  expect(
    backend.calls.filter((x) => x.path.endsWith("/rpc/publish_item_once")),
  ).toHaveLength(1);
  expect(
    backend.calls.filter(
      (x) => x.path.startsWith("/storage/v1/object/") && x.method === "POST",
    ),
  ).toHaveLength(1);
  const published = backend.store.items.find(
    (item) => item.title === "Objeto ficticio del navegador",
  );
  const originalId = published.id;
  await page
    .getByText("Objeto ficticio del navegador", { exact: true })
    .click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByPlaceholder("Ej: Mochila negra Jansport, iPhone 13, Llaves...")
    .fill("Objeto ficticio editado");
  await page.locator("button[type=submit]").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByText("Objeto ficticio editado", { exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Confirmar recuperación sin contraparte", exact: true })
    .click();
  await expect
    .poll(
      () => backend.store.items.find((item) => item.id === originalId)?.status,
    )
    .toBe("recuperado");
  expect(
    backend.calls.filter(
      (x) => x.path.startsWith("/storage/v1/object/") && x.method === "POST",
    ),
  ).toHaveLength(1);
});

test("auth screen has no serious WCAG violations and supports reduced-motion layout", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await mockBackend(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
});

test("two isolated browser accounts exchange messages and update recipient read receipts through mocked RPC", async ({
  page,
  browser,
}, info) => {
  const backend = await mockBackend(page);
  await page.goto("/");
  await login(page);
  await page.getByText("Mochila verde de prueba", { exact: true }).click();
  await page.getByRole("button", { name: "Contactar al Publicador" }).click();
  await page
    .getByPlaceholder("Escribe un mensaje...")
    .fill("Mensaje ficticio entre dos cuentas");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(
    page.getByText("Mensaje ficticio entre dos cuentas", { exact: true }),
  ).toBeVisible();
  expect(backend.store.messages).toHaveLength(1);
  const secondContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3001",
    viewport: page.viewportSize()!,
  });
  try {
    const second = await secondContext.newPage();
    await mockBackend(second, backend.store);
    await second.goto("/");
    await login(second, "second@example.invalid");
    await second
      .getByRole("button", { name: "Notificaciones", exact: true }).first()
      .click();
    await second.getByText("Nuevo mensaje de prueba", { exact: true }).click();
    await expect(
      second.getByText("Mensaje ficticio entre dos cuentas", { exact: true }),
    ).toBeVisible();
    await expect.poll(() => backend.store.messages[0].is_read).toBe(true);
    await second
      .getByPlaceholder("Escribe un mensaje...")
      .fill("Respuesta ficticia");
    await second.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(
      second.getByText("Respuesta ficticia", { exact: true }),
    ).toBeVisible();
    expect(backend.store.messages).toHaveLength(2);
    await second.screenshot({
      path: `test-results/chat-${info.project.name}.png`,
      fullPage: true,
    });
  } finally {
    await secondContext.close();
  }
});

test("home feed avoids nested interactive controls and serious accessibility errors", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  await expect(
    page.getByRole("heading", { name: /Lo importante/ }),
  ).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
});

test("compact 320px layout keeps forms, profile and navigation inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockBackend(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await login(page);
  await expect(
    page.getByRole("heading", { name: /Lo importante/ }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Perfil", exact: true })
    .click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Inicio", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Lo importante/ }),
  ).toBeVisible();
});

test('a delayed closed detail module never blocks login, home or the publication form',async({page})=>{
 await mockBackend(page);
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let requested=false;
 await page.route(/\/(?:src\/components\/ItemDetailModal\.tsx|assets\/ItemDetailModal-[^/]+\.js)(?:\?.*)?$/,async route=>{requested=true;await held;await route.continue().catch(()=>{});});
 try{
  await page.goto('/');await login(page);
  await expect(page.getByRole('heading',{name:/Lo importante/})).toBeVisible();
  await expect.poll(()=>requested).toBe(true);
  await page.getByRole('button',{name:'Publicar objeto',exact:true}).click();
  const draft=page.getByPlaceholder('Ej: Mochila negra Jansport, iPhone 13, Llaves...');await draft.fill('Borrador conservado entre aperturas');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Publicar objeto',exact:true}).click();await expect(draft).toHaveValue('Borrador conservado entre aperturas');
 }finally{release();}
});
