// Explanations only: none of these classifications waive a catalog mismatch.
import {createHash} from 'node:crypto';
const md5=s=>createHash('md5').update(s).digest('hex');
const key=o=>[o.schema,o.table,o.name].filter(Boolean).join('.');
const functionKey=o=>`${o.schema}.${o.name}(${o.arguments})`;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sorted=o=>o&&typeof o==='object'&&!Array.isArray(o)?Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b))):o;
const equal=(a,b)=>JSON.stringify(a,(_,v)=>sorted(v))===JSON.stringify(b,(_,v)=>sorted(v));
function differences(expected=[],actual=[],identity=key){
 const before=new Map((expected??[]).map(o=>[identity(o),o]));
 const after=new Map((actual??[]).map(o=>[identity(o),o]));
 return {
  missing:[...before].filter(([k])=>!after.has(k)).map(([object,expected])=>({object,expected})),
  added:[...after].filter(([k])=>!before.has(k)).map(([object,actual])=>({object,actual})),
  changed:[...before].filter(([k,v])=>after.has(k)&&!equal(v,after.get(k))).map(([object,expected])=>({object,fields:Object.keys({...expected,...after.get(object)}).filter(k=>!equal(expected[k],after.get(object)[k])).map(field=>({field,expected:expected[field],actual:after.get(object)[field]}))})),
 };
}
export const managedWiring={
 issue_graphql_placeholder:['sql_drop','extensions.set_graphql_placeholder()',['DROP EXTENSION']],
 issue_pg_cron_access:['ddl_command_end','extensions.grant_pg_cron_access()',['CREATE EXTENSION']],
 issue_pg_graphql_access:['ddl_command_end','extensions.grant_pg_graphql_access()',['CREATE EXTENSION']],
 issue_pg_net_access:['ddl_command_end','extensions.grant_pg_net_access()',['CREATE EXTENSION']],
 pgrst_ddl_watch:['ddl_command_end','extensions.pgrst_ddl_watch()',null],
 pgrst_drop_watch:['sql_drop','extensions.pgrst_drop_watch()',null],
};
export function reviewCatalog(expected,actual,stage,evidence=null,official=null){
 const constraints=differences(expected.constraints,actual.constraints);
 for(const d of constraints.missing){
  const column=expected.columns.find(c=>c.schema===d.expected.schema&&c.table===d.expected.table&&c.not_null&&d.expected.validated&&md5('NOT NULL '+c.name)===d.expected.definition_hash);
  const enforced=column&&actual.columns.some(c=>c.schema===column.schema&&c.table===column.table&&c.name===column.name&&c.not_null===true);
  d.classification=enforced?'not_null_catalog_representation':'unexplained_missing_constraint';
  if(enforced)d.column=column.name;
 }
 const functions=differences(expected.functions,actual.functions,functionKey);
 for(const d of functions.changed){
  const known=[
   'public.can_send_item_message(p_item_id uuid, p_recipient_id uuid)',
   'public.canonicalize_message_display()',
  ].includes(d.object);
  d.classification=known&&d.fields.length===1&&d.fields[0].field==='service_execute'&&d.fields[0].expected===false&&d.fields[0].actual===true
   ?'buscag_service_execute_variant_requires_acl_review':'unexplained_function_change';
 }
 const events=(actual.event_triggers??[]).map(trigger=>{
  const wiring=managedWiring[trigger.name];
  const candidate=wiring&&trigger.enabled==='O'&&same([trigger.event,trigger.function,trigger.tags],wiring);
  const proof=evidence?.event_triggers?.find(e=>e.name===trigger.name);
  const verified=official?.verified===true&&official.checks.some(c=>c.name===trigger.name&&c.verified);
  return {trigger,classification:verified?'official_supabase_event_verified':candidate?'supabase_wiring_candidate_unverified':'unknown_or_changed_event_trigger',
   missing_evidence:proof?[]:['event_owner','function_owner','function_definition','security_configuration','function_acl','extension_dependency'],
   verification_failures:official?.checks?.find(c=>c.name===trigger.name)?.failures??[],automatic_acceptance:false};
 });
 return {reference_stage:stage,informational_only:true,automatic_acceptance:false,
  constraints,functions,event_triggers:events,
  constraint_counts:{expected:expected.constraints?.length??0,actual:actual.constraints?.length??0,
   missing:constraints.missing.length,added:constraints.added.length,changed:constraints.changed.length},
  message:'Object names do not authorize an upgrade. Catalog v1 needs the separately collected evidence; official_validation records verification results. Unknown differences still block the entire plan.'};
}
