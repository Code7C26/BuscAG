// Offline policy regression tests. All SQL runs in an ephemeral WASM PostgreSQL.
// No connection string, project URL, real credentials or production rows are used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.LOCAL_PG_SOCKET ? './postgresAdapter.mjs' : process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
let passed = 0;
const ids = Object.fromEntries(['a', 'b', 'c', 'd'].map((key, i) =>
  [key, `00000000-0000-4000-8000-00000000000${i + 1}`]));
const itemB = '10000000-0000-4000-8000-000000000001';
const itemC = '10000000-0000-4000-8000-000000000002';
const itemA = '10000000-0000-4000-8000-000000000003';
const message = '20000000-0000-4000-8000-000000000001';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const check = (name, fn) => async () => { await fn(); passed++; console.log(`ok ${passed} - ${name}`); };
async function as(role, uid, sql) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid || '']);
    return await db.query(sql);
  } finally { await db.exec('rollback'); }
}
async function denied(role, uid, sql) {
  await assert.rejects(as(role, uid, sql), error => error.code === '42501');
}
const send = (sender, recipient, item) => `insert into public.messages
  (item_id,sender_id,recipient_id,sender_name,item_title,text)
  values ('${item}','${sender}','${recipient}','FORGED','FORGED','Synthetic message') returning *`;
