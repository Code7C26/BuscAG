// Offline archive inventory only. Never connects, executes SQL or verifies restore.
import {spawnSync} from 'node:child_process';
import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const ident='(?:"(?:[^"\\n]|"")+"|[a-zA-Z_][a-zA-Z_0-9$-]*)';
const clean=s=>s.startsWith('"')?s.slice(1,-1).replaceAll('""','"'):s;
export function parseRestoreMetadata(toc,sql){
 const rows=toc.split(/\r?\n/).filter(s=>/^\d+;\s/.test(s));
 const version=label=>toc.match(new RegExp(`^;\\s*${label}:?\\s+(\\d+(?:\\.\\d+){0,2})`,'mi'))?.[1]??null;
 const extensions=[...sql.matchAll(new RegExp(`^CREATE EXTENSION(?: IF NOT EXISTS)? (${ident})(?=\\s|;)`,'gm'))].map(m=>clean(m[1]));
 const owners=rows.filter(line=>/; \d+ \d+ (?:SCHEMA|TABLE(?: DATA)?|FUNCTION|VIEW|SEQUENCE|MATERIALIZED VIEW|TYPE|DOMAIN) /.test(line)).flatMap(line=>{const m=line.match(new RegExp(`\\s(${ident})$`));return m?[clean(m[1])]:[];});
 const has=pattern=>rows.some(line=>pattern.test(line));
 const schemas=['public','buscag_private','auth','storage'].map(name=>({name,
  schema_entry:has(new RegExp(`; \\d+ \\d+ SCHEMA - ${name} `)),
  tables:rows.filter(s=>new RegExp(`; \\d+ \\d+ TABLE ${name} `).test(s)).length,
  table_data_entries:rows.filter(s=>new RegExp(`; \\d+ \\d+ TABLE DATA ${name} `).test(s)).length,
 }));
 return {source_server_version:version('Dumped from database version'),dump_client_version:version('Dumped by pg_dump version'),
  toc_entries:rows.length,extensions:[...new Set(extensions)].sort(),owners_in_toc:[...new Set(owners)].sort(),
  role_inventory_complete:false,schemas,
  auth:{uid_definition_in_schema:/^CREATE(?: OR REPLACE)? FUNCTION (?:auth|"auth")\.(?:uid|"uid")\(\)/m.test(sql),
   users_table:has(/; \d+ \d+ TABLE auth users /),users_data:has(/; \d+ \d+ TABLE DATA auth users /),
   identities_table:has(/; \d+ \d+ TABLE auth identities /),identities_data:has(/; \d+ \d+ TABLE DATA auth identities /)},
  scope:'metadata_only_not_archive_or_restore_verification',restore_executed:false,backup_verified:false,
 };
}
export async function inspectRestoreArchive(file,{pgRestore='pg_restore',run=spawnSync}={}){
 const path=resolve(file),info=await stat(path);
 if(!info.isFile()||!info.size)throw Error('BUSCAG_ARCHIVE_NOT_REGULAR_FILE');
 const invoke=args=>{
  const result=run(pgRestore,args,{encoding:'utf8',maxBuffer:64*1024*1024,windowsHide:true,shell:false,timeout:120000});
  if(result.error||result.status!==0)throw Error('BUSCAG_ARCHIVE_READ_FAILED');
  return result.stdout;
 };
 // No --dbname, connection option, shell, SQL execution or row-data extraction.
 const toc=invoke(['--list','--',path]);
 const sql=invoke(['--schema-only','--file=-','--',path]);
 const digest=createHash('sha256');
 for await(const chunk of createReadStream(path))digest.update(chunk);
 const after=await stat(path);
 if(after.size!==info.size||after.mtimeMs!==info.mtimeMs)throw Error('BUSCAG_ARCHIVE_CHANGED_DURING_READ');
 return {archive_sha256:digest.digest('hex'),archive_bytes:info.size,...parseRestoreMetadata(toc,sql)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(![1,3].includes(args.length)||(args.length===3&&args[1]!=='--pg-restore')){
  console.error('Uso: node scripts/inspect-restore-archive.mjs <archivo.dump> [--pg-restore <pg_restore.exe>]');process.exitCode=1;
 }else try{console.log(JSON.stringify(await inspectRestoreArchive(args[0],{pgRestore:args[2]??'pg_restore'}),null,2));}
 catch{console.error('BUSCAG_ARCHIVE_INSPECTION_FAILED: comprobar archivo, pg_restore y versiones localmente. No se ejecutó SQL ni se verificó restauración. No compartir stderr/SQL privados.');process.exitCode=1;}
}
