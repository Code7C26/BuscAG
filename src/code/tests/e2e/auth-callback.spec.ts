import { test, expect } from "@playwright/test";
import { mockBackend, userId } from "./fixtures";
function callback(type: "signup" | "recovery") {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  const hash = new URLSearchParams({
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic`,
    refresh_token: "synthetic-callback-refresh",
    expires_in: "3600",
    token_type: "bearer",
    type,
  });
  return `/?${type === "recovery" ? "auth=recovery" : ""}#${hash}`;
}
test("confirmation link starts a new browser session and removes callback tokens from history", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto(callback("signup"));
  await expect(
    page.getByRole("heading", { name: /Lo importante/ }),
  ).toBeVisible();
  await expect
    .poll(() => page.url())
    .not.toMatch(/access_token|refresh_token|token_type|type=signup/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Lo importante/ }),
  ).toBeVisible();
});
test("recovery link reaches password update in a fresh browser and returns to the account after success", async ({
  page,
}) => {
  const { calls } = await mockBackend(page);
  await page.goto(callback("recovery"));
  await expect(
    page.getByRole("button", { name: "Guardar nueva contraseña", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.url())
    .not.toMatch(/access_token|refresh_token|token_type/);
  await page
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("synthetic-new-password");
  await page
    .getByRole("button", { name: "Guardar nueva contraseña", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Lo importante/ }),
  ).toBeVisible();
  expect(
    calls.some((c) => c.path === "/auth/v1/user" && c.method === "PUT"),
  ).toBeTruthy();
  await expect.poll(() => page.url()).not.toContain("auth=recovery");
});
test("expired email links show a safe error without logging in or retaining callback details", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto(
    "/#error=access_denied&error_code=otp_expired&error_description=PRIVATE_CALLBACK_DETAIL",
  );
  await expect(page.getByRole("alert")).toContainText("El enlace venció");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.url())
    .not.toMatch(/error_code|PRIVATE_CALLBACK_DETAIL/);
  await expect(page.locator("body")).not.toContainText(
    "PRIVATE_CALLBACK_DETAIL",
  );
});

test("signup provider rejection stays on Auth and explains mail configuration without reflecting private details", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route(
    "https://yiarlhpbgkofhhipkfha.supabase.co/auth/v1/signup**",
    (route) =>
      route.fulfill({
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "X-Supabase-Api-Version": "2024-01-01",
          "Access-Control-Expose-Headers": "X-Supabase-Api-Version",
        },
        body: JSON.stringify({
          code: "email_address_not_authorized",
          msg: "PRIVATE_SMTP_DETAIL",
        }),
      }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Regístrate", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("Visitante de prueba");
  await page.getByLabel("Correo electrónico").fill("visitor@example.invalid");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("synthetic-password");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("servicio de correo");
  await expect(page.locator("body")).not.toContainText("PRIVATE_SMTP_DETAIL");
  await expect(
    page.getByRole("button", { name: "Crear cuenta", exact: true }),
  ).toBeEnabled();
});
