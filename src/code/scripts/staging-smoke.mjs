// Transactional DB/RLS smoke only. Not an Auth API, email, Storage or Realtime test.
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyInstalled} from './prepare-staging.mjs';
export async function smokeStaging(db){
  const before=await verifyInstalled(db),users=[randomUUID(),randomUUID(),randomUUID()];
  const as=async(role,user,sql,args=[])=>{
    await db.query('savepoint smoke_role');
    try{
      await db.query('set local role '+role);
      await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[user??'',JSON.stringify({sub:user,role})]);
      const result=await db.query(sql,args);await db.query('reset role');await db.query('release savepoint smoke_role');return result;
    }catch(error){await db.query('rollback to savepoint smoke_role');await db.query('release savepoint smoke_role');throw error;}
  };
  await db.query('begin');
  try{
    for(const id of users)await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,JSON.stringify({full_name:'BuscAG staging ficticio',phone:'synthetic-private',location:'synthetic-private'})]);
    assert.equal((await db.query('select count(*)::int n from public.profiles where id=any($1::uuid[])',[users])).rows[0].n,3);
    await db.query('update buscag_private.match_control set enabled=true where singleton');
    const publication=async(owner,status)=>{
      const key=randomUUID(),payload={title:'Mochila roja sintética',description:'mochila roja sintética pruebas',category:'Mochilas y Bolsos',status,location_name:'Ubicación ficticia',lat:-34.6,lng:-58.4,date:'2026-11-04',image_url:'https://example.invalid/staging-synthetic.png',reward:null};
      const send=()=>as('authenticated',users[owner],'select * from public.publish_item_once($1,$2)',[key,payload]);
      const first=(await send()).rows[0];assert.ok(first?.id);assert.equal((await send()).rows[0].id,first.id);return first;
    };
    const lost=await publication(0,'perdido'),found=await publication(1,'encontrado');
    await as('service_role',null,'select public.process_match_jobs(5)');
    const matched=(await db.query("select count(*)::int n from public.notifications where type='match' and user_id=any($1::uuid[]) and related_item_id=any($2::uuid[])",[users,[lost.id,found.id]])).rows[0].n;
    assert.equal(matched,2);
    await as('service_role',null,'select public.process_match_jobs(5)');
    const send=async(sender,recipient)=>{
      const key=randomUUID(),args=[key,found.id,users[recipient],'Mensaje ficticio de prueba'];
      const first=(await as('authenticated',users[sender],'select * from public.send_message_once($1,$2,$3,$4)',args)).rows[0];
      assert.equal((await as('authenticated',users[sender],'select * from public.send_message_once($1,$2,$3,$4)',args)).rows[0].id,first.id);
    };
    await send(0,1);await send(1,0);
    assert.equal((await as('authenticated',users[2],'select * from public.messages where item_id=$1',[found.id])).rows.length,0);
    assert.equal((await as('authenticated',users[2],'select * from public.profiles where id=any($1::uuid[])',[users.slice(0,2)])).rows.length,0);
    assert.equal((await as('authenticated',users[2],'select * from public.notifications where user_id=any($1::uuid[])',[users.slice(0,2)])).rows.length,0);
    const directory=(await as('authenticated',users[2],'select phone,location from public.public_profiles where id=any($1::uuid[])',[users.slice(0,2)])).rows;
    assert.equal(directory.length,2);assert.ok(directory.every(p=>p.phone===''&&p.location===''));
    const ownContact=(await as('authenticated',users[0],'select phone from public.public_profiles where id=$1',[users[1]])).rows[0];
    assert.equal(ownContact.phone,'synthetic-private');
    assert.equal((await as('authenticated',users[2],"update public.items set title='Cambio ajeno' where id=$1 returning id",[found.id])).rows.length,0);
    await assert.rejects(as('authenticated',users[1],'update public.profiles set rating=1 where id=$1',[users[1]]),e=>e.code==='42501');
    await as('authenticated',users[1],"update public.items set title='Título editado' where id=$1",[found.id]);
    await as('authenticated',users[1],"update public.items set status='recuperado' where id=$1",[found.id]);
    assert.equal((await db.query('select count(*)::int n from public.messages where item_id=$1',[found.id])).rows[0].n,2);
    assert.equal((await db.query('select contact_count from public.items where id=$1',[found.id])).rows[0].contact_count,2);
    assert.equal((await db.query("select count(*)::int n from public.notifications where type='message' and user_id=any($1::uuid[])",[users])).rows[0].n,2);
    assert.equal((await db.query("select count(*)::int n from public.notifications where type='recovered' and related_item_id=$1",[found.id])).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int n from public.notifications where type='match' and user_id=any($1::uuid[])",[users])).rows[0].n,2);
  }finally{await db.query('rollback');}
  const after=await verifyInstalled(db);assert.deepEqual(after,before);
  return {database_smoke:'passed',synthetic_changes:'rolled_back',auth_api:'not_tested',storage_api:'not_tested',realtime:'not_tested',email:'not_tested',push:'not_tested'};
}
