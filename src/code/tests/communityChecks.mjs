import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
export async function communityChecks(db, [a, b, c]) {
  const sql = await readFile(
    new URL(
      "../supabase/proposals/20261106001000_community_safety.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const before = (
    await db.query("select id,phone,rating from public.profiles order by id")
  ).rows;
  await db.exec("grant update on public.profiles to authenticated");
  await assert.rejects(db.exec(sql), (e) =>
    e.message.includes("Security baseline drift"),
  );
  await db.exec("rollback");
  await db.exec(
    "revoke update on public.profiles from authenticated;grant update(id,full_name,avatar_url,phone,location) on public.profiles to authenticated",
  );
  await db.exec(sql);
  await db.exec(sql);
  await db.exec(
    await readFile(
      new URL("../supabase/audit/community_readiness.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    (await db.query("select id,phone,rating from public.profiles order by id"))
      .rows,
    before,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.profiles where phone_shared",
      )
    ).rows[0].n,
    0,
  );
  let checks = 1;
  const test = async (name, fn) => {
    await fn();
    console.log(`community ${++checks}: ${name}`);
  };
  async function call(
    uid,
    query,
    args = [],
    role = "authenticated",
    conn = db,
  ) {
    await conn.query("begin");
    try {
      await conn.query("set local role " + role);
      await conn.query("select set_config('request.jwt.claim.sub',$1,true)", [
        uid || "",
      ]);
      const result = await conn.query(query, args);
      await conn.query("commit");
      return result;
    } catch (e) {
      await conn.query("rollback");
      throw e;
    }
  }
  const rpc = async (uid, name, args = []) =>
    (
      await call(
        uid,
        `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) value`,
        args,
      )
    ).rows[0].value;
  const denied = (p) => assert.rejects(p, (e) => e.code === "42501");
  const item = (
    await call(
      a,
      "select * from public.publish_item_once(gen_random_uuid(),$1)",
      [
        JSON.stringify({
          title: "Ensayo integral zafiro",
          description: "Objetos sintéticos para pruebas",
          category: "Otros",
          status: "perdido",
          lat: 0,
          lng: 0,
          location_name: "Ensayo",
          date: "2026-11-06",
          image_url: "https://images.invalid/test.png",
        }),
      ],
    )
  ).rows[0];
  const send = (sender, recipient, text = "Mensaje sintético") =>
    rpc(sender, "send_message_once", [
      crypto.randomUUID(),
      item.id,
      recipient,
      text,
    ]);
  await send(b, a);
  await send(a, b);
  const phone = async (uid, target) =>
    (
      await call(uid, "select phone from public.public_profiles where id=$1", [
        target,
      ])
    ).rows[0].phone;
  await test("phone consent is false for existing users, validation is server-side and reciprocal chat is insufficient", async () => {
    await rpc(a, "save_my_profile", [
      "Usuario A",
      "",
      "+5491123456789",
      false,
      "Zona privada",
    ]);
    assert.equal(await phone(b, a), "");
    assert.equal(await phone(c, a), "");
    await assert.rejects(
      rpc(a, "save_my_profile", ["Usuario A", "", "123", true, ""]),
      (e) => e.code === "22023",
    );
    await rpc(a, "save_my_profile", [
      "Usuario A",
      "",
      "+5491123456789",
      true,
      "Zona privada",
    ]);
    assert.equal(await phone(b, a), "+5491123456789");
    assert.equal(await phone(c, a), "");
    assert.equal(
      (
        await call(
          b,
          "select location from public.public_profiles where id=$1",
          [a],
        )
      ).rows[0].location,
      "",
    );
    assert.equal(
      (await call(b, "select phone from public.profiles where id=$1", [a])).rows
        .length,
      0,
    );
    await denied(
      call(b, "update public.profiles set phone_shared=true where id=$1", [a]),
    );
    await db.exec(
      "create policy synthetic_legacy_profile_read on public.profiles for select to authenticated using(true);create policy synthetic_legacy_profile_update on public.profiles for update to authenticated using(true) with check(true)",
    );
    try {
      assert.equal(
        (await call(b, "select phone from public.profiles where id=$1", [a]))
          .rows.length,
        0,
      );
      assert.equal(
        (
          await call(
            b,
            "update public.profiles set phone='+5491199999999' where id=$1 returning id",
            [a],
          )
        ).rows.length,
        0,
      );
    } finally {
      await db.exec(
        "drop policy synthetic_legacy_profile_read on public.profiles;drop policy synthetic_legacy_profile_update on public.profiles",
      );
    }
  });
  await test("blocks are private, idempotent and enforce both directions including hidden phone", async () => {
    assert.equal(await rpc(a, "set_user_block", [b, true]), true);
    await rpc(a, "set_user_block", [b, true]);
    assert.equal((await rpc(a, "list_my_blocks")).length, 1);
    assert.deepEqual(await rpc(b, "list_my_blocks"), []);
    await denied(send(b, a));
    await denied(send(a, b));
    assert.equal(await phone(b, a), "");
    assert.equal(
      (
        await call(b, "select id from public.messages where item_id=$1", [
          item.id,
        ])
      ).rows.length,
      2,
    );
    await rpc(a, "set_user_block", [b, false]);
    await send(b, a);
  });
  let report;
  await test("reports deduplicate, remain private and never remove a publication", async () => {
    report = await rpc(b, "submit_report", [
      "item",
      item.id,
      "spam",
      "Descripción opcional",
    ]);
    assert.equal(
      await rpc(b, "submit_report", [
        "item",
        item.id,
        "spam",
        "Otra descripción",
      ]),
      report,
    );
    assert.equal(
      (await rpc(b, "list_reports")).filter((r) => r.id === report).length,
      1,
    );
    assert.deepEqual(await rpc(c, "list_reports"), []);
    await denied(rpc(a, "submit_report", ["item", item.id, "spam", ""]));
    await denied(call(c, "select * from buscag_private.reports"));
    assert.equal(
      (
        await db.query("select count(*)::int n from public.items where id=$1", [
          item.id,
        ])
      ).rows[0].n,
      1,
    );
  });
  await test("only explicitly enrolled moderators can review and their actions are audited once", async () => {
    await denied(rpc(c, "moderate_report", [report, "resolved", "Nota"]));
    await denied(
      call(c, "insert into buscag_private.moderators(user_id) values($1)", [c]),
    );
    await db.query(
      "insert into buscag_private.moderators(user_id) values($1)",
      [c],
    );
    assert.equal(
      await rpc(c, "moderate_report", [
        report,
        "reviewing",
        "Revisión sintética",
      ]),
      "reviewing",
    );
    await rpc(c, "moderate_report", [report, "reviewing", "Reintento"]);
    assert.equal((await rpc(c, "report_audit", [report])).length, 1);
    assert.deepEqual(await rpc(b, "report_audit", [report]), []);
  });
  await test("following deduplicates and status notices respect preferences and blocks", async () => {
    await rpc(b, "set_item_follow", [item.id, true, true]);
    await rpc(b, "set_item_follow", [item.id, true, true]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from buscag_private.item_followers where item_id=$1",
          [item.id],
        )
      ).rows[0].n,
      1,
    );
    const count = async () =>
      (
        await db.query(
          "select count(*)::int n from public.notifications where user_id=$1 and related_item_id=$2 and title='Novedad de una publicación'",
          [b, item.id],
        )
      ).rows[0].n;
    await call(a, "update public.items set status='encontrado' where id=$1", [
      item.id,
    ]);
    assert.equal(await count(), 1);
    await call(a, "update public.items set status='encontrado' where id=$1", [
      item.id,
    ]);
    assert.equal(await count(), 1);
    await rpc(b, "set_item_follow", [item.id, true, false]);
    await call(a, "update public.items set status='perdido' where id=$1", [
      item.id,
    ]);
    assert.equal(await count(), 1);
    await rpc(b, "set_item_follow", [item.id, false, false]);
    await rpc(b, "set_item_follow", [item.id, true, true]);
    await rpc(a, "set_user_block", [b, true]);
    assert.equal(
      await rpc(b, "set_item_follow", [item.id, false, false]),
      false,
    );
    await rpc(a, "set_user_block", [b, false]);
  });
  let independentItem;
  const request = await rpc(a, "request_item_recovery", [item.id, b]);
  await test("ratings require both confirmations and cannot be self-assigned or forged", async () => {
    await denied(rpc(a, "rate_recovery", [request, 5]));
    await denied(rpc(c, "rate_recovery", [request, 5]));
    await rpc(b, "resolve_item_recovery", [request, true]);
    const rating = await rpc(a, "rate_recovery", [request, 4]);
    assert.equal(await rpc(a, "rate_recovery", [request, 4]), rating);
    await assert.rejects(
      rpc(a, "rate_recovery", [request, 5]),
      (e) => e.code === "22023",
    );
    await denied(
      call(b, "update public.profiles set rating_count=99 where id=$1", [b]),
    );
    assert.deepEqual(
      (
        await call(
          a,
          "select rating,rating_count from public.public_profiles where id=$1",
          [b],
        )
      ).rows[0],
      { rating: "4.0", rating_count: 1 },
    );
    const ratings = await rpc(b, "received_ratings");
    assert.equal(ratings[0].id, rating);
    await rpc(b, "submit_report", [
      "rating",
      rating,
      "otro",
      "Valoración disputada",
    ]);
  });
  await test("recovered objects reject new conversations, retain existing chat and expose disputes/history", async () => {
    await denied(send(c, a));
    await send(b, a, "Conversación conservada");
    await rpc(b, "submit_report", [
      "recovery",
      request,
      "otro",
      "Problema con la devolución",
    ]);
    const context = await rpc(a, "recovery_context", [item.id]);
    assert.equal(context.requests[0].disputed, true);
    assert.equal(context.requests[0].owner_name, "Usuario A");
    assert.equal(context.requests[0].resolved_by, b);
    assert.equal(context.requests[0].my_rating, 4);
    assert.equal(context.status, "recuperado");
  });
  await test("all new private tables and RPCs deny anonymous access", async () => {
    await denied(
      call(null, "select public.my_community_settings()", [], "anon"),
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('authenticated','buscag_private.blocked(uuid,uuid)','EXECUTE') allowed",
        )
      ).rows[0].allowed,
      false,
    );
    for (const table of [
      "user_blocks",
      "moderators",
      "reports",
      "moderation_actions",
      "item_followers",
      "recovery_ratings",
    ])
      await denied(call(a, "select * from buscag_private." + table));
  });
  await test("independent recovery after a conversation is explicit, never confirms a pending handover and cannot earn a rating", async () => {
    const own = (
      await call(
        a,
        "select * from public.publish_item_once(gen_random_uuid(),$1)",
        [
          JSON.stringify({
            title: "Ensayo independiente",
            description: "Recuperación sin entrega de otra persona",
            category: "Otros",
            status: "perdido",
            lat: 0,
            lng: 0,
            location_name: "Ensayo",
            date: "2026-11-06",
            image_url: "https://images.invalid/own.png",
          }),
        ],
      )
    ).rows[0];
    independentItem = own.id;
    await rpc(b, "send_message_once", [
      crypto.randomUUID(),
      own.id,
      a,
      "Conversación previa",
    ]);
    await denied(
      rpc(c, "declare_independent_recovery", [
        own.id,
        "Encontré el objeto en mi casa sin intervención de otra persona.",
      ]),
    );
    const pending = await rpc(a, "request_item_recovery", [own.id, b]);
    await assert.rejects(
      rpc(a, "declare_independent_recovery", [
        own.id,
        "Encontré el objeto en mi casa sin intervención de otra persona.",
      ]),
      (e) => e.code === "22023",
    );
    await rpc(b, "resolve_item_recovery", [pending, false]);
    await assert.rejects(
      rpc(a, "declare_independent_recovery", [own.id, "Corto"]),
      (e) => e.code === "22023",
    );
    const reason =
      "Encontré el objeto en mi casa sin intervención de otra persona.";
    const id = await rpc(a, "declare_independent_recovery", [own.id, reason]);
    assert.equal(
      await rpc(a, "declare_independent_recovery", [own.id, reason]),
      id,
    );
    const context = await rpc(a, "recovery_context", [own.id]);
    assert.equal(context.status, "recuperado");
    assert.equal(
      context.requests.find((r) => r.id === pending).state,
      "cancelled",
    );
    assert.equal(context.requests.find((r) => r.id === id).mode, "individual");
    assert.equal(
      context.requests.find((r) => r.id === id).owner_statement,
      reason,
    );
    assert.equal(context.requests.find((r) => r.id === id).resolved_by, a);
    await denied(rpc(a, "rate_recovery", [id, 5]));
  });
  if (db.fork)
    await test("a block committing while a send is waiting prevents its insert and notification", async () => {
      const blocker = await db.fork(),
        sender = await db.fork();
      const count = (
        await db.query(
          "select count(*)::int n from public.messages where item_id=$1",
          [item.id],
        )
      ).rows[0].n;
      try {
        await blocker.query("begin");
        await blocker.query("set local role authenticated");
        await blocker.query(
          "select set_config('request.jwt.claim.sub',$1,true)",
          [a],
        );
        await blocker.query("select public.set_user_block($1,true)", [b]);
        const pending = call(
          b,
          "select public.send_message_once($1,$2,$3,$4)",
          [crypto.randomUUID(), item.id, a, "Concurrent blocked attempt"],
          "authenticated",
          sender,
        );
        pending.catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 30));
        await blocker.query("commit");
        await denied(pending);
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.messages where item_id=$1",
              [item.id],
            )
          ).rows[0].n,
          count,
        );
      } finally {
        await blocker.query("rollback");
        await blocker.end();
        await sender.end();
        await rpc(a, "set_user_block", [b, false]);
      }
    });
  if(db.fork)await test('a recovery committing before a first message prevents opening a new thread',async()=>{
    const target=(await call(a,'select * from public.publish_item_once(gen_random_uuid(),$1)',[JSON.stringify({title:'Ensayo de cierre concurrente',description:'Mensaje nuevo contra recuperación simultánea',category:'Otros',status:'perdido',lat:0,lng:0,location_name:'Ensayo',date:'2026-11-06',image_url:'https://images.invalid/race.png'})])).rows[0];
    const owner=await db.fork(),sender=await db.fork();
    try{
      await owner.query('begin');await owner.query('set local role authenticated');await owner.query("select set_config('request.jwt.claim.sub',$1,true)",[a]);
      await owner.query('select public.request_item_recovery($1,null)',[target.id]);
      const pending=call(c,'select public.send_message_once($1,$2,$3,$4)',[crypto.randomUUID(),target.id,a,'This must not create a thread'],'authenticated',sender);pending.catch(()=>{});
      await new Promise(resolve=>setTimeout(resolve,30));await owner.query('commit');await denied(pending);
      assert.equal((await db.query('select count(*)::int n from public.messages where item_id=$1',[target.id])).rows[0].n,0);
    }finally{await owner.query('rollback');await owner.end();await sender.end();}
  });
  await test("report quotas stop abuse while a replay of an existing report remains idempotent", async () => {
    for (let index = 1; index <= 11; index++) {
      const target =
        "70000000-0000-4000-8000-" + String(index).padStart(12, "0");
      await db.query("insert into auth.users(id) values($1)", [target]);
      if (index <= 10)
        await rpc(c, "submit_report", ["user", target, "spam", ""]);
      else
        await assert.rejects(
          rpc(c, "submit_report", ["user", target, "spam", ""]),
          (e) => e.code === "P0001",
        );
    }
    assert.equal(
      await rpc(b, "submit_report", ["item", item.id, "spam", ""]),
      report,
    );
  });
  await test("reapplying keeps explicit consent and ratings; deleting an item does not erase received reputation", async () => {
    const before = (
      await db.query(
        "select id,phone_shared,rating,rating_count from public.profiles order by id",
      )
    ).rows;
    await db.exec(sql);
    assert.deepEqual(
      (
        await db.query(
          "select id,phone_shared,rating,rating_count from public.profiles order by id",
        )
      ).rows,
      before,
    );
    await call(a, "delete from public.items where id=$1", [item.id]);
    const ratings = await rpc(b, "received_ratings");
    assert.equal(ratings.length, 1);
    assert.equal(ratings[0].stars, 4);
    assert.equal(
      (
        await call(b, "select rating_count from public.profiles where id=$1", [
          b,
        ])
      ).rows[0].rating_count,
      1,
    );
  });
  await test("deleting a synthetic participant anonymizes both participant references and decision attribution", async () => {
    await db.query("delete from auth.users where id=$1", [b]);
    const context = await rpc(a, "recovery_context", [independentItem]);
    const cancelled = context.requests.find((r) => r.mode === "bilateral");
    assert.equal(cancelled.partner_id, null);
    assert.equal(cancelled.resolved_by, null);
    assert.equal(cancelled.resolved_name, null);
    assert.equal(context.status, "recuperado");
  });
  console.log(
    `PASS: ${checks} community privacy/security groups (local synthetic database only)`,
  );
}
