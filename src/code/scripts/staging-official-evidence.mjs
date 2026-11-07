// Offline, immutable official references. Never executes upstream SQL or downloads
// an operator-supplied URL. Hashes alone are insufficient: metadata is checked too.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {managedWiring} from './staging-catalog-review.mjs';
import {publicError,stagingStep} from './staging-tls.mjs';
const root=new URL('../supabase/reference/supabase-postgres/',import.meta.url);
const hash=(s,algorithm='sha256')=>createHash(algorithm).update(s).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function verifyOfficialBytes(file,bytes){
 const matches=value=>hash(value)===file.sha256&&hash(Buffer.concat([Buffer.from(`blob ${value.length}\0`),value]),'sha1')===file.git_blob;
 if(matches(bytes))return {bytes,normalizedCRLF:false};
 // Git autocrlf on Windows may change checkout line endings. Accept ONLY if
 // undoing CRLF conversion restores BOTH pinned upstream hashes exactly.
 const lf=Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'),'utf8');
 if(matches(lf))return {bytes:lf,normalizedCRLF:true};
 throw publicError('BUSCAG_OFFICIAL_INTEGRITY','La referencia oficial local no coincide con SHA-256 y blob Git fijados, incluso comprobando CRLF/LF. Revisa la copia de Alexis; no edites hashes ni omitas la validación.');
}
export async function officialRegistry(){
 const provenance=JSON.parse(await readFile(new URL('provenance.json',root),'utf8'));
 if(provenance.repository!=='supabase/postgres'||provenance.commit!=='c6226c631d3f9048586005f0bca8c9fc10a72940'||!Array.isArray(provenance.files))throw publicError('BUSCAG_OFFICIAL_PROVENANCE','El manifiesto local de procedencia oficial es desconocido o incompleto. Actualiza la copia de Alexis; no cambies la procedencia para aceptar archivos.');
 const texts={};
 let normalizedCRLFFiles=0;
 for(const file of provenance.files){
  if(!/^[a-zA-Z0-9_.-]+$/.test(file.file))throw publicError('BUSCAG_OFFICIAL_PATH','El manifiesto oficial local contiene una ruta no admitida. Revisa la copia de Alexis.');
  const bytes=await readFile(new URL(file.file,root));
  const verified=verifyOfficialBytes(file,bytes);
  if(verified.normalizedCRLF)normalizedCRLFFiles++;
  texts[file.file]=verified.bytes.toString('utf8');
 }
 const functions=[];
 for(const file of ['20261016000001_search_path_for_supa_functions.sql','schema-17.sql']){
  const pattern=/create(?:\s+or\s+replace)?\s+function\s+extensions\.([a-z_]+)\s*\(\s*\)\s+returns\s+event_trigger([\s\S]*?)\bas\s+(\$[a-z_]*\$)([\s\S]*?)\3/gi;
  for(const m of texts[file].matchAll(pattern)){
   if(!Object.values(managedWiring).some(w=>w[1]===`extensions.${m[1]}()`))continue;
   const header=m[2].toLowerCase().replaceAll("'",'').replace(/\s+/g,' ');
   if(!/language plpgsql/.test(header)||!/set search_path to pg_catalog, pg_temp/.test(header)||/security definer|strict|leakproof/.test(header))throw publicError('BUSCAG_OFFICIAL_HEADER','El parser local encontró un encabezado oficial no revisado. Verifica los archivos de Alexis; no cambies propiedades de funciones remotas.');
   functions.push({name:m[1],body_sha256:hash(m[4].replaceAll('\r\n','\n')),source:file,
    config:['search_path=pg_catalog, pg_temp']});
  }
 }
 if(new Set(functions.map(f=>f.name)).size!==6)throw publicError('BUSCAG_OFFICIAL_INCOMPLETE','El parser local no obtuvo las seis definiciones oficiales. Revisa la copia de referencias de Alexis.');
 // Official expected/evtrigs.out records BOTH owners for all six wrappers.
 for(const [name,wiring] of Object.entries(managedWiring)){
  const fn=wiring[1].split('.')[1].slice(0,-2);
  if(!texts['evtrigs.out'].split('\n').some(line=>new RegExp(`^\\s*${name}\\s*\\|\\s*supabase_admin\\s*\\|\\s*extensions\\s*\\|\\s*${fn}\\s*\\|\\s*supabase_admin\\s*$`).test(line)))throw publicError('BUSCAG_OFFICIAL_OWNERSHIP','La referencia local no acredita los propietarios esperados. Revisa el archivo oficial de pruebas; no alteres propietarios en Supabase.');
 }
 return {provenance,functions,normalizedCRLFFiles};
}
const aclEntry=(grantee,grantor)=>({grantee,grantor,privilege:'EXECUTE',grantable:false});
const aclEqual=(a,b)=>Array.isArray(a)&&a.length===b.length&&b.every(v=>a.some(x=>Object.keys(v).length===Object.keys(x).length&&Object.entries(v).every(([k,z])=>x[k]===z)));
export async function validateOfficialEvents(catalog,evidence,traceDb){
 const registry=await stagingStep(traceDb,'official.sources',()=>officialRegistry());
 return stagingStep(traceDb,'official.validate',async()=>{
 const events=evidence?.event_triggers??[];
 const raw=catalog.event_triggers??[];
 const checks=[];
 for(const [name,wiring] of Object.entries(managedWiring)){
  const e=events.find(t=>t.name===name),r=raw.find(t=>t.name===name);
  const variants=registry.functions.filter(f=>`extensions.${f.name}()`===wiring[1]);
  const source=e&&variants.find(f=>f.body_sha256===e.body_sha256&&equal(f.config,e.config));
  const failures=[];
  if(!e||!r)failures.push('missing_event');
  if(!e||!r||!equal([r.event,r.function,r.tags,r.enabled],[wiring[0],wiring[1],wiring[2],'O'])||
   !equal([e.event,`${e.schema}.${e.function}()`,e.tags,e.enabled],[wiring[0],wiring[1],wiring[2],'O']))failures.push('wiring');
  if(!source)failures.push('official_body_or_search_path');
  if(!e||e.event_owner!=='supabase_admin'||e.function_owner!=='supabase_admin')failures.push('owners');
  if(!e||e.arguments!==''||e.result!=='event_trigger'||e.language!=='plpgsql'||e.security_definer!==false||e.strict!==false||e.leakproof!==false||e.parallel!=='u'||e.volatility!=='v')failures.push('function_properties');
  // A schema dump alone does NOT prove historical ACLs. This narrow safety policy
  // permits only the PostgreSQL default (owner + PUBLIC EXECUTE, no grant option),
  // combined with verified INVOKER/event_trigger properties. Ordinary callers
  // cannot invoke an event_trigger function; unknown grants still block.
  if(!e||!aclEqual(e.acl,[aclEntry('PUBLIC','supabase_admin'),aclEntry('supabase_admin','supabase_admin')]))failures.push('acl');
  if(!e||e.extension_dependencies!==null)failures.push('extension_dependencies');
  checks.push({name,verified:failures.length===0,failures,source:source?.source??null,body_sha256:e?.body_sha256??null});
 }
 const context=evidence?.extensions_schema;
 const contextSafe=context?.owner==='postgres'&&context.anon_create===false&&context.auth_create===false&&
 evidence?.clients_can_become_admin?.anon===false&&evidence?.clients_can_become_admin?.authenticated===false;
 const exactSet=raw.length===6&&events.length===6&&new Set(raw.map(e=>e.name)).size===6&&new Set(events.map(e=>e.name)).size===6;
 return {verified:exactSet&&contextSafe&&checks.every(c=>c.verified),exact_event_set:exactSet,protected_context:contextSafe,
  checks,official_repository:registry.provenance.repository,official_commit:registry.provenance.commit,reference_crlf_files:registry.normalizedCRLFFiles};
 });
}
export function serviceVariantAllowed(name,evidence){
 const role=evidence?.service_role;
 if(!role||role.name!=='service_role'||role.super!==false||role.bypass!==true||role.login!==false||role.inherit!==false||
  evidence?.clients_can_become_service?.anon!==false||evidence?.clients_can_become_service?.authenticated!==false)return false;
 const expected=[aclEntry('postgres','postgres'),aclEntry('service_role','postgres')];
 if(name==='can_send_item_message')expected.push(aclEntry('authenticated','postgres'));
 else if(name!=='canonicalize_message_display')return false;
 return aclEqual(evidence.service_function_acls?.find(f=>f.name===name)?.acl,expected);
}
