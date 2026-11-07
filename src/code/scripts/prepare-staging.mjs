// Explicit staging-only operator tool. No dotenv, VITE credentials or production fallback.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {checkServerIdentity} from 'node:tls';
import {loadStagingCa,publicError,stageFailure,formatStagingDiagnostic} from './staging-tls.mjs';
import {withStagingSession,withStagingRollback} from './staging-session.mjs';
import {createRequire} from 'node:module';
export const PRODUCTION_REF='hczcqtodcnurdrroczle';
export const files=[
  'migrations/20261016000000_notification_permissions.sql',
  'migrations/20261103000000_secure_items_messages.sql',
  'migrations/20261103001000_private_profiles_public_directory.sql',
  'migrations/20261103002000_secure_notifications.sql',
  'migrations/20261103003000_ensure_private_push_subscriptions.sql',
  'proposals/20261104000000_message_receipts.sql',
  'proposals/20261104001000_trusted_matches.sql',
  'proposals/20261104002000_publication_receipts.sql',
  'proposals/20261104003000_validate_legacy_compatible_writes.sql'
];
const read=path=>readFile(new URL('../supabase/'+path,import.meta.url),'utf8');
const hash=text=>createHash('sha256').update(text).digest('hex');
const requireState=(condition,message)=>{if(!condition)throw publicError('BUSCAG_PREFLIGHT',message);};
export function connectionConfig(value,ref,ca){
  requireState(/^[a-z0-9]{20}$/.test(ref??'')&&ref!==PRODUCTION_REF,'Referencia staging inválida o de producción.');
  let url;try{url=new URL(value);}catch{throw publicError('BUSCAG_PREFLIGHT','Configura BUSCAG_STAGING_DATABASE_URL fuera de Git.');}
  const direct=url.hostname===`db.${ref}.supabase.co`;
  const pooler=/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname);
  let user;
  try{user=decodeURIComponent(url.username);decodeURIComponent(url.password);}
  catch{throw publicError('BUSCAG_URI_ENCODING','La URI contiene escapes % inválidos o bytes no UTF-8 en las credenciales. Codifica la contraseña original una sola vez con encodeURIComponent; un % literal debe ser %25. No imprimas la URI.');}
  requireState(url.protocol==='postgresql:'||url.protocol==='postgres:','Sólo PostgreSQL.');
  requireState((direct&&user==='postgres')||(pooler&&user===`postgres.${ref}`),'Host/usuario no identifica el proyecto staging esperado.');
  requireState(url.pathname==='/postgres'&&url.password&&!url.hash,'Base o autenticación inválida.');
  requireState(!url.port||url.port==='5432','Usa conexión directa o pooler de sesión, puerto 5432; no transaction pooler.');
  requireState([...url.searchParams.keys()].every(k=>k==='sslmode')&&(!url.searchParams.has('sslmode')||['require','verify-full'].includes(url.searchParams.get('sslmode'))),'Parámetros de conexión no admitidos.');
  url.search='';
  return {connectionString:url.toString(),ssl:{...(ca?{ca}:{}),rejectUnauthorized:true,servername:url.hostname,checkServerIdentity,minVersion:'TLSv1.2'},connectionTimeoutMillis:15000,query_timeout:120000,application_name:'buscag-staging-preparation'};
}
function functionBody(sql,name){
  const start=sql.indexOf(`function public.${name}()`);requireState(start>=0,'Función de referencia ausente.');
  const body=sql.slice(start).match(/as \$\$([\s\S]*?)\$\$/i);requireState(body,'Cuerpo de referencia ausente.');return body[1].replace(/\r\n/g,'\n').trim();
}
async function verifyBootstrap(db){
  const extra=(await db.query(`select count(*)::int n from pg_trigger where not tgisinternal
    and tgrelid in (to_regclass('public.items'),to_regclass('public.profiles'),to_regclass('public.messages'),to_regclass('public.notifications'),to_regclass('public.push_subscriptions'),to_regclass('auth.users'))
    and tgname not in ('on_auth_user_created','on_item_recovered','on_message_created','canonicalize_message_display','buscag_enqueue_match_insert','buscag_enqueue_match_edit','validate_item_content_write','ensure_recovered_notice_text')`)).rows[0];
  requireState(extra.n===0,'Triggers adicionales: revisar posibles efectos externos antes de instalar o probar.');
  const roles=(await db.query("select count(*)::int n from pg_roles where rolname in ('anon','authenticated') and not rolsuper and not rolbypassrls")).rows[0];
  requireState(roles.n===2,'Roles API ausentes o privilegiados.');
  const bootstrap=await read('migrations/20261014000000_dynamic_database.sql');
  const patch=await read(files[0]);
  for(const name of ['handle_new_auth_user','notify_message_recipient','notify_item_recovered']){
    const result=await db.query(`select p.prosrc,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) owner
      from pg_proc p where p.oid=to_regprocedure($1)`,[`public.${name}()`]);
    const row=result.rows[0];
    const allowed=[functionBody(bootstrap,name)];if(name==='notify_item_recovered')allowed.push(functionBody(patch,name));
    requireState(row&&row.prosecdef&&row.owner==='postgres'&&row.proconfig?.includes('search_path=""')&&allowed.includes(row.prosrc.replace(/\r\n/g,'\n').trim()),`Revisar función bootstrap: ${name}; no se reemplazará automáticamente.`);
  }
  for(const [table,trigger,fn] of [['auth.users','on_auth_user_created','handle_new_auth_user'],['public.messages','on_message_created','notify_message_recipient'],['public.items','on_item_recovered','notify_item_recovered']]){
    const {rows}=await db.query(`select count(*)::int n from pg_trigger where tgrelid=to_regclass($1) and tgname=$2 and tgfoid=to_regprocedure($3) and tgenabled='O' and not tgisinternal`,[table,trigger,`public.${fn}()`]);
    requireState(rows[0].n===1,`Trigger bootstrap ausente o deshabilitado: ${trigger}`);
  }
  const required={profiles:['id','full_name','avatar_url','phone','location','rating','created_at'],items:['id','owner_id','title','description','category','status','location_name','lat','lng','date','image_url','reward','contact_count','created_at'],messages:['id','item_id','sender_id','recipient_id','sender_name','sender_avatar','item_title','item_image','text','is_read','created_at'],notifications:['id','user_id','title','message','type','related_item_id','related_user_id','is_read','created_at'],push_subscriptions:['id','user_id','endpoint','p256dh','auth','created_at','updated_at']};
  for(const [table,columns] of Object.entries(required)){
    const {rows}=await db.query(`select a.attname,format_type(a.atttypid,a.atttypmod) type,c.relrowsecurity rls from pg_attribute a join pg_class c on c.oid=a.attrelid where a.attrelid=to_regclass($1) and a.attnum>0 and not a.attisdropped`,['public.'+table]);
    requireState(rows.length===columns.length&&columns.every(c=>rows.some(r=>r.attname===c&&r.rls)),`Tabla bootstrap incompatible o sin RLS: ${table}`);
    for(const row of rows){
      const expected=row.attname==='id'||row.attname.endsWith('_id')?'uuid':row.attname==='lat'||row.attname==='lng'?'double precision':row.attname==='is_read'?'boolean':row.attname==='rating'?'numeric(2,1)':row.attname==='contact_count'?'integer':['created_at','updated_at'].includes(row.attname)?'timestamp with time zone':row.attname==='date'?null:'text';
      requireState(expected?row.type===expected:['date','timestamp with time zone'].includes(row.type),`Tipo inesperado: ${table}.${row.attname}`);
    }
  }
  const {rows}=await db.query(`select count(*)::int n from pg_policies where schemaname='public' and tablename='push_subscriptions'`);
  requireState(rows[0].n>0,'Bootstrap push sin políticas.');
  const fk=await db.query(`select count(*)::int n from pg_constraint where contype='f' and convalidated and conrelid in ('public.items'::regclass,'public.profiles'::regclass,'public.messages'::regclass,'public.notifications'::regclass)`);
  requireState(fk.rows[0].n===8,'Revisar las ocho FK principales.');
  const storage=await db.query(`select count(*)::int n from storage.buckets where id='item-images' and public and file_size_limit=5242880 and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]`);
  requireState(storage.rows[0].n===1,'Bucket item-images ausente o configuración inesperada.');
  const realtime=await db.query("select count(*)::int n from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('items','messages','notifications')");
  requireState(realtime.rows[0].n===3,'Bootstrap incompleto: publicación Realtime.');
  const storagePolicies=await db.query("select count(*)::int n from pg_policies where schemaname='storage' and tablename='objects' and policyname in ('Authenticated users can view item images','Users can upload their own item images','Users can update their own item images','Users can delete their own item images')");
  requireState(storagePolicies.rows[0].n===4,'Bootstrap incompleto: políticas Storage.');

}
const markers=[
  "false",
  "to_regprocedure('public.can_send_item_message(uuid,uuid)') is not null",
  "to_regclass('public.public_profiles') is not null",
  "exists(select from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_read_self')",
  "exists(select from pg_policies where schemaname='public' and tablename='push_subscriptions' and policyname='push_subscriptions_owner')",
  "to_regclass('buscag_private.message_receipts') is not null or to_regnamespace('buscag_private') is not null",
  "to_regclass('buscag_private.match_control') is not null",
  "to_regclass('buscag_private.publication_receipts') is not null",
  "to_regprocedure('public.validate_item_content_write()') is not null"
];
export async function planStaging(db){
  await verifyBootstrap(db);
  const exists=(await db.query("select to_regclass('buscag_staging_admin.applied_sql') is not null present")).rows[0].present;
  const records=exists?(await db.query('select filename,sha256 from buscag_staging_admin.applied_sql order by position')).rows:[];
  requireState(records.length<=files.length&&records.every((r,i)=>r.filename===files[i]),'Historial staging no es un prefijo del orden esperado.');
  const result=[];
  for(const [index,file] of files.entries()){
    const sql=await read(file),sha256=hash(sql),record=records[index];
    if(record)requireState(record.sha256===sha256,`Checksum cambió: ${file}`);
    if(index>0){
      const present=(await db.query(`select (${markers[index]}) present`)).rows[0].present;
      requireState(record?present:!present,record?`Objeto registrado ausente: ${file}. Revisar sin reejecutar.`:`Objeto existente sin historial: ${file}. Revisar; no se reejecutará.`);
    }
    result.push({file,sha256,sql,applied:Boolean(record),position:index});
  }
  return result;
}
async function counts(db){return (await db.query(`select
 (select count(*)::int from auth.users) users,(select count(*)::int from public.profiles) profiles,
 (select count(*)::int from public.items) items,(select count(*)::int from public.messages) messages,
 (select count(*)::int from public.notifications) notifications,(select count(*)::int from public.push_subscriptions) subscriptions`)).rows[0];}
