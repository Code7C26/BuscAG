import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { get, clear } from "idb-keyval";
import JSZip from "jszip";
import {
  original,
  exportProject,
  importProject,
  uploadAsset,
  cacheAsset,
} from "../src/store";
test("ZIP exporta e importa proyecto y todos los recursos, tras vaciar IndexedDB", async () => {
  await clear();
  const p = original();
  p.assets = [{ id: "image-1", name: "imagen.png", type: "image/png" }];
  p.scenes[0].media = "image-1";
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  await cacheAsset("image-1", new Blob([bytes], { type: "image/png" }));
  let exported: Blob | undefined;
  Object.defineProperty(globalThis, "document", {
    value: {
      createElement: () => ({
        click() {},
        set href(v: string) {},
        set download(v: string) {},
      }),
    },
    configurable: true,
  });
  const create = URL.createObjectURL,
    revoke = URL.revokeObjectURL;
  URL.createObjectURL = (b) => {
    exported = b as Blob;
    return "blob:test";
  };
  URL.revokeObjectURL = () => {};
  const old = globalThis.fetch;
  const uploaded = new Map<string, Uint8Array>();
  globalThis.fetch = async (url, opts) => {
    if (opts?.method === "PUT") {
      uploaded.set(
        String(url).split("/").pop()!,
        new Uint8Array(await (opts.body as Blob).arrayBuffer()),
      );
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    }
    return {
      ok: true,
      blob: async () => new Blob(["original builtin bytes"]),
    } as Response;
  };
  try {
    await exportProject(p);
    assert.ok(exported);
    const zip = await JSZip.loadAsync(await exported.arrayBuffer());
    assert.ok(zip.file("builtin/brand/manrope.woff2"));
    assert.ok(zip.file("assets/image-1"));
    assert.ok(zip.file("project.json"));
    await clear();
    assert.equal(await get("asset:image-1"), undefined);
    const imported = await importProject(
      new File([await exported.arrayBuffer()], "project.zip"),
    );
    assert.equal(imported.scenes[0].media, "image-1");
    assert.deepEqual(uploaded.get("image-1"), bytes);
    const restored = await get<Blob>("asset:image-1");
    assert.deepEqual(new Uint8Array(await restored!.arrayBuffer()), bytes);
    assert.ok(await get("asset:/brand/manrope.woff2"));
    const incomplete = new JSZip();
    incomplete.file("project.json", JSON.stringify(p));
    const broken = new File(
      [await incomplete.generateAsync({ type: "uint8array" })],
      "incomplete.zip",
    );
    await assert.rejects(() => importProject(broken), /Falta recurso/);
  } finally {
    globalThis.fetch = old;
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    await clear();
  }
});
