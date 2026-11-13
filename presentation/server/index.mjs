import http from "node:http";
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  stat,
  realpath,
  link,
  unlink,
} from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { resolve, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { validateProject, publicProject, timing } from "./model.mjs";
import {isInsideDirectory, resolvePublicPath} from "./static-paths.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function createApp({
  dataDir = process.env.PRESENTATION_DATA_DIR || join(root, "data"),
  password = process.env.PRESENTATION_ADMIN_PASSWORD,
  dev = false,
} = {}) {
  await mkdir(join(dataDir, "assets"), { recursive: true });
  let auth;
  if (password && password.length < 12)
    throw Error(
      "La contraseña de administración debe tener al menos 12 caracteres.",
    );
  if (password) {
    const salt = randomBytes(16).toString("hex");
    auth = { salt, hash: scryptSync(password, salt, 64).toString("hex") };
  } else
    try {
      auth = JSON.parse(await readFile(join(dataDir, "auth.json"), "utf8"));
    } catch {}
  const sessions = new Map(),
    attempts = new Map(),
    clients = new Set();
  const db = new DatabaseSync(join(dataDir, "votes.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS votes (poll TEXT NOT NULL, voter TEXT NOT NULL, choice INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(poll,voter));",
  );
  let project = JSON.parse(await readFile(join(root, "src/seed.json"), "utf8"));
  try {
    project = validateProject(
      JSON.parse(await readFile(join(dataDir, "project.json"), "utf8")),
    );
  } catch (e) {
    if (existsSync(join(dataDir, "project.json")))
      throw Error("Proyecto guardado inválido: restaurar backup.");
  }
  let state = {
    sceneId: project.scenes[0].id,
    running: false,
    elapsed: 0,
    at: Date.now(),
    rehearsal: true,
    connection: false,
    rehearsalCounts: { search: [8, 5, 3], object: [8, 5, 3] },
    polls: {
      search: { open: false, reveal: false },
      object: { open: false, reveal: false },
    },
  };
  try {
    const saved = JSON.parse(
      await readFile(join(dataDir, "state.json"), "utf8"),
    );
    state = { ...state, ...saved, running: false, at: Date.now() };
  } catch {}
  const elapsed = () =>
    state.elapsed + (state.running ? (Date.now() - state.at) / 1000 : 0);
  let saveQueue = Promise.resolve();
  function save() {
    const content=JSON.stringify({...state,elapsed:elapsed(),at:Date.now()});
    saveQueue=saveQueue.catch(()=>{}).then(async()=>{
      await writeFile(join(dataDir,"state.tmp"),content);
      await rename(join(dataDir,"state.tmp"),join(dataDir,"state.json"));
    });
    return saveQueue;
  }
  function stats(id, admin = false) {
    const poll = project.polls.find((p) => p.id === id);
    if (!poll) return null;
    const rows = db
      .prepare(
        "SELECT choice,count(*) n FROM votes WHERE poll=? GROUP BY choice",
      )
      .all(id);
    const counts = poll.options.map((_, i) =>
      Number(rows.find((r) => r.choice === i)?.n || 0),
    );
    const total = counts.reduce((a, b) => a + b, 0),
      max = Math.max(...counts);
    return {
      ...poll,
      ...state.polls[id],
      total,
      counts: admin || state.polls[id].reveal ? counts : null,
      winners:
        state.polls[id].reveal && total
          ? counts.flatMap((n, i) => (n === max ? [i] : []))
          : [],
    };
  }
  const snapshot = (admin = false) => ({
    ...state,
    elapsed: elapsed(),
    at: Date.now(),
    polls: project.polls.map((p) => stats(p.id, admin)),
    timing: timing(project),
  });
  function emit() {
    const msg = "data: " + JSON.stringify(snapshot()) + "\n\n";
    for (const c of clients) c.write(msg);
  }
  const heartbeat = setInterval(() => {
    for (const c of clients) c.write(": alive\n\n");
  }, 15000);
  heartbeat.unref();
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
    ".wav": "audio/wav",
    ".md": "text/plain; charset=utf-8",
    ".json": "application/json",
    ".pdf": "application/pdf",
  };
  const cookies = (req) =>
    Object.fromEntries(
      (req.headers.cookie || "").split(";").map((s) => s.trim().split("=")),
    );
  const isAdmin = (req) => {
    const key = cookies(req).buscag_admin;
    const expiry = sessions.get(key);
    return expiry && expiry > Date.now();
  };
  async function jsonBody(req, max = 2 * 1024 * 1024) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > max) throw Error("Archivo demasiado grande.");
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
  }
  const send = (res, status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  const vite = dev
    ? await (
        await import("vite")
      ).createServer({ root, server: { middlewareMode: true }, appType: "spa" })
    : null;
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://localhost"),
        path = u.pathname;
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "same-origin");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      if (!dev)
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
        );
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.origin;
        if (
          origin &&
          origin !== `http://${req.headers.host}` &&
          origin !== `https://${req.headers.host}`
        )
          return send(res, 403, { error: "Origen rechazado." });
      }
      if (path === "/api/login" && req.method === "POST") {
        if (!auth)
          return send(res, 503, {
            error:
              "Administración sin configurar. Ejecutar npm run setup en esta PC.",
          });
        const ip = req.socket.remoteAddress || "",
          record = attempts.get(ip) || { count: 0, at: Date.now() };
        if (Date.now() - record.at > 600000) {
          record.count = 0;
          record.at = Date.now();
        }
        if (record.count >= 8)
          return send(res, 429, {
            error: "Demasiados intentos. Esperar diez minutos.",
          });
        record.count++;
        attempts.set(ip, record);
        const input = await jsonBody(req, 4096);
        const actual = scryptSync(
          String(input.password || "").slice(0, 1024),
          auth.salt,
          64,
        );
        if (!timingSafeEqual(actual, Buffer.from(auth.hash, "hex")))
          return send(res, 401, { error: "Contraseña incorrecta." });
        attempts.delete(ip);
        const session = randomBytes(32).toString("hex");
        sessions.set(session, Date.now() + 8 * 3600000);
        res.setHeader(
          "Set-Cookie",
          `buscag_admin=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${req.socket.encrypted || process.env.PRESENTATION_HTTPS === "1" ? "; Secure" : ""}`,
        );
        return send(res, 200, { ok: true });
      }
      if (path === "/api/logout" && req.method === "POST") {
        sessions.delete(cookies(req).buscag_admin);
        res.setHeader(
          "Set-Cookie",
          "buscag_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        return send(res, 200, { ok: true });
      }
      if (path === "/api/session")
        return send(res, 200, { admin: !!isAdmin(req), configured: !!auth });
      if (path === "/api/events" && req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });
        res.write("data: " + JSON.stringify(snapshot()) + "\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (path === "/api/state" && req.method === "GET")
        return send(res, 200, snapshot());
      if (path === "/api/project" && req.method === "GET")
        return send(res, 200, publicProject(project));
      if (path === "/api/vote" && req.method === "POST") {
        const b = await jsonBody(req, 2048),
          p = project.polls.find((p) => p.id === b.poll);
        if (state.rehearsal)
          return send(res, 409, {
            error: "Ensayo activo: no se reciben votos reales.",
          });
        if (
          !p ||
          !state.polls[p.id].open ||
          !Number.isInteger(b.choice) ||
          !p.options[b.choice]
        )
          return send(res, 409, {
            error: "Encuesta cerrada u opción inválida.",
          });
        let voter = cookies(req).buscag_voter;
        if (!voter || !/^\w{64}$/.test(voter)) {
          voter = randomBytes(32).toString("hex");
          res.setHeader(
            "Set-Cookie",
            `buscag_voter=${voter}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${process.env.PRESENTATION_HTTPS === "1" ? "; Secure" : ""}`,
          );
        }
        // Stable cookie is itself random; persist its digest without a rotating key for restart dedup.
        const stable = createHash("sha256").update(voter).digest("hex");
        const result = db
          .prepare(
            "INSERT OR IGNORE INTO votes(poll,voter,choice,at) VALUES(?,?,?,?)",
          )
          .run(p.id, stable, b.choice, Date.now());
        if (!result.changes)
          return send(res, 409, {
            error: "Esta sesión ya votó en la encuesta.",
          });
        emit();
        return send(res, 200, { ok: true });
      }
      if (path.startsWith("/api/admin")) {
        if (!isAdmin(req))
          return send(res, 401, {
            error: "Se requiere acceso de presentador.",
          });
        if (path === "/api/admin/original" && req.method === "GET")
          return send(
            res,
            200,
            JSON.parse(await readFile(join(root, "src/seed.json"), "utf8")),
          );
        if (path === "/api/admin/project" && req.method === "GET")
          return send(res, 200, project);
        if (path === "/api/admin/state" && req.method === "GET")
          return send(res, 200, snapshot(true));
        if (path === "/api/admin/project" && req.method === "PUT") {
          const next = validateProject(await jsonBody(req));
          for (const p of project.polls) {
            const n = next.polls.find((v) => v.id === p.id);
            if (
              JSON.stringify(n) !== JSON.stringify(p) &&
              Number(
                db
                  .prepare("SELECT count(*) n FROM votes WHERE poll=?")
                  .get(p.id).n,
              ) > 0
            )
              return send(res, 409, {
                error:
                  "Una encuesta con votos reales no se puede redefinir. Crear otra sesión en un directorio de datos nuevo.",
              });
          }
          await writeFile(
            join(dataDir, "project.backup.json"),
            JSON.stringify(project),
          );
          await writeFile(join(dataDir, "project.tmp"), JSON.stringify(next));
          await rename(
            join(dataDir, "project.tmp"),
            join(dataDir, "project.json"),
          );
          project = next;
          if (!project.scenes.find((s) => s.id === state.sceneId && !s.hidden))
            state.sceneId = project.scenes.find((s) => !s.hidden).id;
          emit();
          return send(res, 200, { ok: true });
        }
        if (path === "/api/admin/control" && req.method === "POST") {
          const b = await jsonBody(req, 8192);
          if (b.action === "scene") {
            if (!project.scenes.find((s) => s.id === b.id && !s.hidden))
              throw Error("Escena no disponible.");
            state.sceneId = b.id;
            state.connection = false;
          } else if (b.action === "timer") {
            if (b.running && !timing(project).valid)
              throw Error(
                "Ajustar a 30:00 y video 25:00–26:00 antes de iniciar.",
              );
            state.elapsed = b.reset ? 0 : elapsed();
            state.running = !!b.running;
            state.at = Date.now();
          } else if (b.action === "rehearsal") {
            if (state.polls.search.open || state.polls.object.open)
              throw Error("Cerrar encuestas antes de cambiar modo.");
            state.rehearsal = !!b.value;
          } else if (b.action === "reset-rehearsal") {
            state.rehearsalCounts = Object.fromEntries(
              project.polls.map((p) => [p.id, p.options.map(() => 0)]),
            );
          } else if (b.action === "sample-vote") {
            if (!state.rehearsal)
              throw Error("Sólo se agregan datos ficticios en ensayo.");
            const poll = project.polls.find((p) => p.id === b.id);
            if (!poll || !Number.isInteger(b.choice) || !poll.options[b.choice])
              throw Error("Opción inválida.");
            state.rehearsalCounts[b.id] = poll.options.map(
              (_, i) =>
                (state.rehearsalCounts[b.id][i] || 0) +
                (i === b.choice ? 1 : 0),
            );
          } else if (b.action === "connection") state.connection = !!b.value;
          else if (b.action === "poll") {
            if (!state.polls[b.id]) throw Error("Encuesta no válida.");
            if (typeof b.open === "boolean") state.polls[b.id].open = b.open;
            if (typeof b.reveal === "boolean")
              state.polls[b.id].reveal = b.reveal;
          } else throw Error("Control no válido.");
          await save();
          emit();
          return send(res, 200, snapshot(true));
        }
        if (path.startsWith("/api/admin/assets/") && req.method === "PUT") {
          const id = path.split("/").pop(),
            type = req.headers["content-type"];
          if (
            !/^[-\w]{1,100}$/.test(id) ||
            ![
              "image/png",
              "image/jpeg",
              "image/webp",
              "video/mp4",
              "video/webm",
              "audio/mpeg",
              "audio/wav",
              "audio/ogg",
              "audio/mp4",
            ].includes(type)
          )
            throw Error("Tipo de archivo no admitido.");
          const { open } = await import("node:fs/promises");
          const tmp = join(
              dataDir,
              "assets",
              id + "." + randomBytes(8).toString("hex") + ".tmp",
            ),
            handle = await open(tmp, "wx");
          const hash = createHash("sha256");
          let size = 0;
          try {
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 1024 ** 3) throw Error("Máximo 1 GB por recurso.");
              hash.update(chunk);
              await handle.write(chunk);
            }
          } finally {
            await handle.close();
          }
          const digest = hash.digest("hex");
          const destination = join(dataDir, "assets", id);
          try {
            await link(tmp, destination);
          } catch (e) {
            if (e.code !== "EEXIST") throw e;
            const existing = createHash("sha256");
            for await (const chunk of createReadStream(destination))
              existing.update(chunk);
            const previous = JSON.parse(
              await readFile(destination + ".json", "utf8"),
            );
            if (existing.digest("hex") !== digest || previous.type !== type) {
              await unlink(tmp);
              throw Error(
                "El identificador ya contiene otro recurso. No se sobrescribió.",
              );
            }
          }
          await unlink(tmp);
          await writeFile(
            join(dataDir, "assets", id + ".json"),
            JSON.stringify({ type, size }),
          );
          return send(res, 200, { ok: true });
        }
        return send(res, 404, { error: "Acción no encontrada." });
      }
      if (path.startsWith("/media/")) {
        const id = path.split("/").pop();
        if (!/^[-\w]{1,100}$/.test(id)) return send(res, 404, {});
        const file = join(dataDir, "assets", id),
          meta = JSON.parse(await readFile(file + ".json", "utf8"));
        const range = req.headers.range;
        if (range) {
          const m = /^bytes=(\d+)-(\d*)$/.exec(range);
          if (!m) return send(res, 416, {});
          const start = Number(m[1]),
            end = m[2] ? Math.min(Number(m[2]), meta.size - 1) : meta.size - 1;
          if (start > end || start >= meta.size) return send(res, 416, {});
          res.writeHead(206, {
            "Content-Type": meta.type,
            "Content-Range": `bytes ${start}-${end}/${meta.size}`,
            "Content-Length": end - start + 1,
            "Accept-Ranges": "bytes",
          });
          createReadStream(file, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            "Content-Type": meta.type,
            "Content-Length": meta.size,
            "Accept-Ranges": "bytes",
          });
          createReadStream(file).pipe(res);
        }
        return;
      }
      if (path === "/api/health")
        return send(res, 200, {
          ok: true,
          storage: "SQLite",
          productionBuscAG: "untouched",
        });
      if (path.startsWith("/api/"))
        return send(res, 404, { error: "Ruta no encontrada." });
      if (dev && /seed\.json|server\/|\/@fs\//.test(path))
        return send(res, 403, { error: "Archivo privado." });
      if (dev) return vite.middlewares(req, res);
      if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, {error: 'Método no permitido.'});
      const base = join(root, 'dist');
      const requested = resolvePublicPath(base, path);
      const spaRoutes = new Set(['/', '/presenter', '/studio', '/admin', '/vote']);
      const target = spaRoutes.has(path) ? join(base, 'index.html') : requested;
      let info, canonical;
      try {
        info = await stat(target);
        if (!info.isFile()) return send(res, 404, {error: 'Recurso no encontrado.'});
        canonical = await realpath(target);
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return send(res, 404, {error: 'Recurso no encontrado.'});
        throw error;
      }
      const canonicalBase = await realpath(base);
      if (!isInsideDirectory(canonicalBase, canonical)) return send(res, 403, {error: 'Ruta fuera del directorio público.'});
      const contentType = mime[extname(target).toLowerCase()];
      if (!contentType) return send(res, 404, {error: 'Tipo de recurso no permitido.'});
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': info.size,
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(canonical);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (e) {
      if (!res.headersSent)
        send(res, e.status || (e.code === "ENOENT" ? 404 : 400), {
          error:
            e.code === "ENOENT"
              ? "Recurso no encontrado."
              : e.message || "No se pudo completar la operación.",
        });
      else res.end();
    }
  });
  const originalClose = server.close.bind(server);
  server.close = function (cb) {
    clearInterval(heartbeat);
    for (const c of clients) c.end();
    vite?.close();
    db.close();
    return originalClose(cb);
  };
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await createApp({ dev: process.argv.includes("--dev") });
  server.listen(
    Number(process.env.PORT || 4173),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `BuscAG presentación en http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 4173} · /presenter · /studio · /vote`,
      ),
  );
}
