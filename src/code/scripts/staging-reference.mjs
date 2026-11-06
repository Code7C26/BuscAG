// Empty synthetic reference only. Never accepts a URL, credentials or existing database.
import {readFile} from 'node:fs/promises';
const read=file=>readFile(new URL('../supabase/'+file,import.meta.url),'utf8');
export async function stagingReference(PGlite,{dateType="timestamptz"}={}){
  if(!['date','timestamptz'].includes(dateType))throw Error('Unsupported reference date type');
  const raw=new PGlite();
  const db={query:async(sql,args)=>args?raw.query(sql,args):((r)=>Array.isArray(r)?r.at(-1):r)(await raw.exec(sql)),close:()=>raw.close()};
  await db.query(`do $$begin
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
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    create publication supabase_realtime;`);
  for(const file of ['20261014000000_dynamic_database.sql','20261015000000_push_notifications.sql'])await db.query((await read('migrations/'+file)).replace('create extension if not exists pgcrypto;','').replace('date timestamptz not null default now()',`date ${dateType} not null default now()`));
  return db;
}
