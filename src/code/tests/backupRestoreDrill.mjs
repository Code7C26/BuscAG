// Native pg_dump/pg_restore rehearsal. ONLY random synthetic databases in an
// explicitly labelled, network-disabled Docker cluster with ephemeral data.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export function validateDisposableContainer(info,socket){
  if(info.disposable!=='true'||info.network!=='none'||!Object.hasOwn(info.tmpfs??{},'/var/lib/postgresql/data')
    ||!info.mounts?.some(m=>m.Destination==='/var/run/postgresql'&&m.Source===socket))throw Error('Restore rehearsal requires the labelled isolated cluster and its exact socket');
}
function docker(args,input){
  const env={...process.env};for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[key];
  const result=spawnSync('docker',['--host=unix:///var/run/docker.sock',...args],{env,input,maxBuffer:20*1024*1024,timeout:60_000});
  if(result.error||result.status!==0)throw Error('Isolated PostgreSQL tool failed; no production endpoint is accepted');
  return result.stdout;
}
export function assertDisposableCluster(){
  const container=process.env.BUSCAG_TEST_CONTAINER,socket=process.env.LOCAL_PG_SOCKET;
  if(process.env.BUSCAG_TEST_CLUSTER!=='disposable'||!socket?.startsWith('/')||!/^buscag[-a-z0-9]+$/.test(container??''))throw Error('Explicit disposable cluster configuration required');
  const format='{"disposable":{{json (index .Config.Labels "buscag.disposable")}},"network":{{json .HostConfig.NetworkMode}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}';
  validateDisposableContainer(JSON.parse(docker(['inspect','--format',format,container]).toString()),socket);
  return container;
}
const tables=['auth.users','auth.identities','public.profiles','public.items','public.messages','public.notifications','public.push_subscriptions',
  'storage.buckets','storage.objects','buscag_private.message_receipts','buscag_private.publication_receipts','buscag_private.match_jobs','buscag_private.match_notices','buscag_private.match_control'];
