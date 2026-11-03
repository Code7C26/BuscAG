-- CANDIDATE ONLY. Requires diagnostic review + the four security migrations.
-- No production execution is authorized. No existing row is deleted or rewritten.
begin;
do $$
declare r record; actual_type text;
begin
  for r in select * from (values
    ('profiles','id','uuid'),('profiles','full_name','text'),('profiles','avatar_url','text'),
    ('items','id','uuid'),('items','owner_id','uuid'),('items','title','text'),('items','image_url','text'),
    ('messages','sender_name','text'),('messages','sender_avatar','text'),('messages','item_title','text'),('messages','item_image','text'),
    ('messages','id','uuid'),('messages','item_id','uuid'),('messages','sender_id','uuid'),
    ('messages','recipient_id','uuid'),('messages','text','text'),('messages','created_at','timestamp with time zone')
  ) as expected(t,c,ty)
  loop
    select pg_catalog.format_type(a.atttypid,a.atttypmod) into actual_type
      from pg_catalog.pg_attribute a where a.attrelid=to_regclass('public.'||r.t)
        and a.attname=r.c and a.attnum>0 and not a.attisdropped;
    if actual_type is distinct from r.ty then
      raise exception 'Preflight: %.% needs %, found %; review actual diagnostic',r.t,r.c,r.ty,actual_type;
    end if;
  end loop;
  if exists(select from pg_catalog.pg_class where oid in ('public.items'::regclass,'public.messages'::regclass,'public.profiles'::regclass) and not relrowsecurity) then
    raise exception 'RLS must be enabled on items, messages and profiles';
  end if;
  if exists(select from pg_catalog.pg_attribute where attrelid='public.messages'::regclass
    and attnum>0 and not attisdropped and attnotnull and not atthasdef and attidentity=''
    and attgenerated='' and attname<>all(array['item_id','sender_id','recipient_id','sender_name','sender_avatar','item_title','item_image','text'])) then
    raise exception 'Unexpected required message columns; review actual diagnostic';
  end if;
  if to_regprocedure('public.can_send_item_message(uuid,uuid)') is null
    or to_regclass('public.public_profiles') is null then
    raise exception 'Apply/reconcile the reviewed security baseline first';
  end if;
  if has_any_column_privilege('anon','public.messages','INSERT')
    or has_column_privilege('authenticated','public.messages','text','UPDATE') then
    raise exception 'Unexpected client ACL: security baseline is not ready';
  end if;
end;
$$;

-- CREATE deliberately stops on name collisions instead of changing an unknown schema.
create schema buscag_private;
revoke all on schema buscag_private from public,anon,authenticated,service_role;
create table buscag_private.message_receipts (
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  request_hash text not null,
  message_id uuid not null references public.messages(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key(actor_id,request_key)
);
create index message_receipts_rate_idx on buscag_private.message_receipts(actor_id,accepted_at);
alter table buscag_private.message_receipts enable row level security;
revoke all on buscag_private.message_receipts from public,anon,authenticated,service_role;

create function public.send_message_once(p_request_key uuid,p_item_id uuid,p_recipient_id uuid,p_text text)
returns setof public.messages language plpgsql security definer set search_path=''
as $$
declare actor uuid := auth.uid(); body text := btrim(p_text,E' \t\r\n');
  fingerprint text; receipt buscag_private.message_receipts%rowtype; saved public.messages%rowtype;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_request_key is null or p_item_id is null or p_recipient_id is null
    or body is null or body !~ '[^[:space:]]' or char_length(body)>4000 then
    raise exception 'Invalid message request' using errcode='22023';
  end if;
  -- Serialize this caller, including rate-limit accounting across distinct keys.
  perform pg_advisory_xact_lock(hashtextextended('buscag:message:'||actor::text,0));
  fingerprint := md5(jsonb_build_object('item',p_item_id,'recipient',p_recipient_id,'text',body)::text);
  select * into receipt from buscag_private.message_receipts where actor_id=actor and request_key=p_request_key;
  if found then
    if receipt.request_hash<>fingerprint then raise exception 'Request key reused for another payload' using errcode='22023'; end if;
    select * into saved from public.messages where id=receipt.message_id and sender_id=actor;
    if not found then raise exception 'Original message is unavailable' using errcode='22023'; end if;
    return next saved; return;
  end if;
  if not public.can_send_item_message(p_item_id,p_recipient_id) then
    raise exception 'Message recipient/item is not authorized' using errcode='42501';
  end if;
  if (select count(*) from buscag_private.message_receipts where actor_id=actor and accepted_at>now()-interval '1 minute')>=120 then
    raise exception 'message_rate_limited' using errcode='P0001';
  end if;
  insert into public.messages(item_id,sender_id,recipient_id,sender_name,sender_avatar,item_title,item_image,text)
    select i.id,actor,p_recipient_id,coalesce(p.full_name,''),coalesce(p.avatar_url,''),
      coalesce(i.title,''),coalesce(i.image_url,''),body
    from public.items i join public.profiles p on p.id=actor where i.id=p_item_id
    returning * into saved;
  if not found then raise exception 'Item/profile is unavailable' using errcode='22023'; end if;
  insert into buscag_private.message_receipts(actor_id,request_key,request_hash,message_id)
    values(actor,p_request_key,fingerprint,saved.id);
  return next saved;
end;
$$;
revoke all on function public.send_message_once(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.send_message_once(uuid,uuid,uuid,text) to authenticated;
-- Prevent bypass of the RPC limiter/receipts. Select and read receipts stay unchanged.
revoke insert on public.messages from public,anon,authenticated;
do $$ declare cols text;
begin
  select string_agg(format('%I',attname),',') into cols from pg_catalog.pg_attribute
    where attrelid='public.messages'::regclass and attnum>0 and not attisdropped;
  execute format('revoke insert (%s) on public.messages from public,anon,authenticated',cols);
end; $$;
commit;
