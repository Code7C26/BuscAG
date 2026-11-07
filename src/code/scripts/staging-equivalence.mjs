// Narrow, evidence-backed representation variants; never filters remote objects.
import {createHash} from 'node:crypto';
import {serviceVariantAllowed} from './staging-official-evidence.mjs';
const md5=s=>createHash('md5').update(s).digest('hex');
export function portableReference(reference,stage,catalog,evidence,official,preservation){
 const result=structuredClone(reference),accepted=[];
 if(evidence?.version!==1)return {catalog:result,accepted};
 const version=evidence.server_version_num;
 if(Number.isInteger(version)&&version>=150000&&version<180000){
  // PG18 materializes NOT NULL in pg_constraint; earlier versions enforce it
  // through pg_attribute. Only remove positively identified LOCAL reference
  // entries. Every remote column, CHECK, PK, FK and unknown entry stays compared.
  const removed=result.constraints.filter(k=>k.validated&&result.columns.some(c=>c.schema===k.schema&&c.table===k.table&&c.not_null&&k.definition_hash===md5('NOT NULL '+c.name)));
  result.constraints=result.constraints.filter(k=>!removed.includes(k));
  if(removed.length)accepted.push({variant:'pre_pg18_not_null_catalog',count:removed.length});
 }
 for(const fn of result.functions){
  if(fn.schema!=='public'||!['canonicalize_message_display','can_send_item_message'].includes(fn.name))continue;
  // Community explicitly revokes service EXECUTE on can_send; it must remain
  // revoked in the final catalog. The unchanged trigger retains its prior ACL.
  if(stage==='community'&&fn.name==='can_send_item_message')continue;
  const actual=catalog.functions.find(f=>f.schema===fn.schema&&f.name===fn.name&&f.arguments===fn.arguments);
  if(fn.service_execute===false&&actual?.service_execute===true&&serviceVariantAllowed(fn.name,evidence)){
   fn.service_execute=true;accepted.push({variant:'trusted_server_execute',function:fn.name});
  }
 }
 if(official?.verified){
  result.event_triggers=structuredClone(catalog.event_triggers);
  accepted.push({variant:'official_supabase_events',commit:official.official_commit,count:6});
 }
 else if(preservation?.eligible&&['school','secure_recovery','community'].includes(stage)){
  result.event_triggers=structuredClone(catalog.event_triggers);
  accepted.push({variant:'platform_preserved_for_application_only',profile:preservation.profile,count:6});
 }
 return {catalog:result,accepted};
}
export function finalEvidence(evidence){
 if(!evidence)return null;
 const result=structuredClone(evidence);
 const fn=result.service_function_acls?.find(f=>f.name==='can_send_item_message');
 if(fn)fn.acl=fn.acl?.filter(a=>a.grantee!=='service_role');
 return result;
}