async function snapshot(db){
  const result={};
  for(const table of tables)result[table]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') value from ${table} t`)).rows[0].value;
  return result;
}
const stable=value=>JSON.stringify(value,(_key,current)=>current&&typeof current==='object'&&!Array.isArray(current)?Object.fromEntries(Object.entries(current).sort(([a],[b])=>a.localeCompare(b))):current);
async function metadata(db){
  const sql=await readFile(new URL('../supabase/audit/production_diagnostic.sql',import.meta.url),'utf8');
  const report=JSON.parse((await db.query(sql)).rows[0].diagnostic);
  const selected={};
  for(const key of ['02_inventory','04_columns','05_policies','08_table_permissions','09_column_permissions','10_constraints','11_indexes','12_triggers_without_arguments','13_function_metadata_not_bodies','14_dependent_views','15_realtime','17_optional_workflow_inventory','18_rpc_permissions','19_private_workflow_permissions','20_schema_permissions','21_public_rpc_surface']){
    selected[key]=report[key].map(({oid,column_acl,table_acl,proacl,...row})=>stable(row)).sort();
  }
  return selected;
}
async function as(db,role,uid,sql,args=[]){
  await db.exec('begin');
  try{await db.exec('set local role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid??'']);const result=await db.query(sql,args);await db.exec('commit');return result;}
  catch(error){await db.exec('rollback');throw error;}
}
export async function backupRestoreDrill(source,{users,found,first,payload}){
  const container=assertDisposableCluster();
  if(!source.fork||!/^buscag_test_[a-f0-9]{16}$/.test(source.name))throw Error('A synthetic native source is required');
  const {PGlite:Native}=await import('./postgresAdapter.mjs');
  const target=new Native();
  try {
    await target.query('select 1');
    // Explicit minimal identity/Storage stand-ins; never a real Supabase Auth backup.
    await source.exec('create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),provider text not null)');
    for(const uid of users)await source.query("insert into auth.identities(user_id,provider) values($1,'synthetic')",[uid]);
    await source.query("insert into storage.objects(bucket_id,name) values('item-images','synthetic/photo.png')");
    await source.query("insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://fcm.googleapis.com/synthetic-restore','synthetic','synthetic')",[users[0]]);
    const before=await snapshot(source),beforeMetadata=await metadata(source);
    const archive=docker(['exec',container,'pg_dump','--host=/var/run/postgresql','--username=postgres','--format=custom','--no-owner','--dbname='+source.name]);
    assert.equal(archive.subarray(0,5).toString(),'PGDMP');
    const list=docker(['exec','-i',container,'pg_restore','--list'],archive).toString();
    for(const name of ['users','identities','items','messages','publication_receipts','message_receipts'])assert.ok(list.includes(' '+name+' '),name+' must be in the archive');
    if(/SCHEMA - public\b/.test(list))await target.exec('drop schema public'); // Empty generated target only.
    docker(['exec','-i',container,'pg_restore','--host=/var/run/postgresql','--username=postgres','--exit-on-error','--no-owner','--dbname='+target.name],archive);
    assert.deepEqual(await snapshot(target),before,'All fourteen synthetic tables survive restore');
    assert.deepEqual(await metadata(target),beforeMetadata,'RLS, grants, constraints, triggers, indexes and function fingerprints survive restore');
    const replay=(await as(target,'authenticated',users[1],'select * from public.publish_item_once($1,$2)',[users[1],JSON.stringify({...payload,status:'encontrado'})])).rows[0];
    assert.equal(replay.id,found.id);assert.equal(replay.status,'recuperado');
    assert.equal((await as(target,'authenticated',users[0],'select * from public.send_message_once($1,$2,$3,$4)',[users[0],found.id,users[1],'Synthetic message'])).rows[0].id,first.id);
    assert.equal((await as(target,'authenticated',users[2],'select * from public.messages')).rows.length,0);
    assert.equal((await as(target,'authenticated',users[2],'select * from public.notifications')).rows.length,0);
    assert.equal((await as(target,'authenticated',users[2],'select * from public.push_subscriptions')).rows.length,0);
    await assert.rejects(as(target,'anon',null,'select * from public.profiles'),error=>error.code==='42501');
    const own=(await as(target,'authenticated',users[2],'select * from public.profiles')).rows;
    assert.equal(own.length,1);assert.equal(own[0].id,users[2]);
    const directory=(await as(target,'authenticated',users[2],'select id,phone from public.public_profiles')).rows;
    assert.equal(directory.length,3);assert.ok(directory.filter(row=>row.id!==users[2]).every(row=>row.phone===''));
    assert.equal((await as(target,'authenticated',users[0],'select phone from public.public_profiles where id=$1',[users[1]])).rows[0].phone,'synthetic-private');
    assert.equal((await as(target,'authenticated',users[2],"update public.items set title='Forged' where id=$1 returning id",[found.id])).rows.length,0);
    await assert.rejects(as(target,'authenticated',users[0],'update public.profiles set rating=9 where id=$1',[users[0]]),error=>error.code==='42501');

    assert.deepEqual(await snapshot(target),before,'Replay performs no duplicate writes after restore');
    await target.exec(await readFile(new URL('../supabase/activation/pause_trusted_matches.sql',import.meta.url),'utf8'));
    assert.equal((await target.query('select public.match_backend_enabled() enabled')).rows[0].enabled,false);
    assert.equal((await source.query('select public.match_backend_enabled() enabled')).rows[0].enabled,true);
    const afterPause=await snapshot(target);delete afterPause['buscag_private.match_control'];const retained={...before};delete retained['buscag_private.match_control'];assert.deepEqual(afterPause,retained);
    assert.deepEqual(await snapshot(source),before,'Rehearsal never mutates source after snapshot');
    console.log('PASS: native archive restored 14 synthetic tables, metadata, privacy, replay and isolated pause; archive SHA-256 '+createHash('sha256').update(archive).digest('hex'));
  }finally{await target.close();}
}
