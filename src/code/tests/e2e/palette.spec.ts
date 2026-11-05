import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockBackend, login } from "./fixtures";
test("five-color identity remains readable across main views and modal forms", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await mockBackend(page);
  await page.goto("/");
  await login(page);
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ["petroleum", "teal", "sage", "mist", "cream"].map((n) =>
      style
        .getPropertyValue("--brand-" + n)
        .trim()
        .toLowerCase(),
    );
  });
  expect(tokens).toEqual([
    "#031926",
    "#468189",
    "#77aca2",
    "#9dbebb",
    "#f4e9cd",
  ]);
  async function audit(name: string) {
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      ),
    );
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      result.violations
        .filter((v) => ["serious", "critical"].includes(v.impact || ""))
        .map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      name,
    ).toEqual([]);
    await page.screenshot({
      path: `test-results/palette-${name}-${info.project.name}.png`,
      fullPage: true,
    });
  }
  await audit("home");
  await page.getByText("Mochila verde de prueba", { exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Detalle de publicación" }),
  ).toBeVisible();
  await audit("detail");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Publicar objeto", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit("publish");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await audit("map");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Coincidencias", exact: true })
    .click();
  await expect(page.locator(".matches-view")).toBeVisible();
  await audit("matches");
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(page.locator(".notifications-view")).toBeVisible();
  await audit("notifications");
});
