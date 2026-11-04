// Full recommended order against the captured structure; synthetic data only.
// The export omits trigger bodies/default text literals: repository stand-ins apply.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createObservedTables,applyObservedAccess} from './observedContract.mjs';
const {PGlite}=await import(process.env.LOCAL_PG_SOCKET?'./postgresAdapter.mjs':'@electric-sql/pglite');
const read=file=>readFile(new URL('../supabase/'+file,import.meta.url),'utf8');
test('captured structure: all eight SQL files install before activation, then both RPCs and matching work together',async()=>{
  const db=new PGlite();
  const users=['c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000003'];
  const as=async(role,uid,sql,args=[])=>{
    await db.exec('begin');
    try {
      await db.exec('set local role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid??'']);
      const result=await db.query(sql,args);await db.exec('commit');return result;
    }catch(error){await db.exec('rollback');throw error;}
  };
  try {
    await db.exec(`do $$begin
      if not exists(select from pg_roles where rolname='anon') then create role anon;end if;
      if not exists(select from pg_roles where rolname='authenticated') then create role authenticated;end if;
      if not exists(select from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;
      end;$$;
      create schema auth;create schema storage;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth,storage to anon,authenticated,service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
      create publication supabase_realtime;`);
    await createObservedTables(db);
    for(const file of ['20261014000000_dynamic_database.sql','20261015000000_push_notifications.sql','20261016000000_notification_permissions.sql'])await db.exec((await read('migrations/'+file)).replace('create extension if not exists pgcrypto;',''));
    await db.exec('drop table public.push_subscriptions');await applyObservedAccess(db);
    for(const id of users)await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,JSON.stringify({full_name:'Synthetic',phone:'synthetic-private'})]);
    await db.query('insert into public.items(id,owner_id) values($1,$2)',['d0000000-0000-4000-8000-000000000001',users[0]]);
    const snapshot=async()=> (await db.query(`select
      (select jsonb_agg(to_jsonb(x) order by id) from public.profiles x) profiles,
      (select jsonb_agg(to_jsonb(x) order by id) from public.items x) items,
      (select jsonb_agg(to_jsonb(x) order by id) from public.messages x) messages,
      (select jsonb_agg(to_jsonb(x) order by id) from public.notifications x) notifications`)).rows;
    const original=await snapshot();
    for(const file of [
      'migrations/20261103000000_secure_items_messages.sql',
      'migrations/20261103001000_private_profiles_public_directory.sql',
      'migrations/20261103002000_secure_notifications.sql',
      'migrations/20261103003000_ensure_private_push_subscriptions.sql',
      'proposals/20261104000000_message_receipts.sql',
      'proposals/20261104001000_trusted_matches.sql',
      'proposals/20261104002000_publication_receipts.sql',
      'proposals/20261104003000_validate_legacy_compatible_writes.sql'
    ]){await db.exec(await read(file));assert.deepEqual(await snapshot(),original,file);}
    assert.equal((await as('authenticated',users[0],'select * from public.buscag_capabilities()')).rows[0].queued_match_notifications,false);
    await as('service_role',null,'select public.process_match_jobs(5)');
    await db.exec(await read('activation/enable_trusted_matches.sql'));
    const payload={title:'Bolso rojo delta',description:'Bolso rojo delta',category:'Otros',status:'perdido',location_name:'Synthetic',lat:0,lng:0,date:'2026-11-04',image_url:'https://images.invalid/synthetic.png'};
    const pub=async(index,status)=>(await as('authenticated',users[index],'select * from public.publish_item_once($1,$2)',[users[index],JSON.stringify({...payload,status})])).rows[0];
    const lost=await pub(0,'perdido'),found=await pub(1,'encontrado');
    assert.equal((await pub(0,'perdido')).id,lost.id);assert.equal((await pub(1,'encontrado')).id,found.id);
    assert.equal((await as('service_role',null,'select public.process_match_jobs(5) result')).rows[0].result.notifications,2);
    assert.equal((await as('service_role',null,'select public.process_match_jobs(5) result')).rows[0].result.notifications,0);
    const send=async(index,recipient)=>(await as('authenticated',users[index],'select * from public.send_message_once($1,$2,$3,$4)',[users[index],found.id,users[recipient],'Synthetic message'])).rows[0];
    const first=await send(0,1);assert.equal((await send(0,1)).id,first.id);
    const reply=await send(1,0);assert.equal((await send(1,0)).id,reply.id);
    assert.equal((await as('authenticated',users[2],'select * from public.messages')).rows.length,0);
    assert.equal((await as('authenticated',users[2],'select * from public.notifications')).rows.length,0);
    assert.equal((await db.query('select contact_count from public.items where id=$1',[found.id])).rows[0].contact_count,2);
    assert.equal((await db.query("select count(*)::int n from public.notifications where type='match'")).rows[0].n,2);
    assert.equal((await db.query("select count(*)::int n from public.notifications where type='message'")).rows[0].n,2);
    await as('authenticated',users[1],"update public.items set status='recuperado' where id=$1",[found.id]);
    assert.equal((await db.query('select count(*)::int n from public.messages')).rows[0].n,2);
  }finally {await db.close();}
});
