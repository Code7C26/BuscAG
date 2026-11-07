// Local Docker ONLY. Never connects to Windows 55432, Supabase or another daemon.
import {spawnSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectRestoreArchive} from './inspect-restore-archive.mjs';
export const restoreImage='supabase/postgres@sha256:5a4314708484bec672de2c09653a5c01fb1c84a998564ac231b0325e2238ed5b';
const requiredExtensions=['pg_stat_statements','pgcrypto','supabase_vault','uuid-ossp'];
export function assertArchiveProfile(meta){
 if(!/^17\./.test(meta.source_server_version??'')||!meta.auth?.uid_definition_in_schema||!meta.auth.users_data||!meta.auth.identities_data)
  throw Error('BUSCAG_RESTORE_SOURCE_OR_AUTH');
 if(JSON.stringify([...meta.extensions].sort())!==JSON.stringify([...requiredExtensions].sort()))throw Error('BUSCAG_RESTORE_UNKNOWN_EXTENSIONS');
}
export function localDockerArgs(platform=process.platform){return [platform==='win32'?'--host=npipe:////./pipe/docker_engine':'--host=unix:///var/run/docker.sock'];}
export function containerArgs(name,archive,password){
 if(!/^buscag-restore-[a-f0-9]{32}$/.test(name)||archive.includes(','))throw Error('BUSCAG_RESTORE_ARGUMENTS');
 return ['run','-d','--pull=never','--platform=linux/amd64','--name',name,'--label','buscag.disposable=true','--network=none',
  '--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=2g','--mount',`type=bind,src=${archive},dst=/review/backup.dump,readonly`,
  ...['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'].flatMap(k=>['--env',k+'=']),
  '--env','POSTGRES_USER=supabase_admin','--env','POSTGRES_DB=postgres','--env','POSTGRES_PASSWORD='+password,
  restoreImage,'postgres','-c','config_file=/etc/postgresql/postgresql.conf','-c','listen_addresses='];
}
export function assertContainer(info,archive){
 if(info.Config?.Labels?.['buscag.disposable']!=='true'||info.HostConfig?.NetworkMode!=='none'||
  info.HostConfig?.PublishAllPorts||Object.keys(info.HostConfig?.PortBindings??{}).length||
  !Object.hasOwn(info.HostConfig?.Tmpfs??{},'/var/lib/postgresql/data'))throw Error('BUSCAG_RESTORE_ISOLATION');
 const mounts=info.Mounts??[],binds=mounts.filter(m=>m.Type==='bind');
 if(binds.length!==1||binds[0].Destination!=='/review/backup.dump'||binds[0].RW!==false||
  mounts.some(m=>m.Destination==='/var/run/docker.sock'))throw Error('BUSCAG_RESTORE_MOUNTS');
 // Docker Desktop may translate a Windows Source path; the source is supplied
 // directly by our run command and cannot be replaced by an existing container.
 if(!archive)throw Error('BUSCAG_RESTORE_MOUNTS');
}
export async function restoreLocalArchive(file,{pgRestore='pg_restore',archiveReader}={}){
 const archive=resolve(file),meta=await inspectRestoreArchive(archive,{pgRestore,run:archiveReader});assertArchiveProfile(meta);
 const name='buscag-restore-'+randomUUID().replaceAll('-',''),database='restore_'+randomUUID().replaceAll('-','');
 const dir=await mkdtemp(join(tmpdir(),'buscag-restore-private-'));
 const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
 let stage='image',started=false;
 const call=(args,{allowFailure=false,timeout=120000}={})=>{
  const r=spawnSync('docker',[...localDockerArgs(),...args],{encoding:'utf8',shell:false,env,timeout,maxBuffer:16*1024*1024,windowsHide:true});
  if((r.error||r.status!==0)&&!allowFailure){const error=Error('BUSCAG_LOCAL_RESTORE_FAILED');error.privateDetail=r.stderr??'';throw error;}
  return r;
 };
 const sql=(db,text,options)=>call(['exec',name,'psql','-X','--no-password','--host=/var/run/postgresql','--username=supabase_admin','--dbname='+db,'--set=ON_ERROR_STOP=1','-qAt','-c',text],options);
 const summary={container:name,database,archive_sha256:meta.archive_sha256,image:restoreImage,
  source_server_version:meta.source_server_version,dump_client_version:meta.dump_client_version,toc_entries:meta.toc_entries,
  restore_completed:false,backup_verified:false,
  semantic_validation:'pending','remote_contacted':false,private_directory:dir};
 try{
  // Pull uses the registry only, before the container exists. Runtime has no network.
  call(['pull','--platform=linux/amd64',restoreImage],{timeout:600000});
  stage='bootstrap';call(containerArgs(name,archive,randomBytes(32).toString('hex')));started=true;
  const info=JSON.parse(call(['inspect',name]).stdout)[0];assertContainer(info,archive);
  let ready=false;
  for(let attempt=0;attempt<90;attempt++){
   const main=call(['exec',name,'cat','/proc/1/comm'],{allowFailure:true,timeout:5000});
   if(main.status!==0||main.stdout.trim()!=='postgres'){await new Promise(r=>setTimeout(r,2000));continue;}
   const r=sql('postgres',"select 1 where exists(select from pg_roles where rolname='supabase_auth_admin') and exists(select from pg_roles where rolname='supabase_storage_admin') and exists(select from pg_roles where rolname='dashboard_user')",{allowFailure:true,timeout:5000});
   if(r.status===0&&r.stdout.trim()==='1'){ready=true;break;}
   await new Promise(r=>setTimeout(r,2000));
  }
  if(!ready)throw Error('BUSCAG_RESTORE_BOOTSTRAP_NOT_READY');
  stage='dependencies';
  const actual=JSON.parse(sql('postgres',`select json_build_object('version',current_setting('server_version'),
   'extensions',(select json_agg(name) from pg_available_extensions),'roles',(select json_agg(rolname) from pg_roles))`).stdout);
  summary.actual_server_version=actual.version;
  summary.dependencies={missing_extensions:meta.extensions.filter(e=>!actual.extensions.includes(e)),
   missing_owner_roles:meta.owners_in_toc.filter(r=>!actual.roles.includes(r))};
  if(!/^17\./.test(actual.version)||summary.dependencies.missing_extensions.length||summary.dependencies.missing_owner_roles.length)throw Error('BUSCAG_RESTORE_DEPENDENCIES');
  stage='archive_reader';call(['exec',name,'pg_restore','--list','/review/backup.dump']);
  stage='create_empty_database';call(['exec',name,'createdb','--host=/var/run/postgresql','--username=supabase_admin','--template=template0','--owner=postgres',database]);
  stage='full_restore';call(['exec',name,'pg_restore','--host=/var/run/postgresql','--username=supabase_admin','--dbname='+database,'--exit-on-error','--single-transaction','/review/backup.dump'],{timeout:600000});
  stage='checks';
  summary.checks=JSON.parse(sql(database,`select json_build_object(
   'auth_uid',to_regprocedure('auth.uid()') is not null,
   'auth_users',(select count(*) from auth.users),'auth_identities',(select count(*) from auth.identities),
   'items',(select count(*) from public.items),'profiles',(select count(*) from public.profiles),'messages',(select count(*) from public.messages),
   'app_rls_off',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and
    (n.nspname='buscag_private' or (n.nspname='public' and c.relname in('items','profiles','messages','notifications','push_subscriptions'))) and not c.relrowsecurity),
   'extensions',(select json_agg(extname) from pg_extension))`).stdout);
  summary.auth_behaviour=JSON.parse(sql(database,`begin read only;
   set local role authenticated;
   set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
   set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
   select json_build_object('uid_from_real_function',auth.uid()='00000000-0000-4000-8000-000000000001'::uuid,
    'foreign_profiles_hidden',not exists(select id from public.profiles where id<>auth.uid()));rollback;`).stdout);
  if(summary.auth_behaviour.uid_from_real_function!==true||summary.auth_behaviour.foreign_profiles_hidden!==true)throw Error('BUSCAG_RESTORE_AUTH_RLS');
  if(!summary.checks.auth_uid||summary.checks.app_rls_off!==0||meta.extensions.some(e=>!summary.checks.extensions.includes(e)))throw Error('BUSCAG_RESTORE_CHECKS');
  const digest=createHash('sha256');for await(const chunk of createReadStream(archive))digest.update(chunk);
  if(digest.digest('hex')!==meta.archive_sha256)throw Error('BUSCAG_RESTORE_ARCHIVE_CHANGED');
  summary.restore_completed=true;
  summary.semantic_validation='requires_catalog_acl_and_behaviour_review_on_this_restored_database';
  await writeFile(join(dir,'result.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});return summary;
 }catch(error){
  summary.failed_stage=stage;summary.code=/^BUSCAG_[A-Z_]+$/.test(error.message)?error.message:'BUSCAG_LOCAL_RESTORE_FAILED';
  await writeFile(join(dir,'result.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});
  await writeFile(join(dir,'failure.private.log'),error.privateDetail??'',{mode:0o600});
  if(started){const logs=call(['logs',name],{allowFailure:true});await writeFile(join(dir,'bootstrap.private.log'),(logs.stdout??'')+(logs.stderr??''),{mode:0o600});}
  const failure=Error('Restauración local detenida en '+stage+'. Informe privado: '+join(dir,'result.json'));failure.restoreSummary=summary;throw failure;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(![1,3].includes(args.length)||(args.length===3&&args[1]!=='--pg-restore')){console.error('Uso: node scripts/restore-supabase-local.mjs <backup.dump> [--pg-restore <pg_restore.exe>]');process.exitCode=1;}
 else try{console.log(JSON.stringify(await restoreLocalArchive(args[0],{pgRestore:args[2]??'pg_restore'}),null,2));}
 catch(e){console.error(e.message.startsWith('Restauración local detenida')?e.message:'BUSCAG_LOCAL_RESTORE_PREFLIGHT: revisar archivo, herramienta y perfil de origen; no se ejecutó SQL remoto.');process.exitCode=1;}
}
