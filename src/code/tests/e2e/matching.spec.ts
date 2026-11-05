import { test, expect } from "@playwright/test";
import { createStore, mockBackend, login, userId } from "./fixtures";
test("frontend computes a real match from lost/found fixture rows and removes recovered candidates", async ({
  page,
}, info) => {
  const store = createStore();
  const base = {
    title: "Mochila azul escolar",
    description: "Mochila azul con cuaderno rojo y llavero negro.",
    category: "Mochilas y Bolsos",
    location_name: "Plaza de prueba",
    lat: -34.6,
    lng: -58.4,
    date: new Date().toISOString().slice(0, 10),
    image_url: "",
    reward: null,
    contact_count: 0,
    created_at: new Date().toISOString(),
  };
  store.items.push(
    {
      ...base,
      id: "f0000000-0000-4000-8000-000000000011",
      owner_id: userId,
      status: "perdido",
    },
    {
      ...base,
      id: "f0000000-0000-4000-8000-000000000012",
      owner_id: "e0000000-0000-4000-8000-000000000002",
      status: "encontrado",
      lat: -34.6005,
    },
  );
  await mockBackend(page, store);
  await page.goto("/");
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Coincidencias/ })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Todas las coincidencias (1)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .locator(".matches-view")
      .getByText("Mochila azul escolar", { exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Comparar lado a lado", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: `test-results/matching-pair-${info.project.name}.png`,
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  store.items[1].status = "recuperado";
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Coincidencias/ })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Todas las coincidencias (0)",
      exact: true,
    }),
  ).toBeVisible();
});
