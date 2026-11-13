// Linux disposable host only. Preflight defaults to NO pull/restore/network work.
import {spawnSync} from 'node:child_process';
import {stat,statfs,readFile,mkdir,realpath,writeFile,lstat} from 'node:fs/promises';
import {tmpdir,totalmem} from 'node:os';
import {dirname,resolve,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {restoreImage,localDockerArgs,restoreLocalArchive} from './restore-supabase-local.mjs';
const repository=fileURLToPath(new URL('../../../',import.meta.url));
export const minimumDiskBytes=20*1024**3,minimumMemoryBytes=4*1024**3;
export function within(path,root){const rel=relative(root,path);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));}
export function resourceBlockers({dockerReady,freeDiskBytes,memoryBytes,archiveAvailable,archivePrivate,platform}){
 return [platform!=='linux'?'linux_required':null,!dockerReady?'local_docker_unavailable':null,
  freeDiskBytes===null?'docker_disk_unknown':freeDiskBytes<minimumDiskBytes?'insufficient_docker_disk':null,
  memoryBytes<minimumMemoryBytes?'insufficient_memory':null,!archiveAvailable?'private_archive_unavailable':null,
  archiveAvailable&&!archivePrivate?'archive_inside_repository':null].filter(Boolean);
}
export function dockerArchiveReader(archive,run=spawnSync){
 return (_binary,args,options)=>{
  if(!((args.length===3&&args[0]==='--list')||(args.length===4&&args[0]==='--schema-only'&&args[1]==='--file=-'))||args.at(-2)!=='--'||args.at(-1)!==archive)
   throw Error('BUSCAG_OFFLINE_READER_ARGUMENTS');
  const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
  return run('docker',[...localDockerArgs('linux'),'run','--rm','--pull=never','--platform=linux/amd64',
   '--network=none','--read-only','--mount',`type=bind,src=${archive},dst=/review/backup.dump,readonly`,
   '--entrypoint=pg_restore',restoreImage,...args.slice(0,-2),'--','/review/backup.dump'],{...options,env,shell:false});
 };
}
export async function cloudPreflight(backup){
 const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
 const r=spawnSync('docker',[...localDockerArgs('linux'),'info','--format','{"root":{{json .DockerRootDir}},"driver":{{json .Driver}},"memory":{{json .MemTotal}}}'],{encoding:'utf8',env,shell:false,timeout:15000});
 let info=null;try{if(r.status===0)info=JSON.parse(r.stdout);}catch{}
 let freeDiskBytes=null;try{const fs=await statfs(info.root);freeDiskBytes=Number(fs.bavail)*Number(fs.bsize);}catch{}
 let hostFreeDiskBytes=null;try{const fs=await statfs(tmpdir());hostFreeDiskBytes=Number(fs.bavail)*Number(fs.bsize);}catch{}
 let memoryBytes=info?.memory??totalmem();
 try{const limit=(await readFile('/sys/fs/cgroup/memory.max','utf8')).trim();if(/^\d+$/.test(limit))memoryBytes=Math.min(memoryBytes,Number(limit));}catch{}
 let archiveAvailable=false,archivePrivate=false,archive=null;
 if(backup)try{archive=await realpath(resolve(backup));const s=await stat(archive);archiveAvailable=s.isFile()&&s.size>0;archivePrivate=!within(archive,await realpath(repository));}catch{}
 const conditions={platform:process.platform,dockerReady:Boolean(info),freeDiskBytes,memoryBytes,archiveAvailable,archivePrivate};
 return {version:1,mode:'cloud_preflight',image:restoreImage,...conditions,host_free_disk_bytes:hostFreeDiskBytes,storage_driver:info?.driver??null,
  minimum_disk_bytes:minimumDiskBytes,minimum_memory_bytes:minimumMemoryBytes,
  blockers:resourceBlockers(conditions),restore_completed:false,backup_verified:false,
  supabase_remote_contacted:false,personal_data_exported:false,archive_path:archive};
}
export async function runCloud({backup,result,restore=false}){
 const target=resolve(result??join(tmpdir(),'buscag-cloud-'+randomUUID(),'result.json'));
 if(within(target,repository))throw Error('BUSCAG_RESULT_MUST_BE_OUTSIDE_REPOSITORY');
 await mkdir(dirname(target),{recursive:true,mode:0o700});
 if(within(await realpath(dirname(target)),await realpath(repository)))throw Error('BUSCAG_RESULT_MUST_BE_OUTSIDE_REPOSITORY');
 try{if((await lstat(target)).isSymbolicLink())throw Error('BUSCAG_RESULT_SYMLINK');}catch(e){if(e.code!=='ENOENT')throw e;}
 const pre=await cloudPreflight(backup),{archive_path:archive,...safe}=pre;
 const save=async value=>{await writeFile(target,JSON.stringify(value,null,2)+'\n',{mode:0o600});return value;};
 if(!restore||pre.blockers.length)return save({...safe,status:pre.blockers.length?'blocked':'preflight_passed'});
 if(archive.includes(','))return save({...safe,status:'blocked',blockers:['archive_path_contains_comma']});
 const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
 // Registry pull only. No container exists yet; never accesses Supabase.
 const pull=spawnSync('docker',[...localDockerArgs('linux'),'pull','--platform=linux/amd64',restoreImage],{encoding:'utf8',env,shell:false,timeout:600000,maxBuffer:16*1024*1024});
 if(pull.error||pull.status!==0)return save({...safe,status:'blocked',blockers:['official_image_pull_failed'],failed_stage:'image'});
 try{
  const restored=await restoreLocalArchive(archive,{archiveReader:dockerArchiveReader(archive)});
  // Public result excludes private filesystem locations and missing role names.
  const {private_directory,dependencies,...publicResult}=restored;
  return save({...safe,...publicResult,status:'restored_pending_semantic_review',semantic_validation:'pending_catalog_acl_and_auth_behaviour',backup_verified:false});
 }catch(error){
  // Detailed logs stay in the private temp directory used by the shared runner.
  return save({...safe,status:'restore_failed',restore_completed:false,backup_verified:false,
   blockers:['restore_or_archive_profile_failed'],failed_stage:error.restoreSummary?.failed_stage??'archive_inspection',
   code:error.restoreSummary?.code??'BUSCAG_ARCHIVE_INSPECTION_FAILED',next_step:'Review private local runner logs; do not publish SQL or COPY errors.'});
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);let backup,result,restore=false,valid=true,modeSeen=false;
 for(let i=0;i<args.length;i++){
  if(['--backup','--result'].includes(args[i])){const option=args[i],value=args[++i];if(!value||value.startsWith('--')){valid=false;break;}if(option==='--backup'){if(backup)valid=false;backup=value;}else{if(result)valid=false;result=value;}}
  else if(['--check','--restore'].includes(args[i])){if(modeSeen)valid=false;modeSeen=true;restore=args[i]==='--restore';}
  else valid=false;
 }
 if(!valid){console.error('Uso: node scripts/restore-supabase-cloud.mjs --check|--restore [--backup /ruta/privada/backup.dump] [--result /ruta/privada/result.json]');process.exitCode=1;}
 else try{const r=await runCloud({backup,result,restore});console.log(JSON.stringify(r,null,2));if(r.status==='blocked'||r.status==='restore_failed')process.exitCode=1;}
 catch{console.error('BUSCAG_CLOUD_PREFLIGHT_FAILED: revisar Docker local y rutas privadas fuera del repositorio; no se ejecutó SQL remoto.');process.exitCode=1;}
}
