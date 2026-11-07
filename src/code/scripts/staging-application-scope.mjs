// Bounded APPLICATION upgrade, not an equivalence/approval of legacy platform DDL.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {publicError,stagingStep} from './staging-tls.mjs';
export const applicationSources=Object.freeze({
 'proposals/20261106000000_secure_recovery.sql':'db4c8f76aebf8a77f4f4c563d2c2fedb58a0c68bf745cdab079e914b2130262e',
 'proposals/20261106001000_community_safety.sql':'24568b8415834492f8257b6403d0c27bae3ae125646647e1a0794cccc0dee903',
});
// Exact observed profile, backed by immutable current/historical official sources.
// Unknown bodies/configs/metadata never qualify. Default planning stays stricter.
export const preservedBodies=Object.freeze({
 issue_graphql_placeholder:'80e0c97f0a475697c1b517e0d27887bfa0c2baf138229735a58a345d2168505b',
 issue_pg_cron_access:'00db212b76cecd4b0794b2f20c414ab4988d675959747cd12d3eb4c6d6736f38',
 issue_pg_graphql_access:'03de03bb70da1d448f7a674215d1b63a924dc7115db657dae34b1aa8977e030e',
 issue_pg_net_access:'754e58111dbe32030af4d91591dfd78cb3cf8e8f4f56a5fcc199bb0cf7f4ac2b',
 pgrst_ddl_watch:'de987df746eb39647098459e7993bd8595e592969b0cd647828a3d13d37cffe0',
 pgrst_drop_watch:'791b41f0632fc86e0fc86a303ec0fd710c4e2ecf947a23422dae2b7a2c122f1d',
});
export const applicationContextChecks=Object.freeze(['operator','origin','events_enabled','no_temp_objects','safe_function_defaults']);
export const sessionContextSql=`select jsonb_build_object(
 'version',1,
 'operator',current_user='postgres' and session_user='postgres',
 'origin',current_setting('session_replication_role')='origin',
 'events_enabled',coalesce(current_setting('event_triggers',true),'on')='on',
 'no_temp_objects',not exists(select from pg_catalog.pg_depend
 where refclassid='pg_catalog.pg_namespace'::regclass and refobjid=pg_catalog.pg_my_temp_schema())
 and not exists(select from pg_catalog.pg_class where relnamespace=pg_catalog.pg_my_temp_schema())
 and not exists(select from pg_catalog.pg_proc where pronamespace=pg_catalog.pg_my_temp_schema())
 and not exists(select from pg_catalog.pg_type where typnamespace=pg_catalog.pg_my_temp_schema()),
 'safe_function_defaults',not exists(
 select from pg_catalog.pg_default_acl d cross join lateral pg_catalog.aclexplode(d.defaclacl) a
 where d.defaclrole='postgres'::regrole and d.defaclobjtype='f'
 and (d.defaclnamespace=0 or d.defaclnamespace in(pg_catalog.to_regnamespace('public'),pg_catalog.to_regnamespace('buscag_private')))
 and (a.grantor<>'postgres'::regrole or a.grantee not in(0,'postgres'::regrole::oid,'anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid)
 or a.privilege_type<>'EXECUTE' or a.is_grantable))
 ) as application_context`;
export function applicationSourceMatches(file,sql){
 return Object.hasOwn(applicationSources,file)&&typeof sql==='string'&&createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex')===applicationSources[file];
}
export async function readApplicationContext(db){
 return stagingStep(db,'application.context',async()=>{
  const r=await db.query(sessionContextSql);
  const value=r?.rows?.length===1?r.rows[0].application_context:null;
  if(!value||value.version!==1||!applicationContextChecks.every(k=>typeof value[k]==='boolean'))
   throw publicError('BUSCAG_APPLICATION_CONTEXT','La consulta de contexto no devolvió los indicadores esperados. No se preparó una actualización de aplicación.');
  const rejected=applicationContextChecks.filter(k=>value[k]!==true);
  if(rejected.length)throw publicError('BUSCAG_APPLICATION_SESSION','Contexto de aplicación rechazado: '+rejected.join(', ')+'. Se requiere postgres, sesión sin objetos temporales, origin, triggers activos y defaults revisados. No borres objetos ni amplíes permisos para forzar compatibilidad.');
  return value;
 });
}
export async function verifyApplicationSources(){
 for(const file of Object.keys(applicationSources)){
  const sql=await readFile(new URL('../supabase/'+file,import.meta.url),'utf8');
  if(!applicationSourceMatches(file,sql))
   throw publicError('BUSCAG_APPLICATION_SOURCE','Cambió una migración propia respecto de la revisión acotada. Requiere revisar compatibilidad; no se omiten diferencias.');
 }
}
export async function applicationPreservation(catalog,evidence,official,context){
 await verifyApplicationSources();
 const failures=[];
 // Real compatibility tests cover these two server majors, not guessed versions.
 if(!Number.isInteger(evidence?.server_version_num)||evidence.server_version_num<170000||evidence.server_version_num>=190000)failures.push('server_major_not_rehearsed');
 if(!official?.exact_event_set||!official?.protected_context)failures.push('platform_context');
 const role=evidence?.service_role;
 if(!role||role.name!=='service_role'||role.super!==false||role.login!==false||role.bypass!==true||typeof role.inherit!=='boolean'||
  evidence?.clients_can_become_service?.anon!==false||evidence?.clients_can_become_service?.authenticated!==false)failures.push('service_role_context');
 if(context?.version!==1||!applicationContextChecks.every(k=>context[k]===true))failures.push('operator_session');
 for(const [name,hash] of Object.entries(preservedBodies)){
  const event=evidence?.event_triggers?.find(e=>e.name===name),check=official?.checks?.find(e=>e.name===name);
  const expected=['issue_graphql_placeholder','issue_pg_cron_access'].includes(name)?['search_path','superseded_body']:['search_path'];
  if(['issue_pg_cron_access','issue_pg_net_access'].includes(name)&&check?.application_acl_profile==='supabase_owner_transfer_dashboard_execute')expected.push('acl');
  expected.sort();
  if(!event||event.body_sha256!==hash||JSON.stringify(event.config)!==JSON.stringify(['search_path=""'])||
   !check?.body_sources?.length||JSON.stringify([...(check?.failures??[])].sort())!==JSON.stringify(expected))failures.push(name);
 }
 if(catalog?.public_schema?.anon_create!==false||catalog?.public_schema?.auth_create!==false)failures.push('public_schema');
 return {eligible:failures.length===0,profile:'prueba_observed_six_v1',failures,
  scope:'only_pinned_secure_recovery_and_community_safety',
  failure_details:failures.filter(name=>Object.hasOwn(preservedBodies,name)).map(name=>{
   const check=official?.checks?.find(c=>c.name===name);
   return {name,validation_failures:check?.failures??['missing_event'],acl_review:check?.acl_review??null};
  }),
  platform_secure:false,wrappers_modified:false,
  execution:'postgres_no_temp_objects_origin_events_enabled_known_defaults_no_extension_ddl',
  residual_risk:'Legacy platform search_path and superseded bodies remain uncorrected. This is not approval for general DDL, extensions, cron changes or other migrations.'};
}
export function applicationSessionGuard(){
 return `do $application_session$ declare c jsonb; begin
 select application_context into c from (${sessionContextSql}) context;
 if ${applicationContextChecks.map(k=>`not coalesce((c->>'${k}')::boolean,false)`).join('\n or ')}
 then raise exception 'Application upgrade requires postgres origin session, enabled events, reviewed defaults and NO temporary objects';end if;
 end $application_session$;`;
}
