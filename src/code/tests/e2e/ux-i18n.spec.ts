import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockBackend, login } from "./fixtures";

test("sign-in defaults to Spanish, persists English and offers no guest access", async ({ page }) => {
  const { calls } = await mockBackend(page);
  await page.goto("/?section=profile");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("button", { name: "Explorar como invitado" })).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByLabel("Idioma", { exact: true }).selectOption("en");
  await expect(page.getByRole("button", { name: "Explore as a guest" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("BuscAG · Find it again");
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  expect(calls.some(call => call.path.includes("guest_publications"))).toBe(false);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact || ""))).toEqual([]);
});

test("registered views retain state through locale changes, history and reduced motion", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  await page.getByLabel("Idioma", { exact: true }).selectOption("en");
  test.setTimeout(60000);
  if (info.project.name === "mobile") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Post an item", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "Post or edit an item" });
  await expect(form).toBeVisible();
  await expect(page.getByRole("button", { name: "Open FAQ help", exact: true })).toBeHidden();
  await form.getByLabel("Category *", { exact: true }).selectOption("Llaves");
  await expect(form.getByLabel("Category *", { exact: true })).toHaveValue(
    "Llaves",
  );
  await expect(
    form.getByRole("option", { name: "Keys", exact: true }),
  ).toHaveAttribute("value", "Llaves");
  await page.keyboard.press("Escape");
  const nav = page.getByRole("navigation");
  await expect(
    page.getByText("Mochila verde de prueba", { exact: true }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Search backpacks, phones, keys, documents...")
    .fill("Mochila");
  for (const name of [
    "Map",
    "Matches",
    "Messages",
    "Notifications",
    "Profile",
  ]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(
      nav.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await nav.getByRole("button", { name: "Home", exact: true }).click();
  await expect(
    page.getByPlaceholder("Search backpacks, phones, keys, documents..."),
  ).toHaveValue("Mochila");
  await nav.getByRole("button", { name: "Map", exact: true }).click();
  const map = page.locator(".leaflet-container");
  const stamp = await map.evaluate((el) => (el as any)._leaflet_id);
  await nav.getByRole("button", { name: "Home", exact: true }).click();
  await page.goBack();
  await expect(map).toBeVisible();
  expect(await map.evaluate((el) => (el as any)._leaflet_id)).toBe(stamp);
  const indicator = page.locator(".bottom-nav__indicator");
  const previous = await indicator.evaluate(
    (el) => getComputedStyle(el).transform,
  );
  await nav.getByRole("button", { name: "Profile", exact: true }).click();
  await expect
    .poll(() => indicator.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe(previous);
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await expect(
    nav.getByRole("button", { name: "Perfil", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await indicator.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.screenshot({
    path: `test-results/blue-profile-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});


test("compact signed-in navigation fits 320px in both languages", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  for (const language of ["es", "en"]) {
    await page.locator(".language-selector select").selectOption(language);
    const labels = page.locator(".nav-tab__label");
    await expect(labels).toHaveCount(7);
    expect(await labels.evaluateAll(nodes => nodes.every(node => {
      const label = node.getBoundingClientRect(), button = node.parentElement!.getBoundingClientRect();
      return label.left >= button.left && label.right <= button.right;
    }))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("language changes from another tab preserve the sign-in draft", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
  await page.getByLabel("Correo electrónico", { exact: true }).fill("draft@example.invalid");
  await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", {
    key: "buscag.language", newValue: "en", oldValue: "es", storageArea: localStorage,
  })));
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue("draft@example.invalid");
});

test("an open publication keeps user text and category when the language changes", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  await page.getByRole("navigation").getByRole("button", { name: "Publicar objeto", exact: true }).click();
  let form = page.getByRole("dialog", { name: "Publicar o editar objeto" });
  await form.getByLabel("Nombre del objeto *", { exact: true }).fill("Llaves de María");
  await form.getByLabel("Categoría *", { exact: true }).selectOption("Llaves");
  await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", {
    key: "buscag.language", newValue: "en", oldValue: "es", storageArea: localStorage,
  })));
  form = page.getByRole("dialog", { name: "Post or edit an item" });
  await expect(form.getByLabel("Item name *", { exact: true })).toHaveValue("Llaves de María");
  await expect(form.getByLabel("Category *", { exact: true })).toHaveValue("Llaves");
  await expect(form.getByRole("option", { name: "Keys", exact: true })).toHaveAttribute("value", "Llaves");
  await page.keyboard.press("Escape");
  await expect(form).toHaveCount(0);
});
