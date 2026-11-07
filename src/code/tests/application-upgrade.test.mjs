import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {stagingReference} from '../scripts/staging-reference.mjs';
import {files} from '../scripts/prepare-staging.mjs';
import {planUpgrade,upgradeBundle,upgrades,readUpgradeEvidence,readUpgradeCatalog,disposableAuthorization,disposableTargetSql,saveUpgradeArtifacts} from '../scripts/staging-upgrade.mjs';
import {applicationSourceMatches,applicationSources,readApplicationContext,applicationPreservation} from '../scripts/staging-application-scope.mjs';
import {validateOfficialEvents} from '../scripts/staging-official-evidence.mjs';
import {installObservedPlatform,observedPlatformDefinitions} from './platformFixture.mjs';
const {PGlite}=await import(process.env.LOCAL_PG_SOCKET?'./postgresAdapter.mjs':'@electric-sql/pglite');
const read=file=>readFile(new URL('../supabase/'+file,import.meta.url),'utf8');
const executable=sql=>sql.replace(/^\\set ON_ERROR_STOP on\n/m,'');
async function fixture(dateType,stage='school'){
 const db=await stagingReference(PGlite,{dateType});
 for(const file of [...files,...(stage==='school'?[upgrades[0]]:[])])await db.query(await read(file));
 // Reproduce Supabase defaults for FUTURE public functions. The two migrations
 // must explicitly close these grants, rather than rely on a clean local cluster.
 await db.query('alter default privileges for role postgres in schema public grant execute on functions to anon,authenticated,service_role');
 await db.query('set search_path=pg_catalog,public');
 await installObservedPlatform(db);
 return db;
}
for(const dateType of ['date','timestamptz'])test(`bounded application upgrade executes with all SIX actual legacy wrapper bodies unchanged (${dateType})`,async()=>{
 const db=await fixture(dateType);
 try{
  const a='a0000000-0000-4000-8000-000000000001',b='a0000000-0000-4000-8000-000000000002',item='b0000000-0000-4000-8000-000000000001';
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$3),($2,$3)',[a,b,{full_name:'Preserved user'}]);
  await db.query(`insert into public.items(id,owner_id,title,description,category,status,location_name,lat,lng,image_url)
    values('${item}','${a}','Historical','Preserved description','Otros','recuperado','Synthetic',1,2,'https://example.invalid/a.jpg');
    insert into public.messages(item_id,sender_id,recipient_id,text) values('${item}','${a}','${b}','Preserved chat');
    insert into buscag_private.recovery_confirmations(item_id,owner_id,partner_id,state,resolved_at) values('${item}','${a}','${b}','confirmed',now());
    insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values('${a}','https://push.invalid/synthetic','synthetic','synthetic');`);
  // Reproduce the exact official GRANT -> ALTER OWNER semantics in this
  // disposable fixture. Never alter remote functions or fabricate remote ACLs.
  await db.query(`do $$begin if not exists(select from pg_roles where rolname='dashboard_user') then create role dashboard_user nologin;end if;end$$;`);
  for(const fn of ['grant_pg_cron_access','grant_pg_net_access'])await db.query(`
   alter function extensions.${fn} owner to postgres;
   grant execute on function extensions.${fn}() to postgres with grant option;
   grant execute on function extensions.${fn}() to dashboard_user;
   alter function extensions.${fn} owner to supabase_admin;`);
  const beforeUser=(await db.query('select to_jsonb(p) p from public.profiles p where id=$1',[a])).rows[0].p;
  const evidence=await readUpgradeEvidence(db);
  const catalog=await readUpgradeCatalog(db);
  assert.equal((await planUpgrade(db)).compatible_catalog,false);
  // Unknown defaults must not silently grant any NEW definer API to a third role.
  await db.query('begin;create role buscag_unknown_default;alter default privileges for role postgres in schema public grant execute on functions to buscag_unknown_default');
  await assert.rejects(planUpgrade(db,{preservePlatform:true}),e=>e.code==='BUSCAG_APPLICATION_SESSION'&&e.message.includes('safe_function_defaults'));
  await db.query('rollback');
  const plan=await planUpgrade(db,{preservePlatform:true});
  assert.equal(plan.stage,'school',JSON.stringify({preservation:plan.platform_preservation,comparisons:plan.comparisons}));
  for(const name of ['issue_pg_cron_access','issue_pg_net_access']){
   const proof=plan.official_validation.checks.find(c=>c.name===name);
   assert.equal(proof.application_acl_profile,'supabase_owner_transfer_dashboard_execute');
   assert.ok(proof.failures.includes('acl'),'General validator must stay blocked');
   assert.deepEqual([...evidence.event_triggers.find(c=>c.name===name).acl].sort((a,b)=>a.grantee.localeCompare(b.grantee)),[
    {grantee:'PUBLIC',grantor:'supabase_admin',grantable:false,privilege:'EXECUTE'},
    {grantee:'dashboard_user',grantor:'supabase_admin',grantable:false,privilege:'EXECUTE'},
    {grantee:'supabase_admin',grantor:'supabase_admin',grantable:true,privilege:'EXECUTE'},
   ].sort((a,b)=>a.grantee.localeCompare(b.grantee)));
   assert.equal(proof.application_acl_sources.length,3);
  }
  assert.equal(plan.official_validation.verified,false);assert.equal(plan.platform_preservation.platform_secure,false);
  assert.equal(plan.authorization_to_apply,false);assert.deepEqual(plan.candidates.map(f=>f.file),upgrades.slice(1));
  await assert.rejects(upgradeBundle({...plan,candidates:[plan.sources.find(f=>f.file===upgrades[0])]}),/two-file scope/);
  const built=executable(await upgradeBundle(plan));
  const sql=dateType==='date'?built.replaceAll('\n','\r\n'):built;
  assert.doesNotMatch(sql,/create temporary table/i);
  assert.equal(/^\s*(?:alter event trigger|drop event trigger|set\s+(?:local\s+)?session_replication_role\s*=|create extension|drop extension)/im.test(sql),false,'No platform DDL or event bypass');
  await assert.rejects(db.query(sql),/Verified restore evidence/);await db.query('rollback');
  await db.query("select set_config('buscag.upgrade.backup_verified',$1,false)",[plan.catalog_fingerprint]);
  const net=(await observedPlatformDefinitions()).find(f=>f.name==='issue_pg_net_access');
  await db.query("create or replace function extensions.grant_pg_net_access() returns event_trigger language plpgsql set search_path to '' as $$begin return;end$$");
  await assert.rejects(db.query(sql),/Evidence changed/);await db.query('rollback');
  await db.query(`create or replace function extensions.grant_pg_net_access() returns event_trigger language plpgsql set search_path to '' as $fixture_body$${net.body}$fixture_body$`);
  // A failed migration must undo BOTH application stages and preserve old rows.
  await assert.rejects(db.query(sql.replace('end $buscag_application$;','raise exception \'synthetic failure\';end $buscag_application$;')),/synthetic failure/);
  await db.query('rollback');assert.equal((await planUpgrade(db,{preservePlatform:true})).stage,'school');
  const snapshotSql='select jsonb_agg(to_jsonb(s) order by s.relation) into after_data';
  await assert.rejects(db.query(sql.replace(snapshotSql,"update public.profiles set full_name='tampered';\n"+snapshotSql)),/Existing data changed/);
  await db.query('rollback');assert.equal((await planUpgrade(db,{preservePlatform:true})).stage,'school');
  // No difference in the application or platform catalog may be hidden by scope.
  const context={version:1,operator:true,origin:true,events_enabled:true,no_temp_objects:true,safe_function_defaults:true};
  const analyze=(c,e)=>planUpgrade({query:async q=>({rows:[q.includes('as application_context')?{application_context:context}:q.includes('as evidence;')?{evidence:e}:{catalog:c}]})},{preservePlatform:true});
  for(const mutate of [
   (c,e)=>{e.event_triggers[0].body_sha256='0'.repeat(64);},
   (c,e)=>{e.event_triggers[0].security_definer=true;},
   (c,e)=>{e.event_triggers[0].config=['search_path=public'];},
   (c,e)=>{e.event_triggers[0].acl.push({grantee:'authenticated',grantor:'supabase_admin',privilege:'EXECUTE',grantable:false});},
   (c,e)=>{e.event_triggers[0].event_owner='postgres';},
   (c,e)=>{e.event_triggers[0].extension_dependencies=[{extension:'unknown',type:'e'}];},
   (c,e)=>{e.event_triggers.push({...e.event_triggers[0],name:'unknown'});},
   (c,e)=>{e.clients_can_become_admin.authenticated=true;},
   (c,e)=>{e.clients_can_become_service.anon=true;},
   (c,e)=>{e.service_role.login=true;},
   (c,e)=>{e.server_version_num=160001;},
   (c,e)=>{c.functions.find(f=>f.name==='can_send_item_message').body_hash='unreviewed';},
   (c,e)=>{c.constraints.pop();},
   (c,e)=>{c.policies.push({...c.policies[0],name:'rogue'});},
   (c,e)=>{c.public_schema.auth_create=true;},
  ]){
   const c=structuredClone(catalog),e=structuredClone(evidence);mutate(c,e);
   const denied=await analyze(c,e);assert.equal(denied.compatible_catalog,false);assert.deepEqual(denied.candidates,[]);
   await assert.rejects(upgradeBundle(denied),/No reviewed/);
  }
  await db.query('create temp table pg_extension(marker text)');
  await assert.rejects(db.query(sql),/NO temporary objects/);await db.query('rollback');
  await assert.rejects(planUpgrade(db,{preservePlatform:true}),e=>e.code==='BUSCAG_APPLICATION_SESSION');
  await db.query('drop table pg_temp.pg_extension');
  await db.query(sql);
  const after=await planUpgrade(db,{preservePlatform:true});assert.equal(after.stage,'community');assert.equal(after.installed_final_catalog,true);
  assert.deepEqual((await readUpgradeEvidence(db)).event_triggers,evidence.event_triggers);
  assert.equal((await db.query('select pg_my_temp_schema()=0 or not exists(select from pg_class where relnamespace=pg_my_temp_schema()) clean')).rows[0].clean,true);
  const profile=(await db.query('select to_jsonb(p)-\'phone_shared\'-\'rating_count\' p from public.profiles p where id=$1',[a])).rows[0].p;
  assert.deepEqual(profile,beforeUser);
  assert.equal((await db.query('select count(*)::int n from public.messages')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.push_subscriptions')).rows[0].n,1);
  assert.equal((await db.query('select state from buscag_private.recovery_confirmations where item_id=$1',[item])).rows[0].state,'confirmed');
 }finally{await db.query('rollback');await db.close();}
});
test('only exact reviewed application bytes are allowed; CRLF is supported but extension/platform DDL additions are not',async()=>{
 for(const file of Object.keys(applicationSources)){
  const sql=await read(file);assert.equal(applicationSourceMatches(file,sql),true);
  assert.equal(applicationSourceMatches(file,sql.replaceAll('\n','\r\n')),true);
  for(const suffix of ['\nCREATE EXTENSION pg_cron;','\nALTER EVENT TRIGGER pgrst_ddl_watch DISABLE;','\n-- unknown change'])assert.equal(applicationSourceMatches(file,sql+suffix),false);
 }
 assert.equal(applicationSourceMatches(upgrades[0],await read(upgrades[0])),false);
});
test('unsafe session states stop planning before any application catalog query',async()=>{
 for(const key of ['operator','origin','events_enabled','no_temp_objects','safe_function_defaults']){
  let calls=0;const context={version:1,operator:true,origin:true,events_enabled:true,no_temp_objects:true,safe_function_defaults:true,[key]:false};
  await assert.rejects(readApplicationContext({query:async()=>{calls++;return {rows:[{application_context:context}]};}}),e=>e.code==='BUSCAG_APPLICATION_SESSION');assert.equal(calls,1);
 }
});
test('preservation cannot install school/baseline or target production and never becomes an apply flag',async()=>{
 const db=await fixture('date','baseline');try{
  const plan=await planUpgrade(db,{preservePlatform:true});assert.equal(plan.compatible_catalog,false);assert.deepEqual(plan.candidates,[]);
 }finally{await db.close();}
 for(const args of [
  ['--project-ref','hczcqtodcnurdrroczle','--upgrade-plan','--preserve-platform'],
  ['--project-ref','yiarlhpbgkofhhipkfha','--apply','--preserve-platform'],
  ['--project-ref','yiarlhpbgkofhhipkfha','--smoke','--preserve-platform'],
 ]){
  const result=spawnSync(process.execPath,['scripts/prepare-staging.mjs',...args],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,BUSCAG_STAGING_DATABASE_URL:'synthetic-never-connect'}});
  assert.equal(result.status,1);assert.equal((result.stdout+result.stderr).includes('synthetic-never-connect'),false);
  assert.match(result.stderr,/BUSCAG_PREFLIGHT/);
 }
});
test('real native event firing: PostgREST watchers execute and the four extension wrappers never do for application DDL',{skip:!process.env.LOCAL_PG_SOCKET},async()=>{
 const db=await fixture('date');try{
  await db.query("begin;set local track_functions='all';create table public.application_ddl_probe(id int);drop table public.application_ddl_probe");
  const calls=(await db.query(`select p.proname,coalesce(s.calls,0)::int calls from pg_catalog.pg_proc p
   left join pg_catalog.pg_stat_xact_user_functions s on s.funcid=p.oid where p.pronamespace='extensions'::regnamespace`)).rows;
  for(const r of calls)assert.ok(r.proname.startsWith('pgrst_')?r.calls>0:r.calls===0,JSON.stringify(r));
  await db.query('rollback');
 }finally{await db.query('rollback');await db.close();}
});
for(const dateType of ['date','timestamptz'])test(`authorized historical matching uses the existing queue without touching items or resetting cursors (${dateType})`,async()=>{
 const db=await fixture(dateType);try{
  const actor='a0000000-0000-4000-8000-000000000009';
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[actor,{full_name:'Synthetic owner'}]);
  await db.query(`insert into public.items(owner_id,title,description,category,status,location_name,lat,lng,image_url)
   values('${actor}','Queue one','Synthetic','Otros','perdido','Synthetic',1,2,'https://example.invalid/1'),
   ('${actor}','Queue two','Synthetic','Otros','encontrado','Synthetic',1,2,'https://example.invalid/2')`);
  const before=(await db.query('select to_jsonb(i) row from public.items i order by id')).rows;
  const sql=await read('activation/queue_existing_matches_PRUEBA_ONLY.sql');
  await assert.rejects(db.query(sql),/Enabled worker/);await db.query('rollback');
  await db.query('update buscag_private.match_control set enabled=true,worker_last_seen=clock_timestamp() where singleton');
  await db.query(sql);
  assert.equal((await db.query('select count(*)::int n from buscag_private.match_jobs')).rows[0].n,2);
  await db.query('update buscag_private.match_jobs set attempts=2,after_id=item_id');
  await db.query(sql);
  assert.equal((await db.query('select count(*)::int n from buscag_private.match_jobs where attempts=2 and after_id=item_id')).rows[0].n,2);
  assert.deepEqual((await db.query('select to_jsonb(i) row from public.items i order by id')).rows,before);
  await db.query('begin;set local role authenticated');
  await assert.rejects(db.query(sql),/operator required/);await db.query('rollback');
 }finally{await db.query('rollback');await db.close();}
});
test('native postgres operator needs no SUPERUSER and can preserve separately owned Auth tables',{skip:!process.env.LOCAL_PG_SOCKET},async()=>{
 const db=await fixture('date');let control,demoted=false;
 try{
  await db.query(`do $$begin if not exists(select from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin;end if;end$$;
   alter table auth.users owner to supabase_auth_admin;grant all on auth.users to postgres;`);
  const plan=await planUpgrade(db,{preservePlatform:true});assert.equal(plan.stage,'school');
  const sql=executable(await upgradeBundle(plan));
  await db.query("select set_config('buscag.upgrade.backup_verified',$1,false)",[plan.catalog_fingerprint]);
  const database=(await db.query('select current_database() db')).rows[0].db;
  const {Client}=await import('pg');control=new Client({host:process.env.LOCAL_PG_SOCKET,database,user:'postgres',port:5432,ssl:false,password:''});
  await control.connect();await control.query('set role supabase_admin');
  await control.query('alter role postgres nosuperuser');demoted=true;
  assert.equal((await db.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false);
  await db.query(sql);
  assert.equal((await planUpgrade(db,{preservePlatform:true})).stage,'community');
 }finally{
  try{await db.query('rollback');}finally{
   if(demoted)await control.query('alter role postgres superuser');
   if(control)await control.end();await db.close();
  }
 }
});

test('cron and net ACL mismatches stay blocked and identify missing grants without echoing unknown values',async()=>{
 const db=await fixture('date');try{
  const catalog=await readUpgradeCatalog(db),evidence=await readUpgradeEvidence(db);
  const context={version:1,operator:true,origin:true,events_enabled:true,no_temp_objects:true,safe_function_defaults:true};
  for(const name of ['issue_pg_cron_access','issue_pg_net_access']){
   for(const change of [
    acl=>{acl.push({grantee:'private-sentinel-role',grantor:'supabase_admin',grantable:false,privilege:'EXECUTE'});return acl;},
    acl=>{acl[0].grantor='postgres';return acl;},
    acl=>{acl.find(a=>a.grantee==='PUBLIC').grantable=true;return acl;},
    acl=>{acl.find(a=>a.grantee==='supabase_admin').grantable=true;return acl;},
    acl=>acl.filter(a=>a.grantee!=='PUBLIC'),
    acl=>{acl.find(a=>a.grantee==='postgres').grantable=false;return acl;},
    ()=>null,
    acl=>[null,...acl.slice(1)],
   ]){
    const observed=structuredClone(evidence);observed.event_triggers.find(e=>e.name===name).acl=change(structuredClone(evidence.event_triggers.find(e=>e.name===name).acl));
    const checked=await validateOfficialEvents(catalog,observed);
    const failure=checked.checks.find(c=>c.name===name);
    assert.ok(failure.failures.includes('acl'));assert.equal(failure.acl_profile,null);
    assert.equal(failure.acl_review.next_read_only_query,'supabase/audit/upgrade_managed_acl_review.sql');
    assert.equal(JSON.stringify(failure.acl_review).includes('private-sentinel-role'),false);
    const scope=await applicationPreservation(catalog,observed,checked,context);
    assert.equal(scope.eligible,false);assert.deepEqual(scope.failures,[name]);
    assert.ok(scope.failure_details.find(c=>c.name===name).validation_failures.includes('acl'));
   }
  }
  const actualAcl=[
   {grantee:'PUBLIC',grantor:'supabase_admin',grantable:false,privilege:'EXECUTE'},
   {grantee:'supabase_admin',grantor:'supabase_admin',grantable:true,privilege:'EXECUTE'},
   {grantee:'dashboard_user',grantor:'supabase_admin',grantable:false,privilege:'EXECUTE'},
  ];
  for(const name of ['issue_pg_cron_access','issue_pg_net_access']){
   for(const mutate of [
    a=>{a[2].grantable=true;return a;},a=>{a[2].grantor='postgres';return a;},
    a=>{a[2].privilege='USAGE';return a;},a=>{a[2].grantee='authenticated';return a;},
    a=>{a.push({...a[2],grantee:'anon'});return a;},a=>a.slice(1),a=>a.slice(0,2),
    a=>{a.push({...a[2]});return a;},
   ]){
    const observed=structuredClone(evidence);observed.event_triggers.find(e=>e.name===name).acl=mutate(structuredClone(actualAcl));
    const checked=await validateOfficialEvents(catalog,observed);
    assert.equal(checked.checks.find(c=>c.name===name).application_acl_profile,null);
    assert.equal((await applicationPreservation(catalog,observed,checked,context)).eligible,false);
   }
  }
  // An owner-transfer-shaped ACL does not qualify on any of the other four.
  for(const name of ['issue_graphql_placeholder','issue_pg_graphql_access','pgrst_ddl_watch','pgrst_drop_watch']){
   const observed=structuredClone(evidence),event=observed.event_triggers.find(e=>e.name===name);
   event.acl=structuredClone(actualAcl);
   const checked=await validateOfficialEvents(catalog,observed);
   assert.equal(checked.checks.find(c=>c.name===name).application_acl_profile,null);
   assert.equal((await applicationPreservation(catalog,observed,checked,context)).eligible,false);
  }
  const query=await read('audit/upgrade_managed_acl_review.sql');
  assert.doesNotMatch(query,/pg_get_functiondef|prosrc/);
  await db.query('begin transaction read only');
  const rows=(await db.query(query.slice(query.indexOf('select jsonb_build_object('),query.lastIndexOf('rollback;')))).rows;
  assert.equal(rows.length,2);
  for(const {managed_acl_evidence:r} of rows){
   assert.ok(['issue_pg_cron_access','issue_pg_net_access'].includes(r.name));
   assert.equal(r.function_owner,'supabase_admin');assert.equal(r.acl.length,3);
   assert.equal(r.acl.find(a=>a.grantee==='postgres').grantable,true);
  }
  await db.query('rollback');assert.deepEqual(await readUpgradeEvidence(db),evidence);
 }finally{await db.query('rollback');await db.close();}
});

for(const dateType of ['date','timestamptz'])test(`disposable Prueba needs a separate scoped authorization but keeps atomic preservation (${dateType})`,async()=>{
 const db=await fixture(dateType),folder=await mkdtemp(join(tmpdir(),'buscag-disposable-'));
 try{
  const plan=await planUpgrade(db,{preservePlatform:true,disposableStaging:true});
  assert.equal(plan.stage,'school');assert.equal(plan.restore_required,false);
  assert.equal(plan.backup,'not_required_operator_declared_disposable_staging');assert.equal(plan.authorization_to_apply,false);
  assert.deepEqual(plan.candidates.map(f=>f.file),upgrades.slice(1));
  const sql=executable(await upgradeBundle(plan));
  assert.doesNotMatch(sql,/backup_verified|drop database|drop schema|truncate /i);
  await assert.rejects(db.query(sql),/Disposable Prueba project and plan approval/);await db.query('rollback');
  for(const ack of ['hczcqtodcnurdrroczle:'+plan.catalog_fingerprint,'yiarlhpbgkofhhipkfha:'+('0'.repeat(64))]){
   await db.query("select set_config('buscag.upgrade.disposable_staging_authorized',$1,false)",[ack]);
   await assert.rejects(db.query(sql),/Disposable Prueba project and plan approval/);await db.query('rollback');
  }
  await assert.rejects(upgradeBundle({...plan,project_ref:'hczcqtodcnurdrroczle'}),/not Prueba/);
  assert.doesNotMatch(disposableAuthorization({...plan,project_ref:'hczcqtodcnurdrroczle'}),/set_config/);
  const dir=new URL(pathToFileURL(folder).href+'/');await saveUpgradeArtifacts(plan,dir);
  const auth=await readFile(new URL('authorize-disposable.review.psql',dir),'utf8');
  assert.ok(auth.startsWith('-- REVIEW ONLY.'));assert.ok(auth.includes('\\getenv buscag_sslmode PGSSLMODE'));
  assert.ok(auth.includes('\\ir install.review.sql'));assert.ok(auth.indexOf('\\if :buscag_expected_target')<auth.indexOf('set_config'));
  assert.ok(auth.includes('yiarlhpbgkofhhipkfha:'+plan.catalog_fingerprint));
  assert.doesNotMatch(disposableAuthorization({...plan,candidates:[plan.sources[0]]}),/set_config/);
  await saveUpgradeArtifacts({...plan,compatible_catalog:false,candidates:[]},dir);
  assert.doesNotMatch(await readFile(new URL('authorize-disposable.review.psql',dir),'utf8'),/set_config/);
  await db.query("select set_config('buscag.upgrade.disposable_staging_authorized',$1,false)",['yiarlhpbgkofhhipkfha:'+plan.catalog_fingerprint]);
  const before=await readUpgradeEvidence(db);
  await db.query(sql);
  const final=await planUpgrade(db,{preservePlatform:true,disposableStaging:true});
  assert.equal(final.stage,'community');assert.equal(final.candidates.length,0);
  assert.deepEqual((await readUpgradeEvidence(db)).event_triggers,before.event_triggers);
  assert.doesNotMatch(disposableAuthorization(final),/set_config/);
 }finally{await db.query('rollback');await db.close();await rm(folder,{recursive:true,force:true});}
});
test('psql authorization target query rejects production, wrong pooler tenant, database, TLS and transaction pooler',async()=>{
 const db=new PGlite();try{
  const valid={HOST:'aws-0-us-east-1.pooler.supabase.com',USER:'postgres.yiarlhpbgkofhhipkfha',PORT:'5432',DBNAME:'postgres',buscag_sslmode:'verify-full'};
  const check=async values=>{
   const sql=disposableTargetSql.replace(/:'(HOST|USER|PORT|DBNAME|buscag_sslmode)'/g,(_s,k)=>"'"+values[k].replaceAll("'","''")+"'");
   return (await db.query(sql)).rows[0].buscag_expected_target;
  };
  assert.equal(await check(valid),true);
  assert.equal(await check({...valid,HOST:'db.yiarlhpbgkofhhipkfha.supabase.co',USER:'postgres'}),true);
  for(const change of [{HOST:'db.hczcqtodcnurdrroczle.supabase.co',USER:'postgres'},{USER:'postgres.hczcqtodcnurdrroczle'},
   {HOST:'fake.pooler.supabase.com.attacker.invalid'},{PORT:'6543'},{DBNAME:'another'},{buscag_sslmode:'require'},{buscag_sslmode:'disable'},
   {USER:"postgres.yiarlhpbgkofhhipkfha';select true;--"}])assert.equal(await check({...valid,...change}),false);
 }finally{await db.close();}
});
test('disposable mode is never accepted for baseline, implicit scope, production or generic apply',async()=>{
 let reads=0;
 for(const options of [{disposableStaging:true},{preservePlatform:true,disposableStaging:'true'}])await assert.rejects(planUpgrade({query:async()=>{reads++;} },options));
 assert.equal(reads,0);
 for(const args of [
  ['--project-ref','hczcqtodcnurdrroczle','--upgrade-plan','--preserve-platform','--disposable-staging'],
  ['--project-ref','yiarlhpbgkofhhipkfha','--upgrade-plan','--disposable-staging'],
  ['--project-ref','yiarlhpbgkofhhipkfha','--apply','--preserve-platform','--disposable-staging'],
 ]){
  const r=spawnSync(process.execPath,['scripts/prepare-staging.mjs',...args],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,BUSCAG_STAGING_DATABASE_URL:'private-sentinel'}});
  assert.equal(r.status,1);assert.match(r.stderr,/BUSCAG_PREFLIGHT/);assert.equal((r.stdout+r.stderr).includes('private-sentinel'),false);
 }
});
