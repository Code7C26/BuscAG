import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/index.mjs";
import { validateProject, timing } from "../server/model.mjs";
const seed = JSON.parse(
  await readFile(new URL("../src/seed.json", import.meta.url), "utf8"),
);
const password = "synthetic-test-password-2026";
async function harness(fn) {
  const dir = await mkdtemp(join(tmpdir(), "buscag-pitch-"));
  let server;
  try {
    server = await createApp({ dataDir: dir, password });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const origin = "http://127.0.0.1:" + server.address().port;
    let cookie = "";
    async function request(path, method = "GET", body, extra = {}) {
      const r = await fetch(origin + path, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
          ...extra,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: r.status,
        body: await r.json(),
        cookie: r.headers.get("set-cookie"),
      };
    }
    const login = await request("/api/login", "POST", { password });
    assert.equal(login.status, 200);
    cookie = login.cookie.split(";")[0];
    await fn({ request, origin, dir, getCookie: () => cookie });
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
}
test("24 escenas, bloques obligatorios y reserva exacta del video", () => {
  assert.equal(seed.scenes.length, 24);
  assert.deepEqual(timing(validateProject(seed)), {
    total: 1800,
    video: { start: 1500, duration: 60 },
    valid: true,
  });
  assert.equal(
    seed.scenes.slice(0, 3).reduce((a, b) => a + b.duration, 0),
    240,
  );
  assert.equal(
    seed.scenes.slice(6, 11).reduce((a, b) => a + b.duration, 0),
    420,
  );
  const bad = structuredClone(seed);
  bad.links.web = "javascript:alert(1)";
  assert.throws(() => validateProject(bad));
  bad.links.web = "https://example.com";
  bad.scenes[0].id = bad.scenes[1].id;
  assert.throws(() => validateProject(bad));
});
test("rutas privadas protegidas y guion ausente de API pública", async () =>
  harness(async ({ request, origin }) => {
    assert.equal((await fetch(origin + "/api/admin/project")).status, 401);
    const pub = await request("/api/project");
    assert.equal(pub.body.scenes[0].script, undefined);
    assert.equal(pub.body.scenes[0].actions, undefined);
    assert.ok((await request("/api/admin/project")).body.scenes[0].script);
    assert.equal(
      (
        await request(
          "/api/admin/control",
          "POST",
          { action: "scene", id: seed.scenes[1].id },
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/api/admin/control", "POST", {
          action: "scene",
          id: "nonexistent",
        })
      ).status,
      400,
    );
  }));
test("votos reales con tres sesiones, resultados ocultos/revelados, empate y duplicación mitigada", async () =>
  harness(async ({ request, origin }) => {
    assert.equal(
      (await request("/api/vote", "POST", { poll: "object", choice: 0 }))
        .status,
      409,
    );
    await request("/api/admin/control", "POST", {
      action: "rehearsal",
      value: false,
    });
    await request("/api/admin/control", "POST", {
      action: "poll",
      id: "object",
      open: true,
    });
    const vote = (choice) =>
      fetch(origin + "/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poll: "object", choice }),
      });
    const results = await Promise.all([vote(1), vote(1), vote(0)]);
    assert.deepEqual(
      results.map((r) => r.status),
      [200, 200, 200],
    );
    const voter = results[0].headers.get("set-cookie").split(";")[0];
    const repeat = await fetch(origin + "/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: voter },
      body: JSON.stringify({ poll: "object", choice: 2 }),
    });
    assert.equal(repeat.status, 409);
    let state = (await request("/api/state")).body;
    assert.equal(state.polls[1].total, 3);
    assert.equal(state.polls[1].counts, null);
    await request("/api/admin/control", "POST", {
      action: "poll",
      id: "object",
      open: false,
      reveal: true,
    });
    state = (await request("/api/state")).body;
    assert.deepEqual(state.polls[1].counts, [1, 2, 0]);
    assert.deepEqual(state.polls[1].winners, [1]);
    assert.equal((await vote(2)).status, 409);
    assert.equal(
      (
        await request("/api/admin/control", "POST", {
          action: "reset-real-votes",
        })
      ).status,
      400,
    );
    const changed = structuredClone(seed);
    changed.polls[1].options[0] = "Changed";
    assert.equal(
      (await request("/api/admin/project", "PUT", changed)).status,
      409,
    );
  }));
test("edición persistida, respaldo anterior y control de reloj", async () =>
  harness(async ({ request, dir }) => {
    const p = structuredClone(seed);
    p.scenes[0].title = "Edición comprobada";
    assert.equal((await request("/api/admin/project", "PUT", p)).status, 200);
    assert.equal(
      JSON.parse(await readFile(join(dir, "project.json"))).scenes[0].title,
      p.scenes[0].title,
    );
    assert.equal(
      JSON.parse(await readFile(join(dir, "project.backup.json"))).scenes[0]
        .title,
      seed.scenes[0].title,
    );
    const started = await request("/api/admin/control", "POST", {
      action: "timer",
      running: true,
    });
    assert.equal(started.body.running, true);
    await request("/api/admin/control", "POST", {
      action: "timer",
      running: false,
      reset: true,
    });
    assert.equal((await request("/api/state")).body.elapsed, 0);
    p.scenes[0].duration += 10;
    await request("/api/admin/project", "PUT", p);
    assert.equal(
      (
        await request("/api/admin/control", "POST", {
          action: "timer",
          running: true,
        })
      ).status,
      400,
    );
  }));
