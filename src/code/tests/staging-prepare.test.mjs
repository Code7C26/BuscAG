import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {connectionConfig,PRODUCTION_REF,installStaging,planStaging,verifyInstalled,files} from '../scripts/prepare-staging.mjs';
import {smokeStaging} from '../scripts/staging-smoke.mjs';
import {stagingReference} from '../scripts/staging-reference.mjs';
const fixture=()=>stagingReference(PGlite);
const ref='abcdefghijklmnopqrst';
test('staging connection guard rejects production, wrong project, non-TLS options and transaction pooler',()=>{
  for(const [url,r] of [
    [`postgresql://postgres:synthetic@db.${PRODUCTION_REF}.supabase.co:5432/postgres`,PRODUCTION_REF],
    [`postgresql://postgres:synthetic@db.${PRODUCTION_REF}.supabase.co/postgres`,ref],
    [`postgresql://postgres:synthetic@localhost/postgres`,ref],
    [`postgresql://postgres.${ref}:synthetic@aws-0-region.pooler.supabase.com:6543/postgres`,ref],
    [`postgresql://postgres:synthetic@db.${ref}.supabase.co/postgres?sslmode=disable`,ref],
    [`postgresql://postgres:synthetic@db.${ref}.supabase.co/postgres?options=-cfoo`,ref],
  ])assert.throws(()=>connectionConfig(url,r));
  const direct=connectionConfig(`postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/postgres?sslmode=require`,ref);
  assert.equal(direct.ssl.rejectUnauthorized,true);assert.ok(!direct.connectionString.includes('sslmode'));
  assert.equal(connectionConfig(`postgresql://postgres.${ref}:synthetic@aws-0-region.pooler.supabase.com:5432/postgres`,ref).ssl.rejectUnauthorized,true);
});
const {PGlite}=await import(process.env.LOCAL_PG_SOCKET?'./postgresAdapter.mjs':'@electric-sql/pglite');
const read=file=>readFile(new URL('../supabase/'+file,import.meta.url),'utf8');
test('staging runner verifies two bootstrap, applies nine pending files, resumes without rerunning, and rolls back synthetic smoke',async()=>{
  const db=await fixture();try{
    const plan=await planStaging(db);assert.equal(plan.length,9);assert.ok(plan.every(s=>!s.applied));
    assert.equal((await db.query("select to_regnamespace('buscag_staging_admin') is null clean")).rows[0].clean,true);
    const steps=[];await installStaging(db,{apply:true,onStep:(_,status)=>steps.push(status)});assert.ok(steps.every(s=>s==='confirmado'));
    assert.equal((await planStaging(db)).filter(s=>s.applied).length,9);
    const resumed=[];await installStaging(db,{apply:true,onStep:(_,s)=>resumed.push(s)});assert.ok(resumed.every(s=>s==='ya registrado'));
    assert.equal((await verifyInstalled(db)).matches_enabled,false);
    assert.equal((await smokeStaging(db)).synthetic_changes,'rolled_back');
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,0);
    await db.query('create policy rogue_policy on public.profiles for select to authenticated using(true)');
    await assert.rejects(verifyInstalled(db),/Políticas/);
    await db.query('drop policy rogue_policy on public.profiles');
    await db.query("update buscag_staging_admin.applied_sql set sha256='changed' where position=8");
    await assert.rejects(planStaging(db),/Checksum/);
  }finally{await db.close();}
});
test('staging runner refuses unknown partial installation without rerunning SQL',async()=>{
  const db=await fixture();try{
    await db.query(await read(files[1]));
    await assert.rejects(installStaging(db,{apply:true}),/sin historial/);
    assert.equal((await db.query("select to_regnamespace('buscag_staging_admin') is null clean")).rows[0].clean,true);
  }finally{await db.close();}
});
test('a failed step keeps earlier commits and resumes from its unapplied position',async()=>{
  const db=await fixture();try{
    const original=db.query;let fail=true;
    db.query=async(sql,args)=>{
      if(fail&&sql.includes('create view public.public_profiles')){const e=new Error('synthetic failure');e.code='42601';throw e;}
      return original(sql,args);
    };
    await assert.rejects(installStaging(db,{apply:true}),/synthetic failure/);
    assert.deepEqual((await planStaging(db)).filter(s=>s.applied).map(s=>s.position),[0,1]);
    assert.equal((await db.query("select to_regclass('public.public_profiles') is null absent")).rows[0].absent,true);
    fail=false;await installStaging(db,{apply:true});assert.equal((await planStaging(db)).filter(s=>s.applied).length,9);
  }finally{await db.close();}
});
