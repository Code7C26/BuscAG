import seed from "./public-seed.json";
import { get, set } from "idb-keyval";
import JSZip from "jszip";
import { validateProject } from "../server/model.mjs";
export type Asset = {
  id: string;
  name: string;
  type: string;
  size?: number;
  seconds?: number;
};
export type Project = Omit<typeof seed, "assets"> & {
  assets: Asset[];
  logo?: string;
};
export type Scene = Project["scenes"][number];
export type Poll = {
  id: string;
  source?: string;
  question: string;
  options: string[];
  open: boolean;
  reveal: boolean;
  total: number;
  counts: number[] | null;
  winners: number[];
};
export type Live = {
  sceneId: string;
  projectRevision?: number;
  running: boolean;
  elapsed: number;
  at: number;
  rehearsal: boolean;
  legacyProject?: boolean;
  inputSource?: "online"|"hands";
  handCounts?: Record<string,number[]>;
  remoteCloseUnconfirmed?: boolean;
  voting?: {configured:boolean;origin:string;connected:boolean;lastAt:number;error:string;pairing?:{phase:string;code?:string;url?:string;expiresAt?:number;error?:string}};
  connection: boolean;
  polls: Poll[];
  rehearsalCounts: Record<string, number[]>;
  timing: {
    total: number;
    valid: boolean;
    video: { start: number; duration: number } | null;
  };
};
export const original = () => structuredClone(seed);
export const fmt = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(Math.max(0, s) % 60)
    .toString()
    .padStart(2, "0")}`;
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "No se pudo completar la acción.");
  return data;
}
export const control = (body: unknown) =>
  api("/api/admin/control", "POST", body);
export function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function cacheAsset(id: string, blob: Blob) {
  await set("asset:" + id, blob);
}
export async function uploadAsset(id: string, blob: Blob) {
  const r = await fetch("/api/admin/assets/" + id, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": blob.type },
  });
  if (!r.ok) throw Error((await r.json()).error);
  await cacheAsset(id, blob);
}
const builtins = [
  "/sounds/connection.wav",
  "/brand/icon.svg",
  "/brand/manrope.woff2",
  "/brand/Manrope-OFL.txt",
  "/captures/home-desktop.png",
  "/captures/publish.png",
  "/captures/home-phone.png",
  "/captures/map.png",
  "/captures/comparison.png",
  "/captures/chat.png",
  "/captures/manifest.json",
];
async function assetBlob(id: string): Promise<Blob> {
  const local = await get<Blob>("asset:" + id);
  if (local) return local;
  const r = await fetch("/media/" + id);
  if (!r.ok) throw Error("Falta recurso: " + id);
  return r.blob();
}
export async function exportProject(p: Project) {
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(p, null, 2));
  for (const a of p.assets)
    zip.file(
      "assets/" + a.id,
      new Uint8Array(await (await assetBlob(a.id)).arrayBuffer()),
    );
  for (const path of builtins) {
    const r = await fetch(path);
    if (!r.ok) throw Error("No se puede respaldar " + path);
    zip.file(
      "builtin" + path,
      new Uint8Array(await (await r.blob()).arrayBuffer()),
    );
  }
  zip.file(
    "TRANSFERENCIA.txt",
    "Instalar la aplicación en la otra PC. Iniciar servidor, entrar a Studio e importar este ZIP. Incluye proyecto, recursos originales y multimedia cargada. El ZIP contiene guion privado. No incluye claves ni votos reales. Ver README y OPERACION.md.",
  );
  download(
    await zip.generateAsync({ type: "blob", compression: "STORE" }),
    "BuscAG-proyecto-" + new Date().toISOString().slice(0, 10) + ".zip",
  );
}
export async function importProject(file: File): Promise<Project> {
  if (file.size > 2 * 1024 ** 3)
    throw Error("ZIP demasiado grande (máximo 2 GB).");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let total = 0;
  for (const f of Object.values(zip.files)) {
    if (f.unsafeOriginalName && f.unsafeOriginalName !== f.name)
      throw Error("ZIP contiene rutas inseguras.");
    total += (f as any)._data?.uncompressedSize || 0;
    if (total > 2 * 1024 ** 3) throw Error("ZIP expandido demasiado grande.");
  }
  const raw = zip.file("project.json");
  if (!raw) throw Error("No contiene project.json.");
  const p = validateProject(JSON.parse(await raw.async("string"))) as Project;
  // Verify inventory before any upload. Imports never delete live votes or server assets.
  const blobs = [];
  for (const a of p.assets) {
    const f = zip.file("assets/" + a.id);
    if (!f) throw Error("Falta recurso " + a.name);
    blobs.push({
      id: a.id,
      blob: new Blob([await f.async("arraybuffer")], { type: a.type }),
    });
  }
  for (const path of builtins) {
    if (!zip.file("builtin" + path)) throw Error("Falta recurso base " + path);
  }
  for (const { id, blob } of blobs) await uploadAsset(id, blob);
  for (const path of builtins) {
    const f = zip.file("builtin" + path);
    if (!f) throw Error("Falta recurso base " + path);
    await cacheAsset(path, new Blob([await f.async("arraybuffer")]));
  }
  return p;
}
export const saveDraft = (p: Project) => set("project-draft", p);
export const getDraft = () => get<Project>("project-draft");