test("SSE entrega evento real al cambiar escena sin exponer notas", async () =>
  harness(async ({ origin, request }) => {
    const ac = new AbortController();
    const r = await fetch(origin + "/api/events", { signal: ac.signal });
    assert.equal(r.headers.get("content-type"), "text/event-stream");
    const reader = r.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.ok(first.includes("scene-01"));
    const next = reader.read();
    await request("/api/admin/control", "POST", {
      action: "scene",
      id: "scene-02",
    });
    const event = new TextDecoder().decode((await next).value);
    assert.ok(event.includes("scene-02"));
    assert.equal(event.includes("script"), false);
    ac.abort();
  }));
test("multimedia binaria y rangos de video sobreviven al guardado", async () =>
  harness(async ({ origin, getCookie }) => {
    const bytes = Buffer.from("synthetic-media-test");
    const upload = await fetch(origin + "/api/admin/assets/test-video", {
      method: "PUT",
      headers: { cookie: getCookie(), "Content-Type": "video/mp4" },
      body: bytes,
    });
    assert.equal(upload.status, 200);
    const full = await fetch(origin + "/media/test-video");
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
    const range = await fetch(origin + "/media/test-video", {
      headers: { range: "bytes=2-5" },
    });
    assert.equal(range.status, 206);
    assert.deepEqual(
      Buffer.from(await range.arrayBuffer()),
      bytes.subarray(2, 6),
    );
    const forbidden = await fetch(origin + "/api/admin/assets/unsafe", {
      method: "PUT",
      headers: { cookie: getCookie(), "Content-Type": "text/html" },
      body: "<script/>",
    });
    assert.equal(forbidden.status, 400);
  }));
test("al reiniciar se conservan votos y se impide repetir con la cookie previa", async () => {
  const dir = await mkdtemp(join(tmpdir(), "buscag-restart-"));
  let server;
  try {
    let voter;
    for (let i = 0; i < 2; i++) {
      server = await createApp({ dataDir: dir, password });
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      const origin = "http://127.0.0.1:" + server.address().port;
      if (i === 0) {
        const login = await fetch(origin + "/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const cookie = login.headers.get("set-cookie").split(";")[0];
        for (const body of [
          { action: "rehearsal", value: false },
          { action: "poll", id: "search", open: true },
        ])
          await fetch(origin + "/api/admin/control", {
            method: "POST",
            headers: { cookie, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      }
      const vote = await fetch(origin + "/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(voter ? { cookie: voter } : {}),
        },
        body: JSON.stringify({ poll: "search", choice: 0 }),
      });
      assert.equal(vote.status, i ? 409 : 200);
      voter ??= vote.headers.get("set-cookie").split(";")[0];
      const state = await (await fetch(origin + "/api/state")).json();
      assert.equal(state.polls[0].total, 1);
      await new Promise((r) => server.close(r));
      server = null;
    }
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
test("importar no puede sobrescribir bytes de un recurso ya existente", async () =>
  harness(async ({ origin, getCookie }) => {
    const put = (body) =>
      fetch(origin + "/api/admin/assets/immutable", {
        method: "PUT",
        headers: { cookie: getCookie(), "Content-Type": "image/png" },
        body,
      });
    assert.equal((await put("original")).status, 200);
    assert.equal((await put("original")).status, 200);
    assert.equal((await put("changed")).status, 400);
    assert.equal(
      await (await fetch(origin + "/media/immutable")).text(),
      "original",
    );
  }));
test("reiniciar ensayo no borra votos reales y los ejemplos se pueden modificar", async () =>
  harness(async ({ request }) => {
    await request("/api/admin/control", "POST", {
      action: "sample-vote",
      id: "search",
      choice: 0,
    });
    assert.equal(
      (await request("/api/state")).body.rehearsalCounts.search[0],
      9,
    );
    await request("/api/admin/control", "POST", { action: "reset-rehearsal" });
    assert.deepEqual(
      (await request("/api/state")).body.rehearsalCounts.search,
      [0, 0, 0],
    );
    await request("/api/admin/control", "POST", {
      action: "rehearsal",
      value: false,
    });
    assert.equal(
      (
        await request("/api/admin/control", "POST", {
          action: "sample-vote",
          id: "search",
          choice: 0,
        })
      ).status,
      400,
    );
  }));
test('controles concurrentes se guardan ordenadamente sin perder cambios',async()=>harness(async({request,dir})=>{const results=await Promise.all([request('/api/admin/control','POST',{action:'poll',id:'search',open:true}),request('/api/admin/control','POST',{action:'poll',id:'object',open:true}),request('/api/admin/control','POST',{action:'connection',value:true})]);assert.ok(results.every(r=>r.status===200));const saved=JSON.parse(await readFile(join(dir,'state.json')));assert.equal(saved.polls.search.open,true);assert.equal(saved.polls.object.open,true);assert.equal(saved.connection,true);}));
test('cero votos y empate no producen un ganador ficticio',async()=>harness(async({request,origin})=>{await request('/api/admin/control','POST',{action:'rehearsal',value:false});await request('/api/admin/control','POST',{action:'poll',id:'search',open:true,reveal:true});assert.deepEqual((await request('/api/state')).body.polls[0].winners,[]);for(const choice of [0,1])await fetch(origin+'/api/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({poll:'search',choice})});assert.deepEqual((await request('/api/state')).body.polls[0].winners,[0,1]);}));
