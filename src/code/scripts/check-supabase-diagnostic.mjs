// Offline metadata analysis only. No network, credentials, SQL execution or writes.
import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const expectedTriggerSources=new Map();
for(const file of ['20261014000000_dynamic_database.sql','20261016000000_notification_permissions.sql']){
  const sql=await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
  for(const match of sql.matchAll(/create or replace function public\.(\w+)\([\s\S]*?as \$\$([\s\S]*?)\$\$;/gi))expectedTriggerSources.set(match[1],createHash('md5').update(match[2]).digest('hex'));
}
export function parseDiagnostic(source) {
  let root;
  try {root=JSON.parse(source);} catch {
    // Supabase SQL Editor single-column CSV export (quoted JSON, RFC4180 escapes).
    const csv=source.replace(/^\uFEFF/,'').trim();
    const match=/^(?:diagnostic|"diagnostic")\r?\n"([\s\S]*)"$/.exec(csv);
    if(!match) throw Error('Exporta el resultado como JSON o CSV de una columna diagnostic.');
    try {root=JSON.parse(match[1].replace(/""/g,'"'));}catch{throw Error('JSON de diagnóstico inválido.');}
  }
  if(Array.isArray(root)) {if(root.length!==1)throw Error('Se esperaba una fila de diagnóstico.');root=root[0];}
  if(root&&typeof root==='object'&&'diagnostic' in root) root=typeof root.diagnostic==='string'?JSON.parse(root.diagnostic):root.diagnostic;
  if(!root||typeof root!=='object'||!root['01_context']||!Array.isArray(root['02_inventory'])) throw Error('No es el diagnóstico production_diagnostic.sql esperado.');
  return root;
}
export function analyzeDiagnostic(report) {
  const errors=[],warnings=[];
  const issue=(list,code,object,detail)=>list.push({code,object,detail});
  const inventory=report['02_inventory'];const columns=report['04_columns']??[];
  for(const key of ['04_columns','05_policies','06_roles','08_table_permissions','09_column_permissions','10_constraints','12_triggers_without_arguments','13_function_metadata_not_bodies'])if(!Array.isArray(report[key]))issue(errors,'metadata_section_missing',key,'Exporta nuevamente el diagnóstico completo.');
  const required={
    profiles:{id:['uuid'],full_name:['text'],avatar_url:['text'],phone:['text'],location:['text'],created_at:['timestamp with time zone']},
    items:{id:['uuid'],owner_id:['uuid'],title:['text'],description:['text'],category:['text'],status:['text'],location_name:['text'],lat:['double precision'],lng:['double precision'],date:['date','timestamp with time zone'],image_url:['text'],reward:['text'],contact_count:['integer'],created_at:['timestamp with time zone']},
    messages:{id:['uuid'],item_id:['uuid'],sender_id:['uuid'],recipient_id:['uuid'],sender_name:['text'],sender_avatar:['text'],item_title:['text'],item_image:['text'],text:['text'],is_read:['boolean'],created_at:['timestamp with time zone']},
    notifications:{id:['uuid'],user_id:['uuid'],title:['text'],message:['text'],type:['text'],related_item_id:['uuid'],related_user_id:['uuid'],is_read:['boolean'],created_at:['timestamp with time zone']}
  };
  for(const [table,expected] of Object.entries(required)) {
    const actual=inventory.find(row=>row.name===table);
    if(!actual?.exists_in_public) {issue(errors,'missing_table',table,'Falta tabla pública requerida.');continue;}
    if(!['r','p'].includes(actual.actual_kind))issue(errors,'relation_kind',table,'La relación debe ser una tabla.');
    if(!actual.rls_enabled)issue(errors,'rls_disabled',table,'RLS debe estar activo.');
    for(const [name,types] of Object.entries(expected)) {
      const actual=columns.find(row=>row.relation_name===table&&row.column_name===name);
      if(!actual||!types.includes(actual.column_type))issue(errors,'column_contract',table+'.'+name,{expected:types,actual:actual?.column_type??'missing'});
    }
    const supplied={profiles:['id','full_name','avatar_url','phone','location'],items:['owner_id','title','description','category','status','location_name','lat','lng','date','image_url','reward','contact_count'],messages:['item_id','sender_id','recipient_id','sender_name','sender_avatar','item_title','item_image','text'],notifications:['user_id','title','message','type','related_item_id','related_user_id']}[table];
    for(const col of columns.filter(row=>row.relation_name===table)) {
      if(col.not_null&&!col.has_default&&!col.identity_kind&&!col.generated_kind&&!supplied.includes(col.column_name))issue(errors,'required_unsupplied_column',table+'.'+col.column_name,'NOT NULL sin default: los INSERT actuales no lo suministran.');
    }
  }
  const nullableContent=columns.filter(c=>c.relation_name==='items'&&!c.not_null&&['title','description','category','status','location_name','lat','lng','date','image_url'].includes(c.column_name)).map(c=>c.column_name);
  if(nullableContent.length)issue(warnings,'nullable_item_content','items',nullableContent);
  const itemChecks=(report['10_constraints']??[]).filter(c=>c.relname==='items'&&c.contype==='c');
  for(const field of ['category','status'])if(!itemChecks.some(c=>new RegExp('\\b'+field+'\\b').test(c.definition)))issue(warnings,'item_domain_check_missing','items.'+field,'No depender del CHECK del bootstrap; validar nuevas escrituras sin reescribir registros antiguos.');
  for(const edge of report['16_foreign_key_delete_graph']??[])if(edge.child_table==='messages'&&edge.on_delete==='CASCADE')issue(warnings,'conversation_delete_cascade',edge.parent_schema+'.'+edge.parent_table,'Eliminar la fila padre borra mensajes asociados. No cambiar retención automáticamente.');
  for(const row of report['08_table_permissions']??[])if(['anon','authenticated'].includes(row.rolname)){
    const acl=inventory.find(table=>table.name===row.relname)?.table_acl??'';
    const legacyTruncate=(acl.match(new RegExp('(?:[,{])'+row.rolname+'=([^/]*)/'))?.[1]??'').includes('D');
    if(row.can_truncate??legacyTruncate)issue(warnings,'client_truncate_grant',row.relname+':'+row.rolname,'TRUNCATE no usa RLS; explotación requiere acceso SQL, no basta un DELETE REST.');
  }
  const rating=columns.find(row=>row.relation_name==='profiles'&&row.column_name==='rating');
  if(!rating||!/^numeric(?:\(\d+,\d+\))?$/.test(rating.column_type))issue(errors,'column_contract','profiles.rating','Debe conservar un tipo numeric compatible; no convertir datos automáticamente.');
  const directory=inventory.find(row=>row.name==='public_profiles');
  if(directory?.exists_in_public&&(directory.actual_kind!=='v'||['anon','authenticated','service_role'].includes(directory.owner)))issue(errors,'untrusted_directory','public_profiles','Vista con tipo o propietario no previsto.');
  for(const fn of report['13_function_metadata_not_bodies']??[])if(fn.prosecdef&&['anon','authenticated','service_role'].includes(fn.owner))issue(errors,'untrusted_function_owner',fn.proname,'SECURITY DEFINER requiere propietario de migraciones confiable.');
  for(const name of ['public_profiles','push_subscriptions']) if(!inventory.find(row=>row.name===name)?.exists_in_public)issue(warnings,'baseline_object_missing',name,'No ejecutar bootstrap histórico; revisar las cuatro migraciones de seguridad.');
  const roles=report['06_roles']??[];
  for(const name of ['anon','authenticated']) {
    const role=roles.find(row=>row.role===name);
    if(!role)issue(errors,'missing_api_role',name,'Falta información del rol.');
    else if(role.superuser||role.bypass_rls)issue(errors,'privileged_api_role',name,'Superusuario/BYPASSRLS es incompatible con clientes.');
  }
  for(const membership of report['07_inherited_roles']??[])if(['anon','authenticated'].includes(membership.client_role)&&(membership.rolsuper||membership.rolbypassrls))issue(errors,'privileged_membership',membership.client_role,'Revisar membresía privilegiada antes de cualquier aplicación.');
  for(const row of report['09_column_permissions']??[]) {
    if(row.rolname==='authenticated'&&((row.relation_name==='profiles'&&row.column_name==='rating')||(row.relation_name==='items'&&['owner_id','contact_count'].includes(row.column_name)))&&(row.can_update||row.can_insert&&row.column_name!=='owner_id'))issue(warnings,'protected_column_acl',row.relation_name+'.'+row.column_name,'ACL permite campos protegidos; revisar políticas y aplicar baseline. No demuestra por sí sola una escritura explotable.');
  }
  for(const policy of report['05_policies']??[]) {
    const broad=value=>typeof value==='string'&&value.replace(/[()\s]/g,'').toLowerCase()==='true';
    if(policy.tablename==='items'&&['INSERT','ALL'].includes(policy.cmd)&&broad(policy.with_check))issue(warnings,'open_item_insert_policy','items','WITH CHECK true: cotejar roles y grants.');
    if(policy.tablename==='profiles'&&['SELECT','ALL'].includes(policy.cmd)&&broad(policy.qual))issue(warnings,'broad_profile_policy','profiles','USING true: cotejar acceso a teléfono/ubicación.');
    if(policy.tablename==='messages'&&/\b(\w+)\.(\w+)\s*=\s*\1\.\2\b/.test(policy.with_check??''))issue(warnings,'suspicious_message_comparison','messages','Hay comparación de una columna consigo misma; requiere revisión de la expresión completa.');
  }
  const funcs=report['13_function_metadata_not_bodies']??[];
  const signatures={send_message_once:'uuid, uuid, uuid, text',publish_item_once:'uuid, jsonb',process_match_jobs:'integer'};
  for(const row of report['20_schema_permissions']??[])if(['anon','authenticated'].includes(row.rolname)&&row.can_create)issue(warnings,'client_schema_create',row.schema_name+':'+row.rolname,'Revisar CREATE y funciones definidas por cliente; no inferir explotación sin verificar rutas SQL.');
  for(const name of Object.keys(signatures)) {
    for(const fn of funcs.filter(row=>row.proname===name)) {
      if(fn.argument_types!==signatures[name])issue(errors,'unexpected_rpc_signature',name,{expected:signatures[name],actual:fn.argument_types});
      if(!fn.prosecdef||!(fn.proconfig??[]).some(setting=>/^search_path=(?:""|)$/.test(setting)))issue(errors,'rpc_execution_context',name,'Requiere SECURITY DEFINER y search_path vacío; revisar la definición exacta.');
    }
    if(!funcs.some(row=>row.proname===name))issue(warnings,'workflow_rpc_missing',name,'Propuesta no instalada o firma pendiente de reconciliación.');
    for(const row of (report['18_rpc_permissions']??[]).filter(row=>row.proname===name)) {
      const allowed=name==='process_match_jobs'?'service_role':'authenticated';
      if(row.rolname!==allowed&&row.can_execute)issue(errors,'unexpected_rpc_execute',name+':'+row.rolname,'EXECUTE concedido a un rol no previsto.');
    }
  }
  for(const fn of funcs){
    const expected=expectedTriggerSources.get(fn.proname);
    if(fn.nspname==='public'&&expected&&fn.source_fingerprint!==expected)issue(warnings,'trigger_source_fingerprint_differs',fn.proname,'El texto del cuerpo difiere del repositorio (puede ser formato o lógica). Revisar definición privada; no sustituir automáticamente.');
  }
  const triggers=report['12_triggers_without_arguments']??[];
  for(const name of ['handle_new_auth_user','notify_message_recipient','notify_item_recovered'])if(!triggers.some(row=>row.function_name===name))issue(warnings,'trigger_review_required',name,'No consta el trigger esperado; podría haber una implementación equivalente que debe revisarse.');
  return {format_version:1,production_approved:false,status:errors.length?'incompatible_contract':'manual_review_required',errors,warnings,
    migration_history_exists:report['01_context'].migration_history_exists===true,
    note:'Sólo metadatos. No prueba cuerpos de funciones, acceso RLS efectivo, Storage, Auth, Realtime ni equivalencia completa del esquema. No genera ni ejecuta SQL.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    if(process.argv.length!==3)throw Error('Uso: node scripts/check-supabase-diagnostic.mjs /ruta/privada/diagnostic.json');
    if((await stat(process.argv[2])).size>16*1024*1024)throw Error('Diagnóstico demasiado grande.');
    const source=await readFile(process.argv[2],'utf8');
    const result=analyzeDiagnostic(parseDiagnostic(source));console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
  }catch{console.error('No se pudo leer o validar el diagnóstico; no se imprimió su contenido.');process.exitCode=1;}
}
