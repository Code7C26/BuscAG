import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import "fake-indexeddb/auto";
import { readFile } from "node:fs/promises";
import { Slide } from "../src/main";
import type { Project, Live } from "../src/store";
const seed: Project = JSON.parse(
  await readFile(new URL("../src/seed.json", import.meta.url), "utf8"),
);
const live: Live = {
  sceneId: "scene-01",
  elapsed: 0,
  at: Date.now(),
  running: false,
  rehearsal: true,
  connection: false,
  rehearsalCounts: { search: [8, 5, 3], object: [8, 5, 3] },
  polls: seed.polls.map((p) => ({
    ...p,
    open: false,
    reveal: false,
    total: 0,
    counts: null,
    winners: [],
  })),
  timing: { total: 1500, valid: true, video: { start: 1290, duration: 60 } },
};
test("24 escenas renderizan con títulos, estructura 16:9 y recursos identificados", () => {
  Object.defineProperty(globalThis, "location", {
    value: { origin: "http://localhost:4173" },
    configurable: true,
  });
  for (const scene of seed.scenes) {
    const html = renderToStaticMarkup(
      <Slide scene={scene} p={seed} live={live} />,
    );
    assert.ok(html.includes("slide-header"));
    assert.ok(html.includes("slide-footer"));
    const expected=scene.kind==="poll"?(live.polls.find(p=>p.id===(scene.pollId||"object"))?.question||scene.title):scene.title;
    assert.ok(html.includes(expected.replaceAll("&", "&amp;")),scene.id);
    if (scene.kind === "reveal") assert.ok(html.includes("DATOS SINTÉTICOS"));
    if (scene.kind === "video")
      assert.ok(html.includes("pendiente de incorporar"));
  }
});
test("editor: duplicar, reordenar, deshacer/rehacer, ocultar y guardar realmente", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:4173/studio",
  });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "Event",
    "MouseEvent",
  ])
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
    });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  Object.defineProperty(globalThis, "location", {
    value: dom.window.location,
    configurable: true,
  });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).confirm = () => true;
  let saved: Project | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) =>
    ({
      ok: true,
      json: async () => {
        if (options?.method === "PUT") {
          saved = JSON.parse(String(options.body));
          return { ok: true };
        }
        return structuredClone(seed);
      },
    }) as Response;
  const { createRoot } = await import("react-dom/client");
  const { Studio } = await import("../src/studio");
  const root = createRoot(document.getElementById("root")!);
  await act(async () => {
    root.render(<Studio live={live} />);
    await new Promise((r) => setTimeout(r, 25));
  });
  for(let i=0;i<50&&!document.querySelector(".studio-header");i++){await act(async()=>{await new Promise(r=>setTimeout(r,10));});}
  assert.ok(document.querySelector(".studio-header"),"Studio debe completar la carga antes de habilitar edición");
  const buttons = () => Array.from(document.querySelectorAll("button"));
  const click = async (text: string) => {
    const b = buttons().find((b) => b.textContent?.trim() === text);
    assert.ok(b, "Botón " + text);
    await act(async () => {
      b.click();
      await new Promise((r) => setTimeout(r, 5));
    });
  };
  const count = () => document.querySelectorAll(".scene-item").length;
  assert.equal(count(), 24);
  await click("Duplicar");
  assert.equal(count(), 25);
  await click("Subir");
  await click("Ocultar");
  assert.ok(document.querySelectorAll(".hidden-scene").length === 1);
  await act(async () => {
    (
      buttons().find((b) => b.title === "Deshacer") as HTMLButtonElement
    ).click();
  });
  assert.equal(document.querySelectorAll(".hidden-scene").length, 0);
  await act(async () => {
    (buttons().find((b) => b.title === "Rehacer") as HTMLButtonElement).click();
  });
  assert.equal(document.querySelectorAll(".hidden-scene").length, 1);
  await click("Guardar");
  assert.equal((saved as Project | null)?.scenes.length, 25);
  assert.ok((saved as Project | null)?.scenes.some((s) => s.hidden));
  assert.ok(document.body.textContent?.includes("Guardado en servidor"));
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  dom.window.close();
});
