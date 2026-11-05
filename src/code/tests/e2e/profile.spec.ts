import { test, expect } from "@playwright/test";
import { mockBackend, login } from "./fixtures";
const authKey = "buscag-staging-yiarlhpbgkofhhipkfha-auth";
const ownProfile = async (page: import("@playwright/test").Page) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Perfil", exact: true })
    .click();
  await expect(page.locator(".profile-view")).toBeVisible();
};
test("own profile exposes logout immediately and clears SDK session and private drafts before switching accounts", async ({
  page,
}, info) => {
  const backend = await mockBackend(page);
  await page.goto("/");
  await login(page);
  // Leave an unpublished draft in account A; do not write data to any service.
  await page
    .getByRole("button", { name: "Publicar objeto", exact: true })
    .click();
  await page
    .getByPlaceholder("Ej: Mochila negra Jansport, iPhone 13, Llaves...")
    .fill("Private unpublished draft A");
  await page.keyboard.press("Escape");
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await ownProfile(page);
  await expect(
    page.getByRole("button", { name: "Cerrar sesión", exact: true }),
  ).toBeVisible();
  const logoutBox = await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .boundingBox();
  expect(logoutBox).not.toBeNull();
  expect(logoutBox!.y + logoutBox!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await page.screenshot({
    path: `test-results/profile-redesign-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Configuración", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/settings-redesign-${info.project.name}.png`,
    fullPage: true,
  });
  await page.evaluate(() => localStorage.setItem("fixture-preference", "keep"));
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  expect(
    backend.calls.filter((call) => call.path === "/auth/v1/logout"),
  ).toHaveLength(1);
  expect(
    backend.calls.find((call) => call.path === "/auth/v1/logout")?.scope,
  ).toBe("local");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), authKey),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("fixture-preference")),
  ).toBe("keep");
  await expect(page.getByLabel("Correo electrónico")).toHaveValue("");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await login(page, "second@example.invalid");
  await ownProfile(page);
  await expect(
    page.getByRole("heading", { name: "Mateo de prueba", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("browser-test@example.invalid", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Publicar objeto", exact: true })
    .click();
  await expect(
    page.getByPlaceholder("Ej: Mochila negra Jansport, iPhone 13, Llaves..."),
  ).toHaveValue("");
});
test("server logout failure still clears the SDK local session and warns that remote revocation is unconfirmed", async ({
  page,
}) => {
  await mockBackend(page);
  let requests = 0;
  await page.route("**/auth/v1/logout?**", (route) => {
    requests++;
    return route.fulfill({
      status: 503,
      json: { message: "PRIVATE_SERVER_DETAIL", code: "server_error" },
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("/");
  await login(page);
  await ownProfile(page);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "no se pudo confirmar la revocación",
  );
  await expect(page.getByText("PRIVATE_SERVER_DETAIL")).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), authKey),
  ).toBeNull();
  expect(requests).toBe(1);
});
test("public profile never exposes private account data, settings or logout", async ({
  page,
}, info) => {
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  await page.getByText("Mochila verde de prueba", { exact: true }).click();
  await page.getByRole("button", { name: "Ver perfil público" }).click();
  const profile = page.getByRole("dialog", {
    name: "Mateo de prueba",
    exact: true,
  });
  await expect(profile).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión", exact: true }),
  ).toHaveCount(0);
  await expect(profile.getByText("Configuración", { exact: true })).toHaveCount(
    0,
  );
  await expect(profile.getByText(/@example.invalid/)).toHaveCount(0);
  await page.screenshot({
    path: `test-results/public-profile-${info.project.name}.png`,
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(profile).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Contactar al Publicador" }),
  ).toBeVisible();
});
test("profile settings and exit remain accessible at 320px and tabs support arrow navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  await ownProfile(page);
  await expect(
    page.getByRole("button", { name: "Cerrar sesión", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.getByRole("tab", { name: /Publicaciones/ }).focus();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Configuración", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText("Cambiar contraseña");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
});
test("own profile and settings have no serious or critical accessibility violations", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  await ownProfile(page);
  for (const settings of [false, true]) {
    if (settings)
      await page
        .getByRole("tab", { name: "Configuración", exact: true })
        .click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      result.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  }
});

test("logout button shows progress and cannot issue a second request while Auth is pending", async ({
  page,
}) => {
  await mockBackend(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/auth/v1/logout?**", async (route) => {
    requests++;
    await gate;
    await route.fulfill({
      status: 200,
      json: {},
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("/");
  await login(page);
  await ownProfile(page);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  const button = page.getByRole("button", {
    name: "Cerrando sesión…",
    exact: true,
  });
  await expect(button).toBeDisabled();
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".account-signout")?.click(),
  );
  expect(requests).toBe(1);
  release();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
});
