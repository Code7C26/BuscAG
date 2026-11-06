// Catalog-only upgrade planning. This module NEVER executes an upgrade on its db.
// References are rebuilt from reviewed SQL in an empty WASM PostgreSQL, not adopted
// from a remote journal. Unknown/partial structures always require manual review.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {stagingReference} from './staging-reference.mjs';
import {files} from './prepare-staging.mjs';

export const PRUEBA_REF='yiarlhpbgkofhhipkfha';
export const upgrades=[
 'proposals/20261105000000_school_features.sql',
 'proposals/20261106000000_secure_recovery.sql',
 'proposals/20261106001000_community_safety.sql',
];
const read=f=>readFile(new URL('../supabase/'+f,import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const literal=s=>"'"+s.replaceAll("'","''")+"'";
export const fingerprint=catalog=>sha(stable(catalog));
export async function readUpgradeCatalog(db){
 return (await db.query(await read('audit/upgrade_catalog.sql'))).rows[0].catalog;
}
export function catalogDifferences(expected,actual,path=''){
 if(stable(expected)===stable(actual))return [];
 if(!expected||!actual||typeof expected!=='object'||typeof actual!=='object')return [path||'/'];
 if(Array.isArray(expected)||Array.isArray(actual)){
  if(!Array.isArray(expected)||!Array.isArray(actual)||expected.length!==actual.length)return [path+'/length'];
 }
 return [...new Set([...Object.keys(expected),...Object.keys(actual)])].flatMap(k=>catalogDifferences(expected[k],actual[k],path+'/'+k)).slice(0,100);
}
const referenceCache=new Map();
async function references(dateType){
 if(!referenceCache.has(dateType))referenceCache.set(dateType,(async()=>{
  const {PGlite}=await import('@electric-sql/pglite');
  const db=await stagingReference(PGlite,{dateType});
  try{
   for(const file of files)await db.query(await read(file));
   await db.query('set search_path=pg_catalog,public');
   const states=[{stage:'baseline',catalog:await readUpgradeCatalog(db)}];
   for(const [i,file] of upgrades.entries()){
    await db.query(await read(file));
    states.push({stage:['school','secure_recovery','community'][i],catalog:await readUpgradeCatalog(db)});
   }
   return states;
  }finally{await db.close();}
 })());
 return referenceCache.get(dateType);
}
export async function planUpgrade(db){
 const catalog=await readUpgradeCatalog(db);
 const type=catalog.columns?.find(c=>c.schema==='public'&&c.table==='items'&&c.name==='date')?.type;
 const dateType=type==='date'?'date':type==='timestamp with time zone'?'timestamptz':null;
 const states=dateType?await references(dateType):[];
 const match=states.find(s=>fingerprint(s.catalog)===fingerprint(catalog));
 const comparisons=states.map(s=>({stage:s.stage,differences:catalogDifferences(s.catalog,catalog)}));
 const stageIndex=states.indexOf(match);
 const candidates=match?upgrades.slice(stageIndex):[];
 const sources=await Promise.all([...files,...upgrades].map(async file=>({file,sha256:sha(await read(file))})));
 return {
  version:1,project_ref:PRUEBA_REF,mode:'read_only_plan',
  stage:match?.stage??'unknown_or_drifted',catalog_fingerprint:fingerprint(catalog),date_type:dateType,
  compatible_catalog:Boolean(match),installed_final_catalog:match?.stage==='community',
  candidates:candidates.map(file=>sources.find(s=>s.file===file)),sources,
  comparisons:match?[]:comparisons,
  backup:'not_checked',remote_behaviour:'not_tested',authorization_to_apply:false,
  blockers:match?[]:['Catalog differs from every reviewed reference. Review differences; no install SQL generated.'],
  catalog,
  // Internal, not serialized by the CLI. Used only to build fail-closed SQL.
  _expectedFinal:states.at(-1)?.catalog,
 };
}
const stripTransaction=sql=>{
 const start=sql.search(/^begin;\s*$/im);
 if(start<0||!/commit;\s*$/i.test(sql))throw Error('Unrecognized migration transaction');
 return sql.slice(start).replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');
};
function assertCatalog(expected,message){
 return `do $upgrade_guard$ declare observed jsonb; begin
 select catalog into observed from (
 UPGRADE_CATALOG_QUERY
 ) reviewed;
 if observed is distinct from ${literal(JSON.stringify(expected))}::jsonb then
 raise exception '${message}';end if;end $upgrade_guard$;`;
}
export async function upgradeBundle(plan){
 if(!plan.compatible_catalog||!plan.candidates.length||!plan._expectedFinal)throw Error('No reviewed pending upgrade');
 const catalogSql=(await read('audit/upgrade_catalog.sql')).replace(/;\s*$/,'');
 const before=assertCatalog(plan.catalog,'Catalog changed: replan before installation').replace('UPGRADE_CATALOG_QUERY',catalogSql);
 const after=assertCatalog(plan._expectedFinal,'Final catalog mismatch: transaction must roll back').replace('UPGRADE_CATALOG_QUERY',catalogSql);
 const tables=plan.catalog.relations.filter(r=>r.kind==='r').map(r=>`${r.schema}.${r.name}`);
 const content=(r)=>{
  const name=`${r.schema}.${r.name}`;
  const additions=name==='public.profiles'?['phone_shared','rating_count']:name==='buscag_private.recovery_confirmations'?['mode','owner_statement','resolved_by']:[];
  const excluded=additions.filter(column=>!plan.catalog.columns.some(c=>c.schema===r.schema&&c.table===r.name&&c.name===column));
  return `select ${literal(name)} relation,count(*)::bigint n,
   md5(coalesce(string_agg(digest,'' order by digest),'')) digest from
   (select md5((to_jsonb(t)-array[${excluded.map(literal).join(',')}]::text[])::text) digest from ${name} t) source_rows`;
 };
 const preservation=plan.catalog.relations.filter(r=>r.kind==='r').map(content).join('\nunion all\n');
 const sqls=await Promise.all(plan.candidates.map(async s=>{
  const sql=await read(s.file);if(sha(sql)!==s.sha256)throw Error('Source changed: replan');return `-- ${s.file} SHA256 ${s.sha256}\n${stripTransaction(sql)}`;
 }));
 return `-- REVIEW ONLY. NOT authorization to execute. Target: ${PRUEBA_REF}.
-- psql only. Backup must have been restored successfully in a separate disposable
-- environment. Set buscag.upgrade.backup_verified to the plan fingerprint ONLY
-- after verifying that evidence and receiving explicit authorization to install.
\\set ON_ERROR_STOP on
begin;
set local lock_timeout='5s';set local statement_timeout='120s';
set local search_path=pg_catalog,public;
select pg_advisory_xact_lock(214726,926);
do $backup$ begin
 if current_user<>'postgres' then raise exception 'Trusted Prueba operator required';end if;
 if current_setting('buscag.upgrade.backup_verified',true) is distinct from ${literal(plan.catalog_fingerprint)}
 then raise exception 'Verified restore evidence and explicit approval required';end if;end $backup$;
-- Short maintenance window required: block concurrent writers, never delete rows.
lock table auth.users,${tables.join(',')} in share row exclusive mode;
${before}
create temporary table buscag_upgrade_preservation on commit drop as ${preservation};
create temporary table buscag_upgrade_user_count on commit drop as select count(*) n from auth.users;
${sqls.join('\n')}
${after}
do $preserve$ begin
 if exists((select * from buscag_upgrade_preservation except (${preservation}))
 union all ((${preservation}) except select * from buscag_upgrade_preservation))
 or (select n from buscag_upgrade_user_count)<>(select count(*) from auth.users)
 then raise exception 'Existing data changed: rolling back upgrade';end if;end $preserve$;
commit;
-- Run --upgrade-verify in a NEW session, then authorized dedicated-account QA.
`;
}
export async function saveUpgradeArtifacts(plan,dir=new URL('../test-results/staging-upgrade/',import.meta.url)){
 await mkdir(dir,{recursive:true});
 await writeFile(new URL('install.review.sql',dir),'-- No executable SQL: planning is incomplete.\n');
 const {_expectedFinal,...publicPlan}=plan;
 await writeFile(new URL('plan.json',dir),JSON.stringify(publicPlan,null,2)+'\n');
 // Always overwrite any stale artifact with an inert file if this plan is blocked.
 await writeFile(new URL('install.review.sql',dir),plan.compatible_catalog&&plan.candidates.length?await upgradeBundle(plan):'-- No executable SQL: blocked or already installed. Replan and review.\n');
 return {plan:'test-results/staging-upgrade/plan.json',sql:'test-results/staging-upgrade/install.review.sql'};
}
export async function invalidateUpgradeArtifacts(){
 const dir=new URL('../test-results/staging-upgrade/',import.meta.url);
 await mkdir(dir,{recursive:true});
 await writeFile(new URL('install.review.sql',dir),'-- No executable SQL: planning/verification has not completed.\n');
 await writeFile(new URL('plan.json',dir),JSON.stringify({status:'not_planned',authorization_to_apply:false})+'\n');
}