try {
  await check('single-query production diagnostic tolerates a missing application schema/history', async () => {
    const rows = await db.query(await read('../supabase/audit/production_diagnostic.sql'));
    const report = JSON.parse(rows.rows[0].diagnostic);
    assert.equal(report['01_context'].migration_history_exists, false);
    assert.ok(report['02_inventory'].every(x => !x.exists_in_public));
  })();
  await db.exec(`
    do $$ begin
      if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
    end; $$;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    create function storage.foldername(text) returns text[] language sql immutable as
      $$ select string_to_array($1, '/') $$;
    create publication supabase_realtime;
  `);
  for (const file of ['20261014000000_dynamic_database.sql', '20261015000000_push_notifications.sql', '20261016000000_notification_permissions.sql']) {
    // PGlite has built-in gen_random_uuid(); its pgcrypto extension is not needed.
    await db.exec((await read(`../supabase/migrations/${file}`))
      .replace('create extension if not exists pgcrypto;', ''));
  }
  // Model Supabase default grants plus observed drift and old column ACLs.
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to anon, authenticated;
    grant update (rating) on public.profiles to public, authenticated;
    grant update (contact_count) on public.items to authenticated;
    create policy legacy_anonymous_insert on public.items for insert to anon with check (true);
    insert into auth.users (id, raw_user_meta_data) values
      ('${ids.a}', '{"full_name":"User A","phone":"private-a","location":"private-a"}'),
      ('${ids.b}', '{"full_name":"User B","phone":"private-b","location":"private-b"}'),
      ('${ids.c}', '{"full_name":"User C","phone":"private-c","location":"private-c"}');
    insert into public.items (id,owner_id,title,description,category,location_name,lat,lng) values
      ('${itemB}','${ids.b}','Item B','Synthetic','Otros','Synthetic',0,0),
      ('${itemC}','${ids.c}','Item C','Synthetic','Otros','Synthetic',0,0),
      ('${itemA}','${ids.a}','Item A','Synthetic','Otros','Synthetic',0,0),
      ('10000000-0000-4000-8000-000000000004',null,'Legacy','Synthetic','Otros','Synthetic',0,0);
    insert into public.messages (id,item_id,sender_id,recipient_id,sender_name,item_title,text)
      values ('${message}','${itemB}','${ids.a}','${ids.b}','User A','Item B','Synthetic');
  `);
  await check('baseline reproduces the anonymous INSERT vulnerability', async () => {
    await as('anon', null, `insert into public.items (title,description,category,location_name,lat,lng)
      values ('Synthetic','Synthetic','Otros','Synthetic',0,0)`);
  })();
  await check('baseline detects recursive message INSERT policy expansion', async () => {
    await assert.rejects(as('authenticated', ids.a, send(ids.a, ids.c, itemB)), error => error.code === '42P17');
  })();
  // Match the reported missing push table, despite its presence in old migrations.
  await db.exec('drop table public.push_subscriptions');
  const snapshot = async () => (await db.query(`select
    (select jsonb_agg(to_jsonb(p) order by id) from public.profiles p) as profiles,
    (select jsonb_agg(to_jsonb(i) order by id) from public.items i) as items,
    (select jsonb_agg(to_jsonb(m) order by id) from public.messages m) as messages,
    (select jsonb_agg(to_jsonb(n) order by id) from public.notifications n) as notifications`)).rows;
  const before = await snapshot();
  for (const file of ['20261103000000_secure_items_messages.sql', '20261103001000_private_profiles_public_directory.sql',
    '20261103002000_secure_notifications.sql', '20261103003000_ensure_private_push_subscriptions.sql']) {
    await db.exec(await read(`../supabase/migrations/${file}`));
  }
  await check('migrations preserve every existing application row, including legacy owners', async () => {
    assert.deepEqual(await snapshot(), before);
  })();
  for (const table of ['items', 'profiles', 'messages', 'notifications', 'push_subscriptions']) {
    await check(`${table}: RLS enabled and anonymous reads denied`, async () => {
      assert.equal((await db.query(`select relrowsecurity from pg_class where oid='public.${table}'::regclass`)).rows[0].relrowsecurity, true);
      await denied('anon', null, `select * from public.${table}`);
    })();
  }
  await check('anonymous publication INSERT is denied', () => denied('anon', null,
    `insert into public.items (title,description,category,location_name,lat,lng) values ('X','X','Otros','X',0,0)`))();
  await check('authenticated publication INSERT succeeds with server-owned defaults', async () => {
    const result = await as('authenticated', ids.a, `insert into public.items
      (owner_id,title,description,category,location_name,lat,lng)
      values ('${ids.a}','X','X','Otros','X',0,0) returning *`);
    assert.equal(result.rows[0].contact_count, 0);
  })();
  await check('cannot publish as another owner', () => denied('authenticated', ids.a,
    `insert into public.items (owner_id,title,description,category,location_name,lat,lng)
      values ('${ids.b}','X','X','Otros','X',0,0)`))();
  await check('cannot seed or update contact_count', async () => {
    await denied('authenticated', ids.a, `update public.items set contact_count=900 where id='${itemA}'`);
    await denied('authenticated', ids.a, `insert into public.items (owner_id,title,description,category,location_name,lat,lng,contact_count)
      values ('${ids.a}','X','X','Otros','X',0,0,900)`);
  })();
  await check('owner can edit/delete their item but not another item', async () => {
    assert.equal((await as('authenticated', ids.a, `update public.items set title='New' where id='${itemA}' returning id`)).rows.length, 1);
    assert.equal((await as('authenticated', ids.a, `delete from public.items where id='${itemA}' returning id`)).rows.length, 1);
    assert.equal((await as('authenticated', ids.a, `update public.items set title='New' where id='${itemB}' returning id`)).rows.length, 0);
    assert.equal((await as('authenticated', ids.a, `delete from public.items where id='${itemB}' returning id`)).rows.length, 0);
  })();
  await check('private profile table returns self only; public directory preserves identities', async () => {
    assert.equal((await as('authenticated', ids.a, 'select * from public.profiles')).rows.length, 1);
    const rows = (await as('authenticated', ids.a, 'select * from public.public_profiles')).rows;
    assert.equal(rows.length, 3);
    assert.equal(rows.find(p => p.id === ids.c).full_name, 'User C');
    assert.equal(rows.find(p => p.id === ids.c).phone, '');
    assert.equal(rows.find(p => p.id === ids.c).location, '');
    assert.equal(rows.find(p => p.id === ids.b).phone, '');
    assert.equal(rows.find(p => p.id === ids.a).location, 'private-a');
    await denied('anon', null, 'select * from public.public_profiles');
  })();
  await check('profile fallback upsert works without granting rating changes', async () => {
    await as('authenticated', ids.a, `insert into public.profiles (id,full_name,avatar_url,phone,location)
      values ('${ids.a}','User A','','synthetic','synthetic') on conflict(id) do update
      set id=excluded.id,full_name=excluded.full_name,avatar_url=excluded.avatar_url,phone=excluded.phone,location=excluded.location returning *`);
    await denied('authenticated', ids.a, `update public.profiles set rating=9 where id='${ids.a}'`);
    await denied('authenticated', ids.d, `insert into public.profiles (id,rating) values ('${ids.d}',9)`);
  })();
  await check('signup trigger still creates a private profile', async () => {
    await db.exec('begin');
    try {
      await db.exec(`insert into auth.users (id,raw_user_meta_data) values ('${ids.d}','{"full_name":"User D"}')`);
      assert.equal((await db.query(`select full_name from public.profiles where id='${ids.d}'`)).rows[0].full_name, 'User D');
    } finally { await db.exec('rollback'); }
  })();
  await check('first contact and owner reply succeed; spoofed display values are replaced', async () => {
    const row = (await as('authenticated', ids.a, send(ids.a, ids.c, itemC))).rows[0];
    assert.equal(row.sender_name, 'User A');
    assert.equal(row.item_title, 'Item C');
    await as('authenticated', ids.b, send(ids.b, ids.a, itemB));
  })();
  await check('private contact requires reciprocal messages on the same item', async () => {
    await db.exec('begin');
    try {
      await db.exec('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [ids.b]);
      await db.query(send(ids.b, ids.a, itemA));
      assert.equal((await db.query(`select phone from public.public_profiles where id='${ids.a}'`)).rows[0].phone, '');
      await db.query(send(ids.b, ids.a, itemB));
      assert.equal((await db.query(`select phone from public.public_profiles where id='${ids.a}'`)).rows[0].phone, 'private-a');
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [ids.a]);
      assert.equal((await db.query(`select phone from public.public_profiles where id='${ids.b}'`)).rows[0].phone, 'private-b');
      assert.equal((await db.query(`select phone from public.public_profiles where id='${ids.c}'`)).rows[0].phone, '');
    } finally { await db.exec('rollback'); }
  })();
  await check('unrelated recipient/item and impersonation are denied after a prior conversation', async () => {
    await denied('authenticated', ids.a, send(ids.a, ids.c, itemB));
    await denied('authenticated', ids.b, send(ids.b, ids.a, itemC));
    await denied('authenticated', ids.a, send(ids.b, ids.a, itemB));
  })();
  await check('messages readable only by participants; only recipient updates is_read', async () => {
    assert.equal((await as('authenticated', ids.c, 'select * from public.messages')).rows.length, 0);
    assert.equal((await as('authenticated', ids.b, `update public.messages set is_read=true where id='${message}' returning id`)).rows.length, 1);
    assert.equal((await as('authenticated', ids.a, `update public.messages set is_read=true where id='${message}' returning id`)).rows.length, 0);
    await denied('authenticated', ids.b, `update public.messages set text='Changed' where id='${message}'`);
  })();
  await check('message trigger still creates a notification and increments the server counter', async () => {
    await db.exec('begin');
    try {
      await db.exec('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [ids.a]);
      await db.query(send(ids.a, ids.c, itemC));
      assert.equal((await db.query(`select contact_count from public.items where id='${itemC}'`)).rows[0].contact_count, 1);
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [ids.c]);
      assert.equal((await db.query("select * from public.notifications where type='message'")).rows.length, 1);
    } finally { await db.exec('rollback'); }
  })();
  await check('notifications permit own match notices, deny forged system/other-user notices', async () => {
    const notice = (user, type) => `insert into public.notifications (user_id,title,message,type)
      values ('${user}','Synthetic','Synthetic','${type}') returning id`;
    await as('authenticated', ids.a, notice(ids.a, 'match'));
    await denied('authenticated', ids.a, notice(ids.b, 'match'));
    await denied('authenticated', ids.a, notice(ids.a, 'system'));
    assert.equal((await as('authenticated', ids.a, 'select * from public.notifications')).rows.length, 0);
    assert.equal((await as('authenticated', ids.b, 'update public.notifications set is_read=true returning id')).rows.length, 1);
    await denied('authenticated', ids.b, "update public.notifications set title='Changed'");
  })();
  await check('recovering an owned item still generates its trusted notification', async () => {
    await db.exec('begin');
    try {
      await db.exec('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [ids.a]);
      await db.query(`update public.items set status='recuperado' where id='${itemA}'`);
      assert.equal((await db.query("select * from public.notifications where type='recovered'")).rows.length, 1);
    } finally { await db.exec('rollback'); }
  })();
  await db.exec(`insert into public.push_subscriptions (user_id,endpoint,p256dh,auth)
    values ('${ids.a}','https://push.invalid/synthetic','synthetic','synthetic')`);
  await check('push migration also preserves subscriptions when the table already exists', async () => {
    await db.exec(await read('../supabase/migrations/20261103003000_ensure_private_push_subscriptions.sql'));
    assert.equal((await db.query('select count(*)::int as n from public.push_subscriptions')).rows[0].n, 1);
  })();
  await check('preflight metadata queries are valid', async () => {
    await db.exec(await read('../supabase/audit/security_preflight.sql'));
    await db.query(await read('../supabase/audit/production_diagnostic.sql'));
  })();
  await check('push owner can read/upsert/delete; other users cannot read or hijack the endpoint', async () => {
    assert.equal((await as('authenticated', ids.a, 'select * from public.push_subscriptions')).rows.length, 1);
    assert.equal((await as('authenticated', ids.b, 'select * from public.push_subscriptions')).rows.length, 0);
    const upsert = uid => `insert into public.push_subscriptions (user_id,endpoint,p256dh,auth)
      values ('${uid}','https://push.invalid/synthetic','updated','updated') on conflict(endpoint) do update
      set user_id=excluded.user_id,endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth=excluded.auth returning id`;
    await as('authenticated', ids.a, upsert(ids.a));
    await denied('authenticated', ids.b, upsert(ids.b));
    assert.equal((await as('authenticated', ids.a, 'delete from public.push_subscriptions returning id')).rows.length, 1);
    assert.equal((await as('service_role', null, 'select endpoint,p256dh,auth from public.push_subscriptions')).rows.length, 1);
  })();
  await check('candidate preflight fails closed for disabled RLS or unknown mandatory columns',async()=>{
    for(const [drift,expected] of [
      ['alter table public.messages disable row level security',/RLS must be enabled/],
      ["alter table public.messages add column unexpected_required text not null default 'synthetic';alter table public.messages alter column unexpected_required drop default",/Unexpected required message columns/]
    ]) {
      await db.exec('begin');
      try {await db.exec(drift);await assert.rejects(db.exec(await read('../supabase/proposals/20261104000000_message_receipts.sql')),expected);}
      finally {await db.exec('rollback');}
    }
  })();
  const beforeReceipts = await snapshot();
  await db.exec(await read('../supabase/proposals/20261104000000_message_receipts.sql'));
  await check('message RPC installation preserves all existing application rows',async()=>{
    assert.deepEqual(await snapshot(),beforeReceipts);
  })();
  const rpc=(key='30000000-0000-4000-8000-000000000001',body='RPC synthetic',recipient=ids.b,item=itemB)=>
    `select * from public.send_message_once('${key}','${item}','${recipient}','${body}')`;
  await check('RPC requires authentication; direct INSERT and private receipts are inaccessible',async()=>{
    await denied('anon',null,rpc());
    await denied('authenticated',ids.a,send(ids.a,ids.b,itemB));
    await denied('authenticated',ids.a,'select * from buscag_private.message_receipts');
    await denied('authenticated',ids.a,rpc(undefined,undefined,ids.c));
  })();
  await check('same request returns one message, one notification and one counter increment',async()=>{
    await db.exec('begin');
    try {
      await db.exec('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.a]);
      const first=(await db.query(rpc())).rows[0];
      assert.equal(first.sender_name,'User A');
      assert.equal((await db.query(rpc())).rows[0].id,first.id);
      await db.exec('reset role');
      assert.equal((await db.query(`select count(*)::int n from public.notifications where type='message' and related_item_id='${itemB}'`)).rows[0].n,2);
      assert.equal((await db.query(`select contact_count from public.items where id='${itemB}'`)).rows[0].contact_count,2);
    } finally {await db.exec('rollback');}
  })();
  await check('request key collision with changed payload rejects atomically',async()=>{
    await db.exec('begin');
    try {
      await db.exec('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.a]);
      await db.query(rpc());
      await assert.rejects(db.query(rpc(undefined,'Different')),e=>e.code==='22023');
    }finally {await db.exec('rollback');}
  })();
  await check('empty/oversized messages are rejected without receipts',async()=>{
    await assert.rejects(as('authenticated',ids.a,rpc(undefined,'   ')),e=>e.code==='22023');
    await assert.rejects(as('authenticated',ids.a,rpc(undefined,'x'.repeat(4001))),e=>e.code==='22023');
  })();
  await check('rate limit blocks new requests but permits retries of accepted requests',async()=>{
    await db.exec('begin');
    try {
      await db.exec('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.a]);
      const original=(await db.query(rpc())).rows[0];
      await db.exec('reset role');
      await db.query(`insert into buscag_private.message_receipts(actor_id,request_key,request_hash,message_id)
        select '${ids.a}',gen_random_uuid(),'synthetic','${original.id}' from generate_series(1,119)`);
      await db.exec('set local role authenticated');
      assert.equal((await db.query(rpc())).rows[0].id,original.id);
      await assert.rejects(db.query(rpc('30000000-0000-4000-8000-000000000002')),e=>e.message==='message_rate_limited');
    }finally {await db.exec('rollback');}
  })();
  const beforeMatches=await snapshot();
  await db.exec(await read('../supabase/proposals/20261104001000_trusted_matches.sql'));
  await check('match installation preserves data and does not backfill or enqueue old publications',async()=>{
    assert.deepEqual(await snapshot(),beforeMatches);
    assert.equal((await db.query('select count(*)::int n from buscag_private.match_jobs')).rows[0].n,0);
  })();
  await check('only backend can process matches; clients cannot forge match notices or access private queue',async()=>{
    await denied('authenticated',ids.a,'select public.process_match_jobs(5)');
    await denied('anon',null,'select public.process_match_jobs(5)');
    await denied('authenticated',ids.a,`insert into public.notifications(user_id,title,message,type) values('${ids.a}','Fake','Fake','match')`);
    await denied('authenticated',ids.a,'select * from buscag_private.match_jobs');
    assert.equal((await as('authenticated',ids.a,'select * from public.buscag_capabilities()')).rows[0].queued_match_notifications,true);
  })();
  const lost='40000000-0000-4000-8000-000000000001';
  const foundItem='40000000-0000-4000-8000-000000000002';
  await db.query(`insert into public.items(id,owner_id,title,description,category,status,location_name,lat,lng,date)
    values('${lost}','${ids.a}','Mochila AZUL Nike','Mochila azul nike','Otros','perdido','Synthetic',0,0,'2026-11-01T12:00:00Z'),
    ('${foundItem}','${ids.b}','Mochila azul Nike','Mochila azul nike','Otros','encontrado','Synthetic',0,0,'2026-11-01T13:00:00Z')`);
  await check('trusted worker notifies both owners exactly once even when both items are queued',async()=>{
    assert.equal((await as('service_role',null,'select public.process_match_jobs(5) result')).rows[0].result.notifications,2);
    await db.query('select public.process_match_jobs(5)');
    assert.equal((await db.query('select count(*)::int n from buscag_private.match_notices')).rows[0].n,2);
    const rows=(await db.query(`select user_id,related_item_id from public.notifications where type='match' order by user_id`)).rows;
    assert.deepEqual(rows,[{user_id:ids.a,related_item_id:foundItem},{user_id:ids.b,related_item_id:lost}]);
    await db.query(`update public.items set description='Mochila azul NIKE actualizada' where id='${lost}'`);
    await db.query('select public.process_match_jobs(5)');
    assert.equal((await db.query('select count(*)::int n from buscag_private.match_notices')).rows[0].n,2);
  })();
  await check('counter/read-only edits do not enqueue work, recovered items skip matching',async()=>{
    await db.query(`update public.items set contact_count=contact_count+1 where id='${lost}'`);
    assert.equal((await db.query('select count(*)::int n from buscag_private.match_jobs')).rows[0].n,0);
    await db.query(`update public.items set status='recuperado' where id='${lost}'`);
    assert.equal((await db.query('select public.process_match_jobs(5) result')).rows[0].result.notifications,0);
  })();
  await check('matching excludes invalid coordinates, same owner, weak text and incompatible dates',async()=>{
    const score=async(extra)=> (await db.query(`select buscag_private.match_score(
      jsonb_populate_record(null::public.items,(select to_jsonb(i) from public.items i where id='${lost}')||'{"status":"perdido"}'),
      jsonb_populate_record(null::public.items,(select to_jsonb(i) from public.items i where id='${foundItem}')||$1::jsonb)) score`,[JSON.stringify(extra)])).rows[0].score;
    assert.equal(await score({}),100);
    for(const extra of [{lat:91},{lng:181},{lat:null},{owner_id:ids.a},{owner_id:null},{title:'Keys',description:'Different'},{date:'2026-10-29T00:00:00Z'}]) assert.equal(await score(extra),null);
  })();
  await check('keywords normalize accents and repeated words without inflating scores',async()=>{
    const row=(await db.query("select buscag_private.match_words('Mochíla AZÚL azul en la calle') words")).rows[0];
    assert.deepEqual(row.words.sort(),['azul','mochila']);
  })();
  await check('large candidate sets resume after 200 rows and still deliver the final match',async()=>{
    await db.exec('begin');
    try {
      await db.query(`update public.items set status='perdido' where id='${lost}'`);
      await db.query(`insert into public.items(id,owner_id,title,description,category,status,location_name,lat,lng,date)
        select ('60000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${ids.b}',
          case when n=205 then 'Mochila azul Nike' else 'Different object' end,'Synthetic','Otros','encontrado','Synthetic',0,0,'2026-11-01T13:00:00Z'
        from generate_series(1,205) n`);
      await db.query('select public.process_match_jobs(1)');
      assert.ok((await db.query(`select after_id from buscag_private.match_jobs where item_id='${lost}'`)).rows[0].after_id);
      assert.equal((await db.query('select public.process_match_jobs(1) result')).rows[0].result.notifications,2);
      assert.equal((await db.query(`select count(*)::int n from buscag_private.match_jobs where item_id='${lost}'`)).rows[0].n,0);
    }finally {await db.exec('rollback');}
  })();
  await check('a failed match batch rolls back its notices, backs off and lets other jobs progress',async()=>{
    await db.exec('begin');
    try {
      await db.query(`update public.items set status='perdido' where id='${lost}'`);
      await db.query(`insert into public.items(id,owner_id,title,description,category,status,location_name,lat,lng,date)
        values('70000000-0000-4000-8000-000000000001','${ids.c}','Mochila azul Nike','Synthetic','Otros','encontrado','Synthetic',0,0,'2026-11-01T13:00:00Z')`);
      await db.exec(`create function public.synthetic_failure() returns trigger language plpgsql as $$begin raise exception 'synthetic private detail';end;$$;
        create trigger synthetic_failure before insert on public.notifications for each row execute function public.synthetic_failure()`);
      const noticesBefore=(await db.query('select count(*)::int n from public.notifications')).rows[0].n;
      const result=(await db.query('select public.process_match_jobs(1) result')).rows[0].result;
      assert.equal(result.failures,1);assert.equal(result.notifications,0);
      const job=(await db.query(`select attempts,last_error_code,next_attempt_at>now() deferred from buscag_private.match_jobs where item_id='${lost}'`)).rows[0];
      assert.deepEqual(job,{attempts:1,last_error_code:'P0001',deferred:true});
      assert.equal((await db.query('select count(*)::int n from public.notifications')).rows[0].n,noticesBefore);
      assert.equal((await db.query('select count(*)::int n from buscag_private.match_notices')).rows[0].n,2);
      await db.exec('drop trigger synthetic_failure on public.notifications');
      const next=(await db.query('select public.process_match_jobs(1) result')).rows[0].result;
      assert.equal(next.failures,0);assert.equal(next.notifications,2);
    }finally {await db.exec('rollback');}
  })();
  if (db.fork) await check('native PostgreSQL concurrent retries commit one message and one receipt',async()=>{
    const clients=await Promise.all([db.fork(),db.fork()]);
    const key='50000000-0000-4000-8000-000000000001';
    try {
      const results=await Promise.all(clients.map(async client=>{
        await client.query('begin');
        try {
          await client.query('set local role authenticated');
          await client.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.a]);
          const result=await client.query(rpc(key,'Parallel synthetic'));
          await client.query('commit');return result.rows[0].id;
        }catch(error){await client.query('rollback');throw error;}
      }));
      assert.equal(results[0],results[1]);
      assert.equal((await db.query('select count(*)::int n from buscag_private.message_receipts where request_key=$1',[key])).rows[0].n,1);
      assert.equal((await db.query("select count(*)::int n from public.messages where text='Parallel synthetic'")).rows[0].n,1);
    }finally {await Promise.all(clients.map(client=>client.end()));}
  })();
  if (db.fork) await check('native PostgreSQL simultaneous workers never duplicate pair notifications',async()=>{
    await db.query(`insert into public.items(id,owner_id,title,description,category,status,location_name,lat,lng,date)
      values('80000000-0000-4000-8000-000000000001','${ids.a}','Wallet brown leather','Wallet brown leather','Otros','perdido','Synthetic',0,0,'2026-11-01T12:00:00Z'),
      ('80000000-0000-4000-8000-000000000002','${ids.b}','Wallet brown leather','Wallet brown leather','Otros','encontrado','Synthetic',0,0,'2026-11-01T13:00:00Z')`);
    const clients=await Promise.all([db.fork(),db.fork()]);
    try {
      const results=await Promise.all(clients.map(async client=>{
        await client.query('begin');
        try {
          await client.query('set local role service_role');
          const result=(await client.query('select public.process_match_jobs(5) result')).rows[0].result;
          await client.query('commit');return result;
        }catch(error){await client.query('rollback');throw error;}
      }));
      assert.equal(results.reduce((sum,r)=>sum+r.notifications,0),2);
      assert.equal((await db.query("select count(*)::int n from buscag_private.match_notices where lost_id='80000000-0000-4000-8000-000000000001'")).rows[0].n,2);
    }finally {await Promise.all(clients.map(client=>client.end()));}
  })();
  console.log(`PASS: ${passed} offline PostgreSQL security checks`);
} catch (error) {
  console.error('FAIL', error.code || error.name, error.message);
  if (error.query) console.error(error.query);
  process.exitCode = 1;
} finally { await db.close(); }
