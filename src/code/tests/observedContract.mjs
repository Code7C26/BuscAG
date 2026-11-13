// Reviewed structural metadata only. This never accepts arbitrary SQL uploads.
// Unknown string defaults and trigger bodies use repository stand-ins, NOT a
// claim of equivalence to the real functions (their recorded hashes differ).
import {readFile} from 'node:fs/promises';
export const observed=JSON.parse(await readFile(new URL('./fixtures/observed-production-contract.json',import.meta.url),'utf8'));
const ident=value=>'"'+value.replaceAll('"','""')+'"';
const types=new Set(['uuid','text','date','timestamp with time zone','double precision','integer','numeric(2,1)','boolean']);
export async function createObservedTables(db){
  for(const table of ['profiles','items','messages','notifications']){
    const definitions=observed.columns.filter(c=>c.relation_name===table).sort((a,b)=>a.attnum-b.attnum).map(c=>{
      if(!types.has(c.column_type))throw Error('Unreviewed type');
      let def='';
      if(c.has_default){
        if(c.default_expression==='[default omitted]'&&c.column_type==='text')def="''";
        else if(['gen_random_uuid()','now()','0','5.0','false'].includes(c.default_expression))def=c.default_expression;
        else throw Error('Unreviewed default');
      }
      return ident(c.column_name)+' '+c.column_type+(c.not_null?' not null':'')+(def?' default '+def:'');
    });
    for(const constraint of observed.constraints.filter(c=>c.relname===table))definitions.push('constraint '+ident(constraint.conname)+' '+constraint.definition);
    await db.exec('create table public.'+ident(table)+' ('+definitions.join(',')+')');
  }
  for(const index of observed.indexes.filter(i=>!i.indisunique))await db.exec(index.definition);
}
export async function applyObservedAccess(db){
  for(const table of ['items','messages','notifications','profiles']){
    const policies=(await db.query('select policyname from pg_policies where schemaname=$1 and tablename=$2',['public',table])).rows;
    for(const policy of policies)await db.exec('drop policy '+ident(policy.policyname)+' on public.'+ident(table));
    const cols=observed.columns.filter(c=>c.relation_name===table).map(c=>ident(c.column_name)).join(',');
    await db.exec('revoke all on public.'+ident(table)+' from public,anon,authenticated,service_role');
    await db.exec('revoke all ('+cols+') on public.'+ident(table)+' from public,anon,authenticated,service_role');
  }
  for(const policy of observed.policies.filter(p=>p.schemaname==='public')){
    await db.exec('create policy '+ident(policy.policyname)+' on public.'+ident(policy.tablename)+' for '+policy.cmd+' to '+policy.roles.map(ident).join(',')+(policy.qual?' using ('+policy.qual+')':'')+(policy.with_check?' with check ('+policy.with_check+')':''));
  }
  for(const p of observed.permissions){
    const operations=['SELECT','INSERT','UPDATE','DELETE'].filter(op=>p[op==='DELETE'?'can_delete':'can_'+op.toLowerCase()+'_table']);
    // The captured raw ACLs also contain TRUNCATE/REFERENCES/TRIGGER/MAINTAIN.
    const privileges=observed.table_acls[p.relname].match(new RegExp('(?:[,{])'+p.rolname+'=([^/]*)/'))?.[1]??'';
    for(const [code,operation] of Object.entries({D:'TRUNCATE',x:'REFERENCES',t:'TRIGGER',m:'MAINTAIN'}))if(privileges.includes(code))operations.push(operation);
    await db.exec('grant '+operations.join(',')+' on public.'+ident(p.relname)+' to '+ident(p.rolname));
  }
  await db.exec('grant update(is_read) on public.messages to authenticated');
}
