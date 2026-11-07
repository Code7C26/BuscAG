import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDisposableContainer} from './backupRestoreDrill.mjs';
const socket='/tmp/buscag-synthetic-socket';
const isolated=()=>({disposable:'true',network:'none',tmpfs:{'/var/lib/postgresql/data':''},mounts:[{Source:socket,Destination:'/var/run/postgresql'}]});
test('restore rehearsal accepts the explicit tmpfs test cluster and rejects persistent/networked or mismatched targets',()=>{
  assert.doesNotThrow(()=>validateDisposableContainer(isolated(),socket));
  for(const change of [info=>{info.disposable=null;},info=>{info.network='bridge';},info=>{info.tmpfs={};},info=>{info.mounts[0].Source='/tmp/another-cluster';}]){
    const info=isolated();change(info);assert.throws(()=>validateDisposableContainer(info,socket));
  }
});

import {parseRestoreMetadata,inspectRestoreArchive} from '../scripts/inspect-restore-archive.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const toc=`; Dumped from database version: 17.6
; Dumped by pg_dump version: 18.6
1; 2615 1 SCHEMA - auth supabase_auth_admin
2; 1255 2 FUNCTION auth uid() supabase_auth_admin
3; 1259 3 TABLE auth users supabase_auth_admin
4; 0 3 TABLE DATA auth users supabase_auth_admin
5; 1259 4 TABLE public items postgres
6; 0 4 TABLE DATA public items postgres
`;
const schema=`CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid /* private-sentinel */$$;`;
test('archive inventory distinguishes source/dumper versions and Auth coverage without exporting SQL',()=>{
 const r=parseRestoreMetadata(toc.replaceAll('\n','\r\n'),schema);
 assert.equal(r.source_server_version,'17.6');assert.equal(r.dump_client_version,'18.6');
 assert.equal(r.toc_entries,6);assert.deepEqual(r.extensions,['supabase_vault','uuid-ossp']);
 assert.equal(r.auth.uid_definition_in_schema,true);assert.equal(r.auth.users_data,true);
 assert.equal(r.auth.identities_data,false);assert.equal(r.backup_verified,false);
 assert.equal(r.role_inventory_complete,false);assert.equal(JSON.stringify(r).includes('private-sentinel'),false);
 const partial=parseRestoreMetadata('5; 1259 4 TABLE public items postgres','CREATE VIEW public.public_profiles AS SELECT auth.uid();');
 assert.equal(partial.auth.uid_definition_in_schema,false);assert.equal(partial.auth.users_data,false);
});
test('archive inspector invokes only offline read commands, preserves spaces and sanitizes failures',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'buscag-archive-'));
 try{
  const path=join(dir,'archive with spaces.dump');await writeFile(path,'synthetic archive');const calls=[];
  const run=(binary,args,options)=>{calls.push({binary,args,options});return {status:0,stdout:args[0]==='--list'?toc:schema};};
  const r=await inspectRestoreArchive(path,{pgRestore:'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe',run});
  assert.match(r.archive_sha256,/^[a-f0-9]{64}$/);assert.equal(r.restore_executed,false);
  assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c.args),[['--list','--',path],['--schema-only','--file=-','--',path]]);
  assert.ok(calls.every(c=>c.options.shell===false));
  await assert.rejects(inspectRestoreArchive(path,{run:()=>({status:1,stderr:'credential-sentinel'})}),e=>e.message==='BUSCAG_ARCHIVE_READ_FAILED'&&!e.message.includes('credential-sentinel'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

import {assertArchiveProfile,containerArgs,assertContainer,localDockerArgs,restoreImage} from '../scripts/restore-supabase-local.mjs';
test('real archive profile fails closed without full Auth, matching major or exactly known extensions',()=>{
 const m=parseRestoreMetadata(toc+'7; 1259 5 TABLE auth identities supabase_auth_admin\n8; 0 5 TABLE DATA auth identities supabase_auth_admin',schema+'\nCREATE EXTENSION pg_stat_statements;\nCREATE EXTENSION pgcrypto;');
 assert.doesNotThrow(()=>assertArchiveProfile(m));
 for(const mutate of [m=>{m.source_server_version='18.6';},m=>{m.auth.uid_definition_in_schema=false;},m=>{m.auth.users_data=false;},m=>{m.extensions.push('unknown');}]){
  const changed=structuredClone(m);mutate(changed);assert.throws(()=>assertArchiveProfile(changed));
 }
 const ext=parseRestoreMetadata('1; 3079 1 EXTENSION - supabase_vault\n2; 0 0 COMMENT - EXTENSION pgcrypto',schema);
 assert.deepEqual(ext.owners_in_toc,[],'Extension/comment names are not role names');
});
test('restore target is a fresh local-only networkless container, immutable official image and read-only archive',()=>{
 const name='buscag-restore-'+'a'.repeat(32),archive='C:\\Users\\Valen M\\Downloads\\backup.dump';
 const args=containerArgs(name,archive,'local-only-test-password');
 assert.ok(args.includes('--network=none'));assert.ok(args.includes('--pull=never'));
 assert.ok(args.includes('type=bind,src='+archive+',dst=/review/backup.dump,readonly'));
 assert.ok(args.includes(restoreImage));assert.match(restoreImage,/^supabase\/postgres@sha256:[a-f0-9]{64}$/);
 assert.equal(args.includes('-p'),false);assert.equal(args.includes('--publish'),false);
 assert.equal(args.includes('55432'),false);assert.equal(args.includes('--privileged'),false);
 assert.deepEqual(localDockerArgs('win32'),['--host=npipe:////./pipe/docker_engine']);
 assert.deepEqual(localDockerArgs('linux'),['--host=unix:///var/run/docker.sock']);
 assert.throws(()=>containerArgs('existing-container',archive,'x'));
 assert.throws(()=>containerArgs(name,'C:\\a,b.dump','x'));
 const info={Config:{Labels:{'buscag.disposable':'true'}},HostConfig:{NetworkMode:'none',Tmpfs:{'/var/lib/postgresql/data':''}},Mounts:[{Type:'bind',Destination:'/review/backup.dump',RW:false}]};
 assert.doesNotThrow(()=>assertContainer(info,archive));
 for(const mutate of [i=>{i.HostConfig.NetworkMode='bridge';},i=>{i.Mounts[0].RW=true;},i=>{i.HostConfig.PortBindings={'5432/tcp':[]};},i=>{i.HostConfig.Tmpfs={};},i=>{i.Mounts.push({Type:'bind',Destination:'/var/run/docker.sock',RW:false});}]){
  const changed=structuredClone(info);mutate(changed);assert.throws(()=>assertContainer(changed,archive));
 }
});
