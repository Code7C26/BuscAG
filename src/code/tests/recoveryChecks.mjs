// Repository migrations + synthetic users only. Runs in the existing isolated matrix.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function recoveryChecks(db, [a, b, c]) {
  const sql = await readFile(
    new URL(
      "../supabase/proposals/20261106000000_secure_recovery.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const snapshot = async () =>
    (
      await db.query(`select (select jsonb_agg(to_jsonb(i) order by id) from public.items i) items,
    (select jsonb_agg(to_jsonb(r)-'mode' order by id) from buscag_private.recovery_confirmations r) history,
    (select count(*) from public.notifications) notices`)
    ).rows;
  const before = await snapshot();
  await db.exec(sql);
  await db.exec(sql);
  assert.deepEqual(await snapshot(), before);
  await db.exec(await readFile(new URL('../supabase/audit/recovery_readiness.sql', import.meta.url), 'utf8'));
  assert.deepEqual((await db.query(`select
    has_function_privilege('anon','public.request_item_recovery(uuid,uuid)','EXECUTE') anon_request,
    has_function_privilege('anon','public.resolve_item_recovery(uuid,boolean)','EXECUTE') anon_resolve,
    has_function_privilege('authenticated','public.request_item_recovery(uuid,uuid)','EXECUTE') authenticated_request,
    has_table_privilege('authenticated','buscag_private.recovery_confirmations','INSERT,UPDATE,DELETE') direct_write`)).rows[0],
    {anon_request:false,anon_resolve:false,authenticated_request:true,direct_write:false});
  let checks = 1;
  const test = async (name, fn) => {
    await fn();
    console.log(`recovery ${++checks}: ${name}`);
  };
  async function call(uid, query, args = [], connection = db) {
    await connection.query("begin");
    try {
      await connection.query("set local role authenticated");
      await connection.query(
        "select set_config('request.jwt.claim.sub',$1,true)",
        [uid],
      );
      const result = await connection.query(query, args);
      await connection.query("commit");
      return result;
    } catch (error) {
      await connection.query("rollback");
      throw error;
    }
  }
  const denied = (promise) =>
    assert.rejects(promise, (e) => e.code === "42501");
  const publish = async (uid, status = "perdido") =>
    (
      await call(
        uid,
        "select * from public.publish_item_once(gen_random_uuid(),$1)",
        [
          JSON.stringify({
            title: "Ensayo recuperación",
            description: "Datos sintéticos sin usuarios reales",
            category: "Otros",
            status,
            date: "2026-11-06",
            lat: 0,
            lng: 0,
            location_name: "Ensayo",
            image_url: "https://images.invalid/test.png",
          }),
        ],
      )
    ).rows[0];
  const request = async (uid, item, partner, connection) =>
    (
      await call(
        uid,
        "select public.request_item_recovery($1,$2) id",
        [item, partner],
        connection,
      )
    ).rows[0].id;
  const resolve = async (uid, id, accept, connection) =>
    (
      await call(
        uid,
        "select public.resolve_item_recovery($1,$2) s",
        [id, accept],
        connection,
      )
    ).rows[0].s;
  const context = async (uid, item) =>
    (await call(uid, "select public.recovery_context($1) c", [item])).rows[0].c;
  const notices = async (item) =>
    (
      await db.query(
        "select count(*)::int n from public.notifications where related_item_id=$1",
        [item],
      )
    ).rows[0].n;
  const converse = (uid, owner, item) =>
    call(
      uid,
      "select * from public.send_message_once(gen_random_uuid(),$1,$2,$3)",
      [item, owner, "Ensayo de entrega"],
    );
  const solo = await publish(a),
    paired = await publish(a),
    found = await publish(b, "encontrado");
  await test("direct status PATCH and forged evidence are forbidden, even to the owner", async () => {
    await denied(
      call(a, "update public.items set status='recuperado' where id=$1", [
        solo.id,
      ]),
    );
    await denied(
      call(
        a,
        "insert into buscag_private.recovery_confirmations(item_id,owner_id,state) values($1,$2,'confirmed')",
        [solo.id, a],
      ),
    );
    const changed = await call(
      c,
      "update public.items set status='recuperado' where id=$1 returning id",
      [solo.id],
    );
    assert.equal(changed.rows.length, 0);
    await denied(request(c, solo.id, null));
    await denied(
      call(a, "select public.request_item_recovery($1,$2)", [solo.id, a]),
    );
    await denied(
      call(
        a,
        "insert into public.items(owner_id,status) values($1,'recuperado')",
        [a],
      ),
    );
  });
  await test("individual owner confirmation is persisted and retries never duplicate evidence/notices", async () => {
    const id = await request(a, solo.id, null),
      count = await notices(solo.id);
    assert.equal(await request(a, solo.id, null), id);
    assert.equal(await notices(solo.id), count);
    const state = await context(a, solo.id);
    assert.equal(state.status, "recuperado");
    assert.equal(state.requests[0].mode, "individual");
    assert.equal(state.requests[0].state, "confirmed");
    await denied(
      call(a, "update public.items set status='perdido' where id=$1", [
        solo.id,
      ]),
    );
  });
  await converse(b, a, paired.id);
  let id;
  await test("linked conversation blocks individual bypass; only the owner initiates a pending request", async () => {
    await denied(request(a, paired.id, null));
    await denied(request(b, paired.id, a));
    await denied(request(a, paired.id, c));
    id = await request(a, paired.id, b);
    const count = await notices(paired.id);
    assert.equal(await request(a, paired.id, b), id);
    assert.equal(await notices(paired.id), count);
    const state = await context(a, paired.id);
    assert.equal(state.status, "perdido");
    assert.equal(state.requests[0].state, "pending");
    await denied(
      call(a, "update public.items set status='recuperado' where id=$1", [
        paired.id,
      ]),
    );
    await assert.rejects(
      request(a, paired.id, null),
      (e) => e.code === "22023",
    );
    await denied(resolve(a, id, true));
    await denied(resolve(c, id, true));
    assert.deepEqual((await context(c, paired.id)).requests, []);
    assert.deepEqual((await context(b, paired.id)).partners, []);
  });
  await test("partner rejection survives reload, does not recover the item and is idempotent", async () => {
    assert.equal(await resolve(b, id, false), "cancelled");
    const count = await notices(paired.id);
    assert.equal(await resolve(b, id, false), "cancelled");
    assert.equal(await resolve(b, id, true), "cancelled");
    assert.equal(await notices(paired.id), count);
    assert.equal((await context(a, paired.id)).status, "perdido");
    await denied(request(a, paired.id, null));
    id = await request(a, paired.id, b);
  });
  await test("partner acceptance is atomic, idempotent and changes only the requested publication", async () => {
    assert.equal(await resolve(b, id, true), "confirmed");
    const count = await notices(paired.id);
    assert.equal(await resolve(b, id, true), "confirmed");
    assert.equal(await request(a, paired.id, b), id);
    assert.equal(await notices(paired.id), count);
    assert.equal((await context(a, paired.id)).status, "recuperado");
    assert.equal((await context(b, paired.id)).status, "recuperado");
    assert.equal((await context(b, found.id)).status, "encontrado");
    const general = await call(
      a,
      "select id,owner_id from public.items where id=any($1::uuid[])",
      [[paired.id, found.id]],
    );
    const mine = await call(
      b,
      "select id,owner_id from public.items where owner_id=$1 and id=any($2::uuid[])",
      [b, [paired.id, found.id]],
    );
    assert.equal(general.rows.length, 2);
    assert.equal(new Set(general.rows.map((r) => r.id)).size, 2);
    assert.deepEqual(mine.rows, [{ id: found.id, owner_id: b }]);
  });
  await test("server-persisted match also requires bilateral confirmation without a chat", async () => {
    await db.query(
      "insert into buscag_private.match_notices(lost_id,found_id,recipient_id) values($1,$2,$3) on conflict do nothing",
      [paired.id, found.id, b],
    );
    assert.ok((await context(b, found.id)).partners.some((p) => p.id === a));
    await denied(request(b, found.id, null));
    const matched = await request(b, found.id, a);
    assert.equal(await resolve(a, matched, true), "confirmed");
  });
  if (db.fork)
    await test("two independent sessions serialize duplicate requests and racing acceptance/rejection", async () => {
      const concurrent = await publish(a);
      await converse(b, a, concurrent.id);
      const first = await db.fork(),
        second = await db.fork();
      try {
        const ids = await Promise.all([
          request(a, concurrent.id, b, first),
          request(a, concurrent.id, b, second),
        ]);
        assert.equal(ids[0], ids[1]);
        const count = await notices(concurrent.id);
        const states = await Promise.all([
          resolve(b, ids[0], true, first),
          resolve(a, ids[0], false, second),
        ]);
        assert.equal(states[0], states[1]);
        assert.ok(["confirmed", "cancelled"].includes(states[0]));
        assert.equal(
          await notices(concurrent.id),
          count + (states[0] === "confirmed" ? 2 : 1),
        );
        const state = await context(a, concurrent.id);
        assert.equal(
          state.status,
          states[0] === "confirmed" ? "recuperado" : "perdido",
        );
        assert.equal(state.requests.length, 1);
      } finally {
        await first.end();
        await second.end();
      }
    });
  console.log(
    `PASS: ${checks} secure recovery groups; migration twice, isolated database only`,
  );
}
