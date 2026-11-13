// Disposable DB only. Invoked by the existing date/timestamptz security matrix.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
export async function schoolChecks(db, users) {
  const sql = await readFile(
    new URL(
      "../supabase/proposals/20261105000000_school_features.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const snapshot = async () =>
    (
      await db.query(
        `select (select count(*) from public.items) items,(select count(*) from public.messages) messages,(select count(*) from public.profiles) profiles,(select count(*) from public.notifications) notifications`,
      )
    ).rows;
  // Run before feature tables exist: drift must fail before any extension is installed.
  await db.exec('alter table public.items disable row level security');
  await assert.rejects(db.exec(sql),e=>e.message.includes('RLS/ACL drift'));await db.exec('rollback');
  assert.equal((await db.query("select to_regclass('buscag_private.object_tags') t")).rows[0].t,null);
  await db.exec('alter table public.items enable row level security');
  await db.exec('grant insert on public.items to authenticated');
  await assert.rejects(db.exec(sql),e=>e.message.includes('RPC-only writes'));await db.exec('rollback');
  await db.exec('revoke insert on public.items from authenticated');
  const before = await snapshot();
  await db.exec(sql);
  await db.exec(sql);
  assert.deepEqual(await snapshot(), before);
  await db.exec('alter table buscag_private.recovery_confirmations drop constraint recovery_confirmations_item_id_fkey; alter table buscag_private.recovery_confirmations add constraint recovery_confirmations_item_id_fkey foreign key(item_id) references public.items(id) on delete restrict');
  await assert.rejects(db.exec(sql),e=>e.message.includes('Recovery retention schema drift'));
  await db.exec('rollback');
  await db.exec('alter table buscag_private.recovery_confirmations drop constraint recovery_confirmations_item_id_fkey; alter table buscag_private.recovery_confirmations add constraint recovery_confirmations_item_id_fkey foreign key(item_id) references public.items(id) on delete cascade');
  let checks = 3; // preflight rejection plus repeatable installation
  const test = async (name, fn) => {
    await fn();
    checks++;
    console.log("school: " + name);
  };
  const as = async (role, uid, query, args = []) => {
    await db.exec("begin");
    try {
      await db.exec("set local role " + role);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        uid || "",
      ]);
      const r = await db.query(query, args);
      await db.exec("commit");
      return r;
    } catch (e) {
      await db.exec("rollback");
      throw e;
    }
  };
  const [a, b, c] = users;
  const call = (uid, query, args = []) => as("authenticated", uid, query, args);
  const denied = (fn) => assert.rejects(fn, (e) => e.code === "42501");
  const payload = {
    title: "Zafiro mochila violeta",
    description: "Zafiro mochila violeta cierre plateado",
    image_url: "https://images.invalid/synthetic.png",
    category: "Otros",
    location_name: "Synthetic school",
    lat: 0,
    lng: 0,
    date: "2026-11-05",
    status: "perdido",
  };
  const publish = async (uid, status) =>
    (
      await call(
        uid,
        "select * from public.publish_item_once(gen_random_uuid(),$1)",
        [JSON.stringify({ ...payload, status })],
      )
    ).rows[0];
  await db.exec(
    "update buscag_private.match_control set enabled=true;delete from buscag_private.match_jobs",
  );
  const lost = await publish(a, "perdido");
  const found = await publish(b, "encontrado");
  const watch = (uid, enabled, lat = 0, radius = 1) =>
    call(uid, "select public.set_item_watch($1,$2,$3,0,$4)", [
      lost.id,
      enabled,
      lat,
      radius,
    ]);
  const work = () =>
    as("service_role", null, "select public.process_match_jobs(20)");
  const count = async () =>
    (
      await db.query(
        "select count(*)::int n from buscag_private.match_notices where lost_id=$1 and found_id=$2",
        [lost.id, found.id],
      )
    ).rows[0].n;
  await test("private tables and RPCs inaccessible to anonymous/foreign users", async () => {
    await denied(() =>
      as("anon", null, "select public.community_statistics()"),
    );
    await denied(() => call(c, "select * from buscag_private.item_watches"));
    await denied(() => watch(c, true));
    await denied(() => call(c, "select public.get_item_watch($1)", [lost.id]));
    await denied(() =>
      call(c, "select public.manage_object_tag($1,true,false)", [lost.id]),
    );
  });
  await test("radius and disabled watch filter existing worker before ledger inserts", async () => {
    await watch(a, true, 10, 1);
    await work();
    assert.equal(await count(), 0);
    await watch(a, false);
    await work();
    assert.equal(await count(), 0);
    await assert.rejects(watch(a, true, 0, -1), (e) => e.code === "22023");
    await assert.rejects(watch(a, true, NaN, 1), (e) => e.code === "22023");
  });
  await test("backend rejects explicit contradictory colors despite shared generic words", async () => {
    const r = await db.query(
      "select buscag_private.match_score(l,jsonb_populate_record(null::public.items,to_jsonb(f)||jsonb_build_object('title','Zafiro mochila roja','description','Zafiro mochila roja cierre plateado'))) score from public.items l,public.items f where l.id=$1 and f.id=$2",
      [lost.id, found.id],
    );
    assert.equal(r.rows[0].score, null);
  });
  await test("preferences and pair ledger prevent duplicate notices", async () => {
    await call(b, "select public.set_match_preference(false)");
    await watch(a, true);
    await work();
    assert.equal(await count(), 1);
    await watch(a, true);
    await work();
    assert.equal(await count(), 1);
    await call(b, "select public.set_match_preference(true)");
    await watch(a, true);
    await work();
    assert.equal(await count(), 2);
    await watch(a, true);
    await work();
    assert.equal(await count(), 2);
  });
  let token;
  await test("public QR contains no private fields and rotates/revokes", async () => {
    token = (
      await call(a, "select public.manage_object_tag($1,true,false) t", [
        lost.id,
      ])
    ).rows[0].t.token;
    const read = async (t) =>
      (await as("anon", null, "select public.resolve_object_tag($1) t", [t]))
        .rows[0].t;
    assert.deepEqual(Object.keys(await read(token)).sort(), [
      "category",
      "item_id",
      "status",
    ]);
    // Legacy free-text classifications must never leak through an anonymous QR.
    const hasChecks=(await db.query("select count(*)::int n from pg_constraint where conrelid='public.items'::regclass and contype='c' and (pg_get_constraintdef(oid) like '%category%' or pg_get_constraintdef(oid) like '%status%')")).rows[0].n>0;
    if(!hasChecks){
    await db.exec('alter table public.items disable trigger user');
    try{
      await db.query("update public.items set category='PRIVATE_LEGACY_FIELD',status='PRIVATE_LEGACY_STATE' where id=$1",[lost.id]);
      const legacy=await read(token);assert.equal(legacy.category,null);assert.equal(legacy.status,null);
    }finally{
      await db.query("update public.items set category='Otros',status='perdido' where id=$1",[lost.id]);
      await db.exec('alter table public.items enable trigger user');
    }
    }
    const rotated = (
      await call(a, "select public.manage_object_tag($1,true,true) t", [
        lost.id,
      ])
    ).rows[0].t.token;
    assert.notEqual(rotated, token);
    assert.equal(await read(token), null);
    token = rotated;
    await call(a, "select public.manage_object_tag($1,false,false)", [lost.id]);
    assert.equal(await read(token), null);
    await call(a, "select public.manage_object_tag($1,true,false)", [lost.id]);
  });
  let request;
  await test("recovery requires an existing conversation; third parties cannot decide", async () => {
    await denied(() =>
      call(a, "select public.request_item_recovery($1,$2)", [lost.id, c]),
    );
    await call(
      b,
      "select * from public.send_message_once(gen_random_uuid(),$1,$2,$3)",
      [lost.id, a, "Synthetic return conversation"],
    );
    request = (
      await call(a, "select public.request_item_recovery($1,$2) id", [
        lost.id,
        b,
      ])
    ).rows[0].id;
    assert.equal(
      (
        await call(a, "select public.request_item_recovery($1,$2) id", [
          lost.id,
          b,
        ])
      ).rows[0].id,
      request,
    );
    await denied(() =>
      call(a, "select public.resolve_item_recovery($1,true)", [request]),
    );
    await denied(() =>
      call(c, "select public.resolve_item_recovery($1,true)", [request]),
    );
    assert.deepEqual(
      (
        await call(c, "select public.list_recovery_confirmations($1) r", [
          lost.id,
        ])
      ).rows[0].r,
      [],
    );
  });
  await test("second participant confirms once; messages/history survive until explicit deletion", async () => {
    assert.equal(
      (
        await call(b, "select public.resolve_item_recovery($1,true) s", [
          request,
        ])
      ).rows[0].s,
      "confirmed",
    );
    assert.equal(
      (
        await call(b, "select public.resolve_item_recovery($1,true) s", [
          request,
        ])
      ).rows[0].s,
      "confirmed",
    );
    assert.equal(
      (await db.query("select status from public.items where id=$1", [lost.id]))
        .rows[0].status,
      "recuperado",
    );
    await denied(() =>
      call(a, "update public.items set status='encontrado' where id=$1", [
        lost.id,
      ]),
    );
    assert.equal(
      (
        await call(a, "select * from public.messages where item_id=$1", [
          lost.id,
        ])
      ).rows.length,
      1,
    );

  });
  await test("statistics use real rows and respect caller RLS", async () => {
    const stats = (await call(a, "select public.community_statistics() s"))
      .rows[0].s;
    assert.equal(
      Number(stats.publications),
      (await call(a, "select count(*)::int n from public.items")).rows[0].n,
    );
    assert.equal(stats.scope, "visible_by_rls");
    assert.ok(Number(stats.recovered) >= 1);
    // Prove invoker semantics with an additional restrictive policy, rolled back.
    await db.exec("begin");
    try {
      await db.exec(
        "create policy school_test_scope on public.items as restrictive for select to authenticated using(owner_id=auth.uid())",
      );
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [a]);
      const filtered = (
        await db.query("select public.community_statistics() s")
      ).rows[0].s;
      assert.equal(filtered.publications, filtered.mine);
      assert.ok(Number(filtered.publications) < Number(stats.publications));
    } finally {
      await db.exec("rollback");
    }
  });
  await test("cancellation is participant-only and new requests are rate bounded", async () => {
    const extra = await publish(a, "perdido");
    await call(
      b,
      "select * from public.send_message_once(gen_random_uuid(),$1,$2,$3)",
      [extra.id, a, "Synthetic cancellation conversation"],
    );
    for (let n = 0; n < 5; n++) {
      const id = (
        await call(a, "select public.request_item_recovery($1,$2) id", [
          extra.id,
          b,
        ])
      ).rows[0].id;
      await denied(() =>
        call(c, "select public.resolve_item_recovery($1,false)", [id]),
      );
      assert.equal(
        (await call(a, "select public.resolve_item_recovery($1,false) s", [id]))
          .rows[0].s,
        "cancelled",
      );
      assert.equal(
        (await call(a, "select public.resolve_item_recovery($1,false) s", [id]))
          .rows[0].s,
        "cancelled",
      );
    }
    await assert.rejects(
      call(a, "select public.request_item_recovery($1,$2)", [extra.id, b]),
      (e) => e.code === "P0001",
    );
    assert.equal(
      (
        await db.query("select status from public.items where id=$1", [
          extra.id,
        ])
      ).rows[0].status,
      "perdido",
    );
  });
  if(db.fork)await test('native watch transaction does not block match notification foreign keys',async()=>{
    await db.exec('delete from buscag_private.match_jobs');
    const content={...payload,title:'Amatista bolso azul',description:'Amatista bolso azul cierre'};
    const l=(await call(a,'select * from public.publish_item_once(gen_random_uuid(),$1)',[JSON.stringify(content)])).rows[0];
    const f=(await call(b,'select * from public.publish_item_once(gen_random_uuid(),$1)',[JSON.stringify({...content,status:'encontrado'})])).rows[0];
    const watcher=await db.fork(),worker=await db.fork();
    try{
      await watcher.query('begin');await watcher.query('set local role authenticated');await watcher.query("select set_config('request.jwt.claim.sub',$1,true)",[a]);
      await watcher.query('select public.set_item_watch($1,true,0,0,3)',[l.id]);
      await worker.query('begin');await worker.query('set local role service_role');await worker.query("set local statement_timeout='1000ms'");
      const result=(await worker.query('select public.process_match_jobs(20) r')).rows[0].r;
      assert.equal(result.failures,0);assert.equal(result.notifications,2);await worker.query('commit');
      assert.equal((await db.query('select count(*)::int n from buscag_private.match_notices where lost_id=$1 and found_id=$2',[l.id,f.id])).rows[0].n,2);
    }finally{
      await Promise.allSettled([watcher.query('rollback'),worker.query('rollback')]);await Promise.all([watcher.end(),worker.end()]);
    }
  });
  await test("read-only readiness verifies RPC ACLs and scheduler fails closed without pg_cron", async () => {
    const audit = await readFile(
      new URL("../supabase/audit/school_readiness.sql", import.meta.url),
      "utf8",
    );
    const original = await snapshot();
    await db.exec(audit);
    assert.deepEqual(await snapshot(), original);
    const acl = (
      await db.query(
        "select has_function_privilege('anon','public.resolve_object_tag(uuid)','EXECUTE') qr,has_function_privilege('anon','public.request_item_recovery(uuid,uuid)','EXECUTE') recovery,has_function_privilege('authenticated','public.process_match_jobs(integer)','EXECUTE') worker",
      )
    ).rows[0];
    assert.deepEqual(acl, { qr: true, recovery: false, worker: false });
    const cron = await readFile(
      new URL(
        "../supabase/activation/schedule_school_matching_STAGING_ONLY.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await assert.rejects(db.exec(cron), (e) => e.message.includes("pg_cron"));
    await db.exec("rollback");
    assert.deepEqual(await snapshot(), original);
  });
  await test("reapplying preserves watches, tags and confirmed histories", async () => {
    const original = await snapshot();
    await db.exec(sql);
    assert.deepEqual(await snapshot(), original);
    assert.equal(
      (await call(a, "select public.get_item_watch($1) w", [lost.id])).rows[0].w
        .enabled,
      true,
    );
    assert.equal(
      (
        await call(b, "select public.list_recovery_confirmations($1) r", [
          lost.id,
        ])
      ).rows[0].r[0].state,
      "confirmed",
    );
    assert.ok(
      (
        await as("anon", null, "select public.resolve_object_tag($1) t", [
          token,
        ])
      ).rows[0].t,
    );
  });
  await test("item deletion cascades history without granting third-party deletion", async () => {
    const removed = await call(c, "delete from public.items where id=$1 returning id", [lost.id]);
    assert.equal(removed.rows.length, 0);
    await call(a, "delete from public.items where id=$1", [lost.id]);
    assert.equal((await db.query("select count(*)::int n from buscag_private.recovery_confirmations where item_id=$1", [lost.id])).rows[0].n, 0);
  });
  await test("account deletion anonymizes pending/confirmed history without weakening authorization", async () => {
    // Roll back dedicated synthetic identities and deletion to preserve other matrix checks.
    await db.exec('begin');
    try {
      const owner='90000000-0000-4000-8000-000000000001';
      const partner='90000000-0000-4000-8000-000000000002';
      await db.query("insert into auth.users(id) values($1),($2)", [owner,partner]);
      const item=(await db.query("insert into public.items(owner_id,title,description,category,status,location_name,lat,lng,date,image_url) values($1,'Synthetic','Synthetic','Otros','recuperado','Synthetic',0,0,'2026-11-05','https://images.invalid/a.png') returning id", [owner])).rows[0].id;
      const history=(await db.query("insert into buscag_private.recovery_confirmations(item_id,owner_id,partner_id,state) values($1,$2,$3,'confirmed'),($1,$2,$3,'pending'),($1,$2,$3,'cancelled') returning id,state", [item,owner,partner])).rows;
      await db.query('delete from auth.users where id=$1',[partner]);
      assert.equal((await db.query('select count(*)::int n from buscag_private.recovery_confirmations where item_id=$1 and partner_id is null',[item])).rows[0].n,3);
      await db.exec('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[c]);
      const pending=history.find(r=>r.state==='pending').id;
      await db.exec('savepoint denied_foreign');
      await assert.rejects(db.query('select public.resolve_item_recovery($1,false)',[pending]),e=>e.code==='42501');
      await db.exec('rollback to savepoint denied_foreign');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
      await db.exec('savepoint reopen');
      await assert.rejects(db.query("update public.items set status='perdido' where id=$1",[item]),e=>e.code==='42501');
      await db.exec('rollback to savepoint reopen');
      assert.equal((await db.query('select public.resolve_item_recovery($1,false) s',[pending])).rows[0].s,'cancelled');
      await db.exec('reset role');
      // An item without an owner simulates another legitimate ownership path;
      // deleting the referenced account must still NULL its history reference.
      const cascaded=(await db.query("insert into public.items(owner_id,title,description,category,status,location_name,lat,lng,date,image_url) values($1,'Synthetic','Synthetic','Otros','perdido','Synthetic',0,0,'2026-11-05','https://images.invalid/a.png') returning id", [owner])).rows[0].id;
      await db.query("insert into buscag_private.recovery_confirmations(item_id,owner_id,partner_id,state) values($1,$2,$3,'cancelled')",[cascaded,owner,c]);
      await db.query('update public.items set owner_id=null where id=$1',[item]);
      const orphan=(await db.query("insert into buscag_private.recovery_confirmations(item_id,owner_id,partner_id,state) values($1,$2,$3,'pending') returning id",[item,owner,c])).rows[0].id;
      await db.query('delete from auth.users where id=$1',[owner]);
      assert.equal((await db.query('select count(*)::int n from buscag_private.recovery_confirmations where item_id=$1 and owner_id is null and partner_id is null',[item])).rows[0].n,3);
      assert.equal((await db.query('select count(*)::int n from public.items where id=$1',[cascaded])).rows[0].n,0);
      assert.equal((await db.query('select count(*)::int n from buscag_private.recovery_confirmations where item_id=$1',[cascaded])).rows[0].n,0);
      await db.exec('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[c]);
      await db.exec('savepoint missing_owner');
      await assert.rejects(db.query('select public.resolve_item_recovery($1,true)',[orphan]),e=>e.code==='22023');
      await db.exec('rollback to savepoint missing_owner');
      assert.equal((await db.query('select public.resolve_item_recovery($1,false) s',[orphan])).rows[0].s,'cancelled');
      await db.exec('savepoint both_deleted');
      await assert.rejects(db.query('select public.resolve_item_recovery($1,false)',[pending]),e=>e.code==='42501');
      await db.exec('rollback to savepoint both_deleted');
      await db.exec('reset role');
      await db.query('delete from public.items where id=$1',[item]);
      assert.equal((await db.query('select count(*)::int n from buscag_private.recovery_confirmations where item_id=$1',[item])).rows[0].n,0);
    } finally { await db.exec('rollback'); }
  });
  console.log(
    `PASS: ${checks} school feature integration/security groups; repeatable SQL, isolated database only`,
  );
}
