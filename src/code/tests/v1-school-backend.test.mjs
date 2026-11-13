// Existing school stage only; no pending migrations, remote hosts or user data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {stagingReference} from '../scripts/staging-reference.mjs';
import {files} from '../scripts/prepare-staging.mjs';
const read=file=>readFile(new URL('../supabase/'+file,import.meta.url),'utf8');
const a='a0000000-0000-4000-8000-000000000001',b='a0000000-0000-4000-8000-000000000002',c='a0000000-0000-4000-8000-000000000003';
for(const dateType of ['date','timestamptz'])test(`v1 core remains usable at school without secure/community migrations (${dateType})`,async()=>{
 const db=await stagingReference(PGlite,{dateType});
 const as=async(id,work)=>{await db.query('begin;set local role authenticated');try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);return await work();}finally{await db.query('rollback');}};
 try{
  for(const file of [...files,'proposals/20261105000000_school_features.sql'])await db.query(await read(file));
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$4),($2,$4),($3,$4)',[a,b,c,{full_name:'Cuenta sintética'}]);
  assert.equal((await db.query("select to_regprocedure('public.recovery_context(uuid)') is null recovery_pending,to_regprocedure('public.my_community_settings()') is null community_pending")).rows[0].recovery_pending,true);
  assert.equal((await db.query("select to_regprocedure('public.my_community_settings()') is null pending")).rows[0].pending,true);
  // Commit the same owner-bound projection used by the compatibility UI.
  await db.query('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[a]);
  assert.equal((await db.query('update public.profiles set full_name=$1,avatar_url=$2,location=$3 where id=$4 returning id',['Nombre actualizado','https://example.invalid/avatar.png','Zona sintética',a])).rows[0].id,a);
  assert.equal((await db.query('update public.profiles set full_name=$1 where id=$2 returning id',['Ajeno',b])).rows.length,0);
  const payload={title:'Mochila perdida sintética',description:'Publicación de prueba aislada',category:'Otros',status:'perdido',location_name:'Zona sintética',lat:-34.6,lng:-58.4,date:'2026-11-07T12:00:00Z',image_url:'https://example.invalid/item.jpg'};
  const key='b0000000-0000-4000-8000-000000000001';
  const first=(await db.query('select * from public.publish_item_once($1,$2)',[key,payload])).rows[0];
  assert.equal(first.owner_id,a);assert.equal((await db.query('select * from public.publish_item_once($1,$2)',[key,payload])).rows[0].id,first.id);
  await db.query('update public.items set title=$1 where id=$2 and owner_id=$3',['Mochila editada sintética',first.id,a]);await db.query('commit');
  let message;
  await db.query('begin;set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[b]);
  const args=['b0000000-0000-4000-8000-000000000002',first.id,a,'Tengo información sobre el objeto.'];
  message=(await db.query('select * from public.send_message_once($1,$2,$3,$4)',args)).rows[0];
  assert.equal((await db.query('select * from public.send_message_once($1,$2,$3,$4)',args)).rows[0].id,message.id);await db.query('commit');
  await as(a,async()=>{
   assert.equal((await db.query('select count(*)::int n from public.messages where id=$1',[message.id])).rows[0].n,1);
   assert.equal((await db.query('update public.messages set is_read=true where id=$1 and recipient_id=$2 returning id',[message.id,a])).rows.length,1);
   assert.equal((await db.query('select count(*)::int n from public.notifications where user_id=$1',[a])).rows[0].n,1);
   assert.equal((await db.query('select full_name from public.profiles where id=$1',[a])).rows[0].full_name,'Nombre actualizado');
  });
  await as(c,async()=>assert.equal((await db.query('select id from public.messages where id=$1',[message.id])).rows.length,0));
  assert.equal((await db.query('select title,status from public.items where id=$1',[first.id])).rows[0].status,'perdido');
 }finally{await db.query('rollback');await db.close();}
});
