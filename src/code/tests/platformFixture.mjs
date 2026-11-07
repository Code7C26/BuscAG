// Compatibility fixture ONLY. Install exact observed bodies in a disposable DB.
// Never execute full upstream migrations, call this on a remote DB or alter Supabase.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {officialRegistry,verifyOfficialBytes} from '../scripts/staging-official-evidence.mjs';
import {preservedBodies} from '../scripts/staging-application-scope.mjs';
import {managedWiring} from '../scripts/staging-catalog-review.mjs';
export async function observedPlatformDefinitions(){
 const registry=await officialRegistry(),rows=[];
 for(const [name,hash] of Object.entries(preservedBodies)){
  const fn=managedWiring[name][1].split('.')[1].slice(0,-2);
  const source=[...registry.functions,...registry.historical].find(f=>f.name===fn&&f.body_sha256===hash);
  if(!source)throw Error('Unknown fixture body');
  const file=registry.provenance.files.find(f=>f.file===source.source);
  const raw=await readFile(new URL('../supabase/reference/supabase-postgres/'+file.file,import.meta.url));
  const text=verifyOfficialBytes(file,raw).bytes.toString();
  const pattern=/create(?:\s+or\s+replace)?\s+function\s+extensions\.([a-z_]+)\s*\(\s*\)\s+returns\s+event_trigger[\s\S]*?\bas\s+(\$[a-z_]*\$)([\s\S]*?)\2/gi;
  const match=[...text.matchAll(pattern)].find(m=>m[1]===fn&&createHash('sha256').update(m[3]).digest('hex')===hash);
  if(!match||match[3].includes('$fixture_body$'))throw Error('Fixture parser failed');
  rows.push({name,fn,body:match[3],wiring:managedWiring[name]});
 }
 return rows;
}
export async function installObservedPlatform(db){
 const definitions=await observedPlatformDefinitions();
 await db.query(`do $$begin if not exists(select from pg_roles where rolname='supabase_admin') then create role supabase_admin superuser nologin;end if;end$$;
 create schema extensions authorization postgres;
 grant usage on schema extensions to anon,authenticated;
 grant execute on function public.can_send_item_message(uuid,uuid),public.canonicalize_message_display() to service_role;
 set role supabase_admin;`);
 try{
  for(const {name,fn,body,wiring} of definitions){
   await db.query(`create function extensions.${fn}() returns event_trigger language plpgsql
    set search_path to '' as $fixture_body$${body}$fixture_body$;
    grant execute on function extensions.${fn}() to postgres with grant option;
    create event trigger ${name} on ${wiring[0]} ${wiring[2]?`when tag in (${wiring[2].map(t=>"'"+t+"'").join(',')})`:''}
    execute function extensions.${fn}();`);
  }
 }finally{await db.query('reset role');}
}
