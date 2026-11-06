import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {stagingReference} from '../scripts/staging-reference.mjs';
import {files,installStaging} from '../scripts/prepare-staging.mjs';
import {planUpgrade,upgradeBundle,upgrades,readUpgradeCatalog,fingerprint,saveUpgradeArtifacts} from '../scripts/staging-upgrade.mjs';
const {PGlite}=await import(process.env.LOCAL_PG_SOCKET?'./postgresAdapter.mjs':'@electric-sql/pglite');
const read=file=>readFile(new URL('../supabase/'+file,import.meta.url),'utf8');
const actor='d0000000-0000-4000-8000-000000000001';
const other='d0000000-0000-4000-8000-000000000002';
const item='e0000000-0000-4000-8000-000000000001';
const executable=sql=>sql.replace(/^\\set ON_ERROR_STOP on\n/m,'');
async function fixture(dateType='date'){
 const db=await stagingReference(PGlite,{dateType});
 for(const file of [...files,upgrades[0]])await db.query(await read(file));
 await db.query('set search_path=pg_catalog,public');
 return db;
}
for(const dateType of ['date','timestamptz'])test(`existing unjournaled school ${dateType}: plan, atomic upgrade, preservation and final verification`,async()=>{
 const db=await fixture(dateType);
 try{
  // Realistic pre-upgrade data. No application table is empty by assumption.
  await db.query(`insert into auth.users(id,raw_user_meta_data) values
  ('${actor}','{"full_name":"Owner","phone":"private-legacy"}'),('${other}','{"full_name":"Peer"}');
  insert into public.items(id,owner_id,title,description,category,status,location_name,lat,lng,image_url)
  values('${item}','${actor}','Existing item','Existing description','Otros','recuperado','Test',1,2,'https://example.invalid/photo');
  insert into public.messages(item_id,sender_id,recipient_id,text) values('${item}','${actor}','${other}','Existing chat');
  insert into buscag_private.recovery_confirmations(item_id,owner_id,partner_id,state,resolved_at)
  values('${item}','${actor}','${other}','confirmed',now());
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values('${actor}','https://push.invalid/synthetic','synthetic','synthetic');`);
  await db.query(`insert into buscag_private.item_watches(item_id,user_id,enabled,lat,lng,radius_km) values('${item}','${actor}',true,1,2,3);
  insert into buscag_private.alert_preferences(user_id,matches) values('${actor}',false);
  insert into buscag_private.object_tags(item_id) values('${item}');
  update buscag_private.match_control set enabled=true where singleton;
  insert into public.items(id,owner_id,title,description,category,status,location_name,lat,lng,image_url)
  values('e0000000-0000-4000-8000-000000000002','${other}','Pending item','Existing','Otros','encontrado','Test',1,2,'https://example.invalid/photo');
  insert into buscag_private.recovery_confirmations(item_id,owner_id,partner_id,state)
  values('e0000000-0000-4000-8000-000000000002','${other}','${actor}','pending');`);
  assert.equal((await db.query("select to_regclass('supabase_migrations.schema_migrations') is null missing")).rows[0].missing,true);
  const before=await db.query('select row_to_json(p) row from public.items p');
  await db.query('begin isolation level repeatable read read only');
  const plan=await planUpgrade(db);
  await db.query('rollback');
  assert.equal(plan.stage,'school',JSON.stringify(plan.comparisons));
  assert.equal(plan.backup,'not_checked');assert.equal(plan.authorization_to_apply,false);
  assert.deepEqual(plan.candidates.map(s=>s.file),upgrades.slice(1));
  assert.equal((await db.query("select to_regclass('buscag_staging_admin.applied_sql') is null missing")).rows[0].missing,true);
  await assert.rejects(installStaging(db,{apply:true}),/upgrade-plan/);
  const sql=executable(await upgradeBundle(plan));
  // No backup attestation -> no DDL or data changes.
  await assert.rejects(db.query(sql),/Verified restore/);await db.query('rollback');
  assert.equal(fingerprint(await readUpgradeCatalog(db)),plan.catalog_fingerprint);
  await db.query("select set_config('buscag.upgrade.backup_verified',$1,false)",[plan.catalog_fingerprint]);
  // Fault inside the combined transaction must restore the original school state.
  await assert.rejects(db.query(sql.replace('commit;\n-- Run','select 1/0;\ncommit;\n-- Run')),/division by zero/);
  await db.query('rollback');
  assert.equal(fingerprint(await readUpgradeCatalog(db)),plan.catalog_fingerprint);
  await assert.rejects(db.query(sql.replace('do $preserve$',"update public.profiles set full_name='tampered';\ndo $preserve$")),/Existing data changed/);
  await db.query('rollback');
  assert.equal(fingerprint(await readUpgradeCatalog(db)),plan.catalog_fingerprint);
  await db.query(sql);
  assert.deepEqual((await db.query('select row_to_json(p) row from public.items p')).rows,before.rows);
  assert.equal((await db.query('select count(*)::int n from public.messages')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.push_subscriptions')).rows[0].n,1);
  const r=(await db.query(`select * from buscag_private.recovery_confirmations where item_id='${item}'`)).rows[0];
  assert.equal(r.state,'confirmed');assert.equal(r.owner_id,actor);assert.equal(r.mode,'bilateral');assert.equal(r.resolved_by,null);
  assert.equal((await db.query("select state from buscag_private.recovery_confirmations where item_id='e0000000-0000-4000-8000-000000000002'")).rows[0].state,'pending');
  assert.equal((await db.query('select enabled from buscag_private.match_control where singleton')).rows[0].enabled,true);
  const profile=(await db.query(`select phone,phone_shared,rating_count from public.profiles where id='${actor}'`)).rows[0];
  assert.deepEqual(profile,{phone:'private-legacy',phone_shared:false,rating_count:0});
  const final=await planUpgrade(db);assert.equal(final.stage,'community',JSON.stringify(final.comparisons));
  assert.equal(final.installed_final_catalog,true);assert.deepEqual(final.candidates,[]);
  await assert.rejects(upgradeBundle(final),/No reviewed pending/);
  // API upsert compatibility retains UPDATE(id), while USING + WITH CHECK prevent
  // identity mutation. The existing grant by itself is not an exploitable bypass.
  await db.query('begin;set local role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
  await assert.rejects(db.query(`update public.profiles set id='d0000000-0000-4000-8000-000000000003' where id='${actor}'`),e=>e.code==='42501');
  await db.query('rollback');
  await db.query('begin;set local role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
  await db.query(`insert into public.profiles(id,full_name) values('${actor}','Owner updated') on conflict(id) do update set id=excluded.id,full_name=excluded.full_name`);
  await db.query('rollback');
 }finally{await db.close();}
});
test('catalog planning blocks partial installs, changed functions, view ACLs, policies, triggers and column grants',async()=>{
 const db=await fixture();try{
  const original=await planUpgrade(db);assert.equal(original.compatible_catalog,true);
  for(const mutation of [
   'alter table buscag_private.recovery_confirmations add column mode text',
   'grant select on public.public_profiles to anon',
   'grant update(rating) on public.profiles to authenticated',
   'create policy rogue_profile on public.profiles for select to authenticated using(true)',
   'alter table public.messages disable trigger on_message_created',
   "create or replace function public.school_features() returns jsonb language sql as $$select '{}'::jsonb$$",
  ]){
   await db.query('begin');await db.query(mutation);
   const plan=await planUpgrade(db);assert.equal(plan.compatible_catalog,false,mutation);
   assert.deepEqual(plan.candidates,[]);assert.ok(plan.comparisons.some(s=>s.differences.length));
   await assert.rejects(upgradeBundle(plan),/No reviewed/);await db.query('rollback');
  }
  // A reviewed plan cannot execute after an audit-to-install race.
  const sql=executable(await upgradeBundle(original));
  await db.query("select set_config('buscag.upgrade.backup_verified',$1,false)",[original.catalog_fingerprint]);
  await db.query('grant update(rating) on public.profiles to authenticated');
  await assert.rejects(db.query(sql),/Catalog changed/);await db.query('rollback');
 }finally{await db.close();}
});
test('secure recovery already present is retained and only community is proposed',async()=>{
 const db=await fixture();try{
  await db.query(await read(upgrades[1]));
  const plan=await planUpgrade(db);assert.equal(plan.stage,'secure_recovery');
  assert.deepEqual(plan.candidates.map(s=>s.file),[upgrades[2]]);
  const sql=executable(await upgradeBundle(plan));
  // mode already exists: preservation must include it, not exclude it as new.
  assert.ok(!sql.includes("-array['mode'"));
  await db.query("select set_config('buscag.upgrade.backup_verified',$1,false)",[plan.catalog_fingerprint]);
  await db.query(sql);assert.equal((await planUpgrade(db)).stage,'community');
 }finally{await db.close();}
});
test('verified nine-file baseline proposes all three feature stages atomically',async()=>{
 const db=await stagingReference(PGlite,{dateType:'date'});try{
  for(const file of files)await db.query(await read(file));
  await db.query('set search_path=pg_catalog,public');
  const plan=await planUpgrade(db);assert.equal(plan.stage,'baseline');
  assert.deepEqual(plan.candidates.map(s=>s.file),upgrades);
  await db.query("select set_config('buscag.upgrade.backup_verified',$1,false)",[plan.catalog_fingerprint]);
  await db.query(executable(await upgradeBundle(plan)));
  assert.equal((await planUpgrade(db)).stage,'community');
 }finally{await db.close();}
});
test('metadata never exports custom body, default or trigger argument literals; blocked plans erase stale install artifacts',async()=>{
 const db=await fixture();
 const path=await mkdtemp(tmpdir()+'/buscag-upgrade-artifacts-');
 const dir=pathToFileURL(path+'/');
 try{
  const marker='synthetic-private-metadata-value';
  await db.query(`create function public.unknown_custom(p text default '${marker}') returns text language sql as $$select '${marker}'::text$$;
   create trigger unknown_custom_trigger after update on public.profiles for each row execute function public.handle_new_auth_user('${marker}');`);
  const catalog=await readUpgradeCatalog(db);
  assert.equal(JSON.stringify(catalog).includes(marker),false);
  const plan=await planUpgrade(db);assert.equal(plan.compatible_catalog,false);
  await writeFile(new URL('install.review.sql',dir),'select 1; -- stale');
  await saveUpgradeArtifacts(plan,dir);
  const sql=await readFile(new URL('install.review.sql',dir),'utf8');
  assert.match(sql,/No executable SQL/);assert.ok(!sql.includes('select 1'));
  const saved=JSON.parse(await readFile(new URL('plan.json',dir),'utf8'));
  assert.ok(!('_expectedFinal' in saved));assert.equal(saved.authorization_to_apply,false);
 }finally{await db.close();await rm(path,{recursive:true,force:true});}
});
test('upgrade CLI refuses a different project before loading credentials or connecting',()=>{
 const result=spawnSync(process.execPath,['scripts/prepare-staging.mjs','--project-ref','abcdefghijklmnopqrst','--upgrade-plan'],{
  cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,BUSCAG_STAGING_DATABASE_URL:'synthetic-secret-not-a-url'},
 });
 assert.notEqual(result.status,0);assert.match(result.stderr,/exclusivamente a BuscAG Prueba/);
 assert.ok(!result.stderr.includes('synthetic-secret'));
});
