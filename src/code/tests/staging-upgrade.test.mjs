import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {stagingReference} from '../scripts/staging-reference.mjs';
import {files,installStaging} from '../scripts/prepare-staging.mjs';
import {planUpgrade,upgradeBundle,upgrades,readUpgradeCatalog,readUpgradeEvidence,fingerprint,saveUpgradeArtifacts} from '../scripts/staging-upgrade.mjs';
import {officialRegistry,verifyOfficialBytes} from '../scripts/staging-official-evidence.mjs';
import {managedWiring} from '../scripts/staging-catalog-review.mjs';
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
  const staleProof={...plan,evidence:{...plan.evidence,server_version_num:plan.evidence.server_version_num+1}};
  await assert.rejects(db.query(executable(await upgradeBundle(staleProof))),/Evidence changed/);await db.query('rollback');
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
test('official evidence permits only proved PG17, service ACL and Supabase variants; tampered metadata and dangerous catalog changes fail closed',async()=>{
 const db=await fixture('timestamptz');try{
  // Exercise the SQL collector against a harmless local event function. Upstream
  // Supabase SQL is NEVER executed: only source text and metadata are compared.
  const body='\r\nBEGIN\r\n RETURN;\r\nEND;\r\n';
  await db.query(`create schema extensions;
   create function extensions.evidence_probe() returns event_trigger language plpgsql as $$${body}$$;
   create event trigger evidence_probe on ddl_command_end when tag in ('CREATE VIEW') execute function extensions.evidence_probe();`);
  await db.query('begin read only');const collected=await readUpgradeEvidence(db);await db.query('rollback');
  assert.equal(collected.event_triggers[0].body_sha256,createHash('sha256').update(body.replaceAll('\r\n','\n')).digest('hex'));
  assert.equal(JSON.stringify(collected).includes('BEGIN'),false);
  // Default PUBLIC EXECUTE on an INVOKER event_trigger does not expose a callable
  // RPC: verify PostgreSQL's context restriction, rather than infer it from a dump.
  await db.query('grant usage on schema extensions to authenticated;begin;set local role authenticated');
  await assert.rejects(db.query('select extensions.evidence_probe()'),e=>/^(event )?trigger functions can only be called as (event )?triggers$/.test(e.message));
  await db.query('rollback');
  await db.query('drop event trigger evidence_probe;drop function extensions.evidence_probe();drop schema extensions');
  const registry=await officialRegistry();
  assert.equal(registry.provenance.files.length,11);
  const original=registry.provenance.files[0];
  const bytes=await readFile(new URL('../supabase/reference/supabase-postgres/'+original.file,import.meta.url));
  assert.doesNotThrow(()=>verifyOfficialBytes(original,bytes));
  assert.throws(()=>verifyOfficialBytes(original,Buffer.concat([bytes,Buffer.from('-- changed')])) ,/integrity/);
  assert.throws(()=>verifyOfficialBytes({...original,git_blob:'0'.repeat(40)},bytes),/integrity/);
  const delta=JSON.parse(await readFile(new URL('./fixtures/prueba-school-drift.json',import.meta.url),'utf8'));
  const catalog=await readUpgradeCatalog(db);
  for(const fn of delta.functions)catalog.functions[catalog.functions.findIndex(f=>f.schema===fn.schema&&f.name===fn.name&&f.arguments===fn.arguments)]=fn;
  catalog.constraints=delta.constraints;catalog.event_triggers=delta.event_triggers;
  const acl=(grantee,grantor)=>({grantee,grantor,privilege:'EXECUTE',grantable:false});
  // Synthetic proof of the exact official policy, NOT evidence from Prueba.
  const evidence={version:1,server_version_num:170007,
   service_role:{name:'service_role',super:false,bypass:true,inherit:false,login:false},
   clients_can_become_service:{anon:false,authenticated:false},
   clients_can_become_admin:{anon:false,authenticated:false},
   extensions_schema:{owner:'postgres',anon_create:false,auth_create:false},
   service_function_acls:[
    {name:'can_send_item_message',acl:[acl('postgres','postgres'),acl('service_role','postgres'),acl('authenticated','postgres')]},
    {name:'canonicalize_message_display',acl:[acl('postgres','postgres'),acl('service_role','postgres')]},
   ],
   event_triggers:Object.entries(managedWiring).map(([name,w])=>{
    const fn=w[1].split('.')[1].slice(0,-2),source=registry.functions.find(f=>f.name===fn);
    return {name,event:w[0],enabled:'O',tags:w[2],event_owner:'supabase_admin',schema:'extensions',function:fn,
     arguments:'',result:'event_trigger',function_owner:'supabase_admin',language:'plpgsql',config:source.config,
     body_sha256:source.body_sha256,security_definer:false,strict:false,leakproof:false,parallel:'u',volatility:'v',
     acl:[acl('PUBLIC','supabase_admin'),acl('supabase_admin','supabase_admin')],extension_dependencies:null};
   }),
  };
  const analyze=(c,e)=>planUpgrade({query:async sql=>({rows:[sql.includes('as evidence;')?{evidence:e}:{catalog:c}]})});
  const plan=await analyze(catalog,evidence);
  assert.equal(plan.stage,'school',JSON.stringify(plan.comparisons));assert.equal(plan.compatible_catalog,true);
  assert.equal(plan.authorization_to_apply,false);assert.equal(plan.official_validation.verified,true);
  assert.deepEqual(plan.candidates.map(c=>c.file),upgrades.slice(1));
  assert.ok(plan.equivalences.some(e=>e.variant==='pre_pg18_not_null_catalog'&&e.count===79));
  assert.ok(plan.equivalences.some(e=>e.variant==='official_supabase_events'));
  assert.equal(plan._expectedFinal.functions.find(f=>f.name==='can_send_item_message').service_execute,false);
  assert.equal(plan._expectedFinal.functions.find(f=>f.name==='canonicalize_message_display').service_execute,true);
  assert.ok(!plan._expectedFinalEvidence.service_function_acls.find(f=>f.name==='can_send_item_message').acl.some(a=>a.grantee==='service_role'));
  const sql=await upgradeBundle(plan);
  assert.ok(sql.includes('Evidence changed'));assert.ok(sql.includes('Final evidence mismatch'));
  assert.ok(sql.includes(registry.functions[0].body_sha256));
  // No complete proof means no waiver of the previously observed drift.
  assert.equal((await analyze(catalog,null)).compatible_catalog,false);
  for(const mutate of [
   (c,e)=>{e.event_triggers[0].body_sha256='0'.repeat(64);},
   (c,e)=>{e.event_triggers[0].event_owner='postgres';},
   (c,e)=>{e.event_triggers[0].function_owner='authenticated';},
   (c,e)=>{e.event_triggers[0].config=null;},
   (c,e)=>{e.event_triggers[0].security_definer=true;},
   (c,e)=>{e.event_triggers[0].acl[0].grantable=true;},
   (c,e)=>{e.event_triggers[0].acl.push(acl('unknown','supabase_admin'));},
   (c,e)=>{e.event_triggers[0].extension_dependencies=[{extension:'unknown',type:'e'}];},
   (c,e)=>{e.clients_can_become_admin.authenticated=true;},
   (c,e)=>{e.extensions_schema.auth_create=true;},
   (c,e)=>{e.service_role.inherit=true;},
   (c,e)=>{e.clients_can_become_service.anon=true;},
   (c,e)=>{e.service_function_acls[0].acl.find(a=>a.grantee==='service_role').grantable=true;},
   (c,e)=>{e.server_version_num=180001;},
   (c,e)=>{c.constraints=c.constraints.filter(k=>k.name!=='messages_sender_id_fkey');},
   (c,e)=>{c.constraints.find(k=>k.name==='messages_text_check').definition_hash='changed';},
   (c,e)=>{c.columns.find(k=>k.schema==='public'&&k.table==='messages'&&k.name==='text').not_null=false;},
   (c,e)=>{c.functions.find(f=>f.name==='can_send_item_message').body_hash='changed';},
   (c,e)=>{c.functions.find(f=>f.name==='canonicalize_message_display').auth_execute=true;},
   (c,e)=>{c.event_triggers.push({...c.event_triggers[0],name:'unknown_event'});},
   (c,e)=>{e.event_triggers.push({...e.event_triggers[0],name:'unknown_event'});},
  ]){
   const c=structuredClone(catalog),e=structuredClone(evidence);mutate(c,e);
   const blocked=await analyze(c,e);assert.equal(blocked.compatible_catalog,false);
   assert.deepEqual(blocked.candidates,[]);await assert.rejects(upgradeBundle(blocked),/No reviewed/);
  }
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
 const db=await fixture();
 const wasInherit=(await db.query("select rolinherit from pg_roles where rolname='service_role'")).rows[0].rolinherit;
 try{
  await db.query(`alter role service_role noinherit;
   grant execute on function public.can_send_item_message(uuid,uuid),public.canonicalize_message_display() to service_role;`);
  await db.query(await read(upgrades[1]));
  const plan=await planUpgrade(db);assert.equal(plan.stage,'secure_recovery');
  assert.equal(plan.equivalences.filter(e=>e.variant==='trusted_server_execute').length,2);
  assert.deepEqual(plan.candidates.map(s=>s.file),[upgrades[2]]);
  const sql=executable(await upgradeBundle(plan));
  // mode already exists: preservation must include it, not exclude it as new.
  assert.ok(!sql.includes("-array['mode'"));
  await db.query("select set_config('buscag.upgrade.backup_verified',$1,false)",[plan.catalog_fingerprint]);
  await db.query(sql);assert.equal((await planUpgrade(db)).stage,'community');
  const final=(await db.query("select has_function_privilege('service_role','public.can_send_item_message(uuid,uuid)','EXECUTE') can_send,has_function_privilege('service_role','public.canonicalize_message_display()','EXECUTE') canonicalize")).rows[0];
  assert.deepEqual(final,{can_send:false,canonicalize:true});
 }finally{
  await db.query('rollback');await db.query('alter role service_role '+(wasInherit?'inherit':'noinherit'));
  await db.close();
 }
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
test('operator Prueba catalog is reproduced exactly; PG18 not-null representation and named ACL/event differences are explained, never waived',async()=>{
 const delta=JSON.parse(await readFile(new URL('./fixtures/prueba-school-drift.json',import.meta.url),'utf8'));
 const db=await fixture('timestamptz');try{
  await db.query('begin read only');await db.query(await read('audit/upgrade_event_trigger_review.sql'));await db.query('rollback');
  const clean=await readUpgradeCatalog(db);
  const observed=structuredClone(clean);
  for(const fn of delta.functions){
   const i=observed.functions.findIndex(f=>f.schema===fn.schema&&f.name===fn.name&&f.arguments===fn.arguments);
   assert.ok(i>=0);observed.functions[i]=fn;
  }
  observed.constraints=delta.constraints;observed.event_triggers=delta.event_triggers;
  assert.equal(fingerprint(observed),delta.source_plan_fingerprint);
  const analyze=catalog=>planUpgrade({query:async()=>({rows:[{catalog}]})});
  const plan=await analyze(observed);
  assert.equal(plan.stage,'unknown_or_drifted');assert.equal(plan.compatible_catalog,false);
  assert.deepEqual(plan.candidates,[]);await assert.rejects(upgradeBundle(plan),/No reviewed/);
  const review=plan.review;assert.equal(review.reference_stage,'school');
  assert.deepEqual(review.constraint_counts,{expected:131,actual:52,missing:79,added:0,changed:0});
  assert.ok(review.constraints.missing.every(c=>c.classification==='not_null_catalog_representation'));
  assert.equal(review.functions.changed.length,2);
  assert.ok(review.functions.changed.every(c=>c.classification==='buscag_service_execute_variant_requires_acl_review'));
  assert.equal(review.event_triggers.length,6);
  assert.ok(review.event_triggers.every(t=>t.classification==='supabase_wiring_candidate_unverified'&&!t.automatic_acceptance));
  const mutations=[
   c=>{c.functions.find(f=>f.name==='canonicalize_message_display').auth_execute=true;},
   c=>{c.functions.find(f=>f.name==='can_send_item_message').body_hash='changed';},
   c=>{c.constraints=c.constraints.filter(k=>k.name!=='messages_sender_id_fkey');},
   c=>{c.constraints.find(k=>k.name==='messages_text_check').definition_hash='changed';},
   c=>{c.columns.find(k=>k.schema==='public'&&k.table==='messages'&&k.name==='text').not_null=false;},
   c=>{c.event_triggers[0].function='public.forged()';},
   c=>{c.event_triggers[0].function_hash='unreviewed-body';},
   c=>{c.event_triggers.push({name:'unknown_hook',function:'public.unknown()',event:'ddl_command_end',enabled:'O',tags:null});},
  ];
  for(const [i,mutate] of mutations.entries()){
   const altered=structuredClone(observed);mutate(altered);const blocked=await analyze(altered);
   assert.equal(blocked.compatible_catalog,false);assert.deepEqual(blocked.candidates,[]);
   await assert.rejects(upgradeBundle(blocked),/No reviewed/);
   if(i<5){
    // The dangerous change must also block a clean reference, without the
    // pre-existing event drift masking a broken security comparison.
    const isolated=structuredClone(clean);mutate(isolated);
    assert.equal((await analyze(isolated)).compatible_catalog,false);
   }
  }
 }finally{await db.close();}
});