export async function installStaging(db,{apply=false,onStep=()=>{}}={}){
  if((await db.query("select to_regclass('buscag_private.recovery_confirmations') is not null present")).rows[0].present)
    throw publicError('BUSCAG_PREFLIGHT','Instalación escolar existente: usar --upgrade-plan; no reinstalar el baseline.');
  if(!apply)return planStaging(db);
  await db.query("select pg_advisory_lock(214726,926)");
  try{
    const plan=await planStaging(db),before=await counts(db);
    // Fail closed if the registry's schema was created externally/incompletely.
    const schema=(await db.query("select to_regnamespace('buscag_staging_admin') is not null present")).rows[0].present;
    if(!schema)await db.query(`begin;create schema buscag_staging_admin;revoke all on schema buscag_staging_admin from public,anon,authenticated,service_role;
      create table buscag_staging_admin.applied_sql(position integer primary key,filename text unique not null,sha256 text not null,applied_at timestamptz not null default now());
      alter table buscag_staging_admin.applied_sql enable row level security;revoke all on buscag_staging_admin.applied_sql from public,anon,authenticated,service_role;commit;`);
    for(const step of plan){
      if(step.applied){onStep(step.file,'ya registrado');continue;}
      let sql=step.sql;
      if(step.position===0){
        // The October correction is adopted only if BOTH its function and ACL already match.
        const body=(await db.query("select prosrc from pg_proc where oid='public.notify_item_recovered()'::regprocedure")).rows[0].prosrc.replace(/\r\n/g,'\n').trim();
        const acl=(await db.query("select has_column_privilege('authenticated','public.notifications','is_read','UPDATE') yes, has_column_privilege('authenticated','public.notifications','title','UPDATE') extra")).rows[0];
        if(body===functionBody(sql,'notify_item_recovered')&&acl.yes&&!acl.extra)sql='';
        sql='begin;\n'+sql+'\ncommit;';
      }
      requireState(/commit;\s*$/i.test(sql),'Archivo sin transacción final reconocida.');
      const journal=`insert into buscag_staging_admin.applied_sql(position,filename,sha256) values(${step.position},'${step.file}','${step.sha256}');\ncommit;`;
      await withStagingRollbackOnError(db,()=>db.query(sql.replace(/commit;\s*$/i,journal)));
      requireState(JSON.stringify(await counts(db))===JSON.stringify(before),'Conteos cambiaron inesperadamente; detener y revisar.');
      onStep(step.file,'confirmado');
    }
    await verifyInstalled(db);
    return plan.map(s=>({...s,applied:true}));
  }finally{await db.query('select pg_advisory_unlock(214726,926)');}
}
export async function verifyInstalled(db){
  const tables=['items','profiles','messages','notifications','push_subscriptions'];
  for(const table of tables){
    const check=(await db.query(`select c.relrowsecurity rls,pg_get_userbyid(c.relowner) owner,
      has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') anon,
      has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE') anon_columns,
      has_table_privilege('authenticated',c.oid,'TRUNCATE,REFERENCES,TRIGGER') dangerous
      from pg_class c where c.oid=to_regclass($1)`,['public.'+table])).rows[0];
    requireState(check?.rls&&check.owner==='postgres'&&!check.anon&&!check.anon_columns&&!check.dangerous,`RLS/ACL insegura: ${table}`);
  }
  const expectedPolicies=[];
  for(const file of files.slice(1)){
    for(const match of (await read(file)).matchAll(/create policy (\w+) on public\.(\w+)/gi))expectedPolicies.push(match[2]+'.'+match[1]);
  }
  const actualPolicies=(await db.query("select tablename,policyname from pg_policies where schemaname='public' and tablename=any($1::text[])",[tables])).rows.map(r=>r.tablename+'.'+r.policyname);
  requireState(JSON.stringify(actualPolicies.sort())===JSON.stringify(expectedPolicies.sort()),'Políticas faltantes o adicionales: revisar antes de continuar.');

  const expected=[['send_message_once','public.send_message_once(uuid,uuid,uuid,text)'],['publish_item_once','public.publish_item_once(uuid,jsonb)'],['buscag_capabilities','public.buscag_capabilities()']];
  for(const [name,signature] of expected){
    const {rows}=await db.query(`select p.prosecdef,p.proconfig,has_function_privilege('authenticated',p.oid,'EXECUTE') auth,has_function_privilege('anon',p.oid,'EXECUTE') anon from pg_proc p where p.oid=to_regprocedure($1)`,[signature]);
    requireState(rows[0]&&rows[0].prosecdef===(name!=='buscag_capabilities')&&rows[0].proconfig?.includes('search_path=""')&&rows[0].auth&&!rows[0].anon,`RPC insegura o ausente: ${name}`);
  }
  const {rows}=await db.query(`select
    not has_table_privilege('authenticated','public.items','INSERT') and not has_any_column_privilege('authenticated','public.items','INSERT') items_rpc_only,
    not has_table_privilege('authenticated','public.messages','INSERT') and not has_any_column_privilege('authenticated','public.messages','INSERT') messages_rpc_only,
    not has_column_privilege('authenticated','public.profiles','rating','UPDATE') protected_rating,
    not has_column_privilege('authenticated','public.items','contact_count','UPDATE') protected_count,
    not has_schema_privilege('authenticated','buscag_private','USAGE') private_schema,
    not has_function_privilege('authenticated','public.process_match_jobs(integer)','EXECUTE') worker_private,
    has_function_privilege('service_role','public.process_match_jobs(integer)','EXECUTE') worker_service`);
  requireState(Object.values(rows[0]).every(v=>v===true),'Permisos finales no coinciden con el contrato.');
  const control=(await db.query('select enabled from buscag_private.match_control where singleton')).rows[0];
  requireState(control?.enabled===false,'Coincidencias ya activadas: revisar manualmente; el instalador no las pausa.');
  return {rpc:true,permissions:true,matches_enabled:false,counts:await counts(db)};
}
async function main(){
  const args=process.argv.slice(2),refIndex=args.indexOf('--project-ref'),ref=args[refIndex+1];
  const upgrade=args.includes('--upgrade-plan')||args.includes('--upgrade-verify');
  const mode=args.includes('--apply')?'apply':args.includes('--verify')?'verify':args.includes('--smoke')?'smoke':'plan';
  requireState(refIndex>=0&&args.length===3&&['--plan','--apply','--verify','--smoke','--upgrade-plan','--upgrade-verify'].some(x=>args.includes(x)),'Uso: npm run prepare:staging -- --project-ref REF --plan|--apply|--verify|--smoke|--upgrade-plan|--upgrade-verify');
  if(upgrade)requireState(ref==='yiarlhpbgkofhhipkfha','La actualización está fijada exclusivamente a BuscAG Prueba.');
  console.log(`BuscAG prepare:staging · diagnóstico 2 · Node ${process.versions.node}`);
  if(upgrade){const {invalidateUpgradeArtifacts}=await import('./staging-upgrade.mjs');await invalidateUpgradeArtifacts();}
  const trust=await loadStagingCa();
  const config=connectionConfig(process.env.BUSCAG_STAGING_DATABASE_URL,ref,trust.ca);
  if(trust.fingerprint256)console.log('CA configurada SHA-256: '+trust.fingerprint256);
  const {Client}=await import('pg');
  const pgVersion=createRequire(import.meta.url)('pg/package.json').version;
  if(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(pgVersion))console.log(`Driver pg ${pgVersion}`);
  let client;try{client=new Client(config);}catch(error){throw stageFailure(error,{stage:'configuration',lastCompleted:'configuration'});}
  const labels={tcp:'TCP',tls:'TLS',authentication:'autenticación',queries:'consultas',closing:'cierre'};
  await withStagingSession(client,async db=>{
    await db.query("set statement_timeout='120s';set lock_timeout='10s'");
    requireState((await db.query('select current_user')).rows[0].current_user==='postgres','Se requiere el operador postgres de staging.');
    if(upgrade){
      const {planUpgrade,saveUpgradeArtifacts}=await import('./staging-upgrade.mjs');
      // No remote mutation, not even a journal or rollback-only synthetic users.
      await db.query("begin isolation level repeatable read read only;set local search_path=pg_catalog,public");
      const plan=await withStagingRollback(db,()=>planUpgrade(db));
      const artifacts=await saveUpgradeArtifacts(plan);
      const {catalog,evidence,_expectedFinal,_expectedFinalEvidence,sources,comparisons,review,...summary}=plan;
      if(review)summary.review_summary={reference_stage:review.reference_stage,constraints:review.constraint_counts,
        changed_functions:review.functions.changed.map(f=>({object:f.object,classification:f.classification})),
        event_triggers:review.event_triggers.map(t=>({name:t.trigger.name,classification:t.classification})),automatic_acceptance:false};
      console.log(JSON.stringify({...summary,artifacts},null,2));
      requireState(plan.compatible_catalog,'Catálogo desconocido o con diferencias: revisar plan.json; no se preparó SQL ejecutable.');
      if(args.includes('--upgrade-verify'))requireState(plan.installed_final_catalog,'La instalación final aún no está completa.');
    }
    else if(mode==='smoke'){await verifyBootstrap(db);const {smokeStaging}=await import('./staging-smoke.mjs');console.log(JSON.stringify(await smokeStaging(db),null,2));}
    else if(mode==='verify')console.log(JSON.stringify(await verifyInstalled(db),null,2));
    else {const plan=await installStaging(db,{apply:mode==='apply',onStep:(file,state)=>console.log(`${state}: ${file}`)});console.log(JSON.stringify(plan.map(({file,sha256,applied})=>({file,sha256,applied})),null,2));}
  },{onProgress:({stage,status})=>console.log(`[${labels[stage]}] ${status==='ok'?'OK':'iniciando'}`)});
}
async function withStagingRollbackOnError(db,work){
  try{return await work();}catch(error){return withStagingRollback(db,()=>{throw error;});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{
  console.error(formatStagingDiagnostic(error));
  process.exitCode=1;
});
